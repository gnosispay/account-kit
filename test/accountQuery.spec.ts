import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import execSafeTransaction from "./test-helpers/execSafeTransaction";
import {
  GNO,
  GNO_WHALE,
  createAccountConfig,
  fork,
  forkReset,
  moveERC20,
} from "./test-helpers/setup";
import {
  populateAccountCreation,
  populateAccountSetup,
  populateAllowanceTransfer,
  predictDelayAddress,
  predictSafeAddress,
  populateAccountQuery,
  evaluateAccountQuery,
  predictRolesAddress,
} from "../src";
import { AccountConfig, AccountIntegrityStatus } from "../src/types";
import {
  IDelayModule__factory,
  IRolesModifier__factory,
  ISafe__factory,
} from "../typechain-types";
import { ALLOWANCE_KEY } from "../src/entrypoints/predictModuleAddress";
import { predictForwarderAddress } from "../src/entrypoints/predictSingletonAddress";

const AddressOne = "0x0000000000000000000000000000000000000001";
const AddressOther = "0x0000000000000000000000000000000000000009";

describe.only("account-query", () => {
  before(async () => {
    await fork(29800000);
  });

  after(async () => {
    await forkReset();
  });

  async function setupAccount() {
    const [owner, spender, receiver, other, relayer] =
      await hre.ethers.getSigners();

    const config = createAccountConfig({
      owner: owner.address,
      spender: spender.address,
      receiver: receiver.address,
      period: 7654,
      token: GNO,
      amount: 123,
    });
    const safeAddress = predictSafeAddress(owner.address);
    const delayAddress = predictDelayAddress(safeAddress);
    const rolesAddress = predictRolesAddress(safeAddress);
    await moveERC20(GNO_WHALE, safeAddress, GNO, 2000);

    const creationTx = populateAccountCreation(owner.address);
    const setupTx = await populateAccountSetup(
      { account: safeAddress, chainId: 31337, nonce: 0 },
      config,
      (domain, types, message) => owner.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(creationTx);
    await relayer.sendTransaction(setupTx);

    return {
      owner,
      spender,
      receiver,
      other,
      relayer,
      safe: ISafe__factory.connect(safeAddress, relayer),
      delay: IDelayModule__factory.connect(delayAddress, relayer),
      roles: IRolesModifier__factory.connect(rolesAddress, relayer),
      safeAddress: safeAddress,
      config,
    };
  }

  it("passes for a well configured account", async () => {
    const { owner, safeAddress, config } = await loadFixture(setupAccount);

    const result = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );

    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.balance).to.equal(config.amount);
  });

  it("passes and reflects recent spending on the result", async () => {
    const { owner, spender, receiver, safeAddress, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );

    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.balance).to.equal(config.amount);

    const justSpent = 23;
    const transaction = populateAllowanceTransfer(safeAddress, {
      token: GNO,
      to: receiver.address,
      amount: justSpent,
    });

    await spender.sendTransaction(transaction);

    // run the query again, expect it to reflect the used amount
    result = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.balance).to.equal(Number(config.amount) - justSpent);
  });

  it("fails when there aren't exactly two owners", async () => {
    const { safe, safeAddress, owner, spender, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    await execSafeTransaction(
      safe,
      await safe.removeOwner.populateTransaction(
        await spender.getAddress(),
        await owner.getAddress(),
        1
      ),
      [owner, spender]
    );

    result = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when threshold is tampered with", async () => {
    const { safe, safeAddress, owner, spender, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    // move threshold to 1, fails
    await execSafeTransaction(
      safe,
      await safe.changeThreshold.populateTransaction(1),
      [owner, spender]
    );
    result = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when the gnosis signer is not one of the owners", async () => {
    const { safe, safeAddress, owner, spender, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    const sentinel = "0x0000000000000000000000000000000000000001";
    const oldSigner = await spender.getAddress();
    const newSigner = "0x000000000000000000000000000000000000000f";

    await execSafeTransaction(
      safe,
      await safe.swapOwner.populateTransaction(sentinel, oldSigner, newSigner),
      [owner, spender]
    );

    expect(await safe.getOwners()).to.have.length(2);
    result = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when the number of modules enabled is not two", async () => {
    const { safe, safeAddress, owner, spender, config } =
      await loadFixture(setupAccount);

    await execSafeTransaction(
      safe,
      await safe.enableModule.populateTransaction(
        "0x0000000000000000000000000000000000000009"
      ),
      [owner, spender]
    );

    const { status } = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when roles module is not enabled", async () => {
    const { safe, safeAddress, owner, spender, config } =
      await loadFixture(setupAccount);

    const rolesAddress = predictRolesAddress(safeAddress);
    const delayAddress = predictDelayAddress(safeAddress);

    await execSafeTransaction(
      safe,
      await safe.disableModule.populateTransaction(delayAddress, rolesAddress),
      [owner, spender]
    );

    const { status } = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when delay module is not enabled", async () => {
    const { safe, spender, owner, config } = await loadFixture(setupAccount);

    const safeAddress = await safe.getAddress();
    const delayAddress = predictDelayAddress(safeAddress);

    await execSafeTransaction(
      safe,
      await safe.disableModule.populateTransaction(AddressOne, delayAddress),
      [owner, spender]
    );

    await execSafeTransaction(
      safe,
      await safe.enableModule.populateTransaction(AddressOther),
      [owner, spender]
    );

    const { status } = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when the safe is not the owner of delay", async () => {
    const { safe, safeAddress, delay, owner, spender, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    await execSafeTransaction(
      safe,
      await delay.transferOwnership.populateTransaction(
        "0x000000000000000000000000000000000000000f"
      ),
      [owner, spender]
    );

    result = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.DelayMisconfigured);
  });

  it("fails when cooldown is too short", async () => {
    const { safe, delay, safeAddress, owner, spender, config } =
      await loadFixture(setupAccount);

    await execSafeTransaction(
      safe,
      await delay.setTxCooldown.populateTransaction(5),
      [owner, spender]
    );

    const { status } = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(status).to.equal(AccountIntegrityStatus.DelayMisconfigured);
  });

  it("fails when queue is not empty", async () => {
    const { safeAddress, owner, config } = await loadFixture(setupAccount);

    const delayAddress = predictDelayAddress(safeAddress);
    // owner is configured as module on the delay. connect both here
    const delay = IDelayModule__factory.connect(delayAddress, owner);

    // everything is alright
    let result = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    // enqueue a via delay
    await delay.execTransactionFromModule(AddressOther, 0, "0x", 0);

    // integrity fails
    result = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.DelayQueueNotEmpty);
  });

  it("fails when allowance for spender was removed", async () => {
    const { owner, spender, receiver, roles, safeAddress, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(
      { owner: owner.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    const transaction = await roles.setAllowance.populateTransaction(
      ALLOWANCE_KEY,
      0,
      0,
      0,
      0,
      0
    );
    const forwarder = predictForwarderAddress({
      owner: owner.address,
      safe: safeAddress,
    });

    console.log(forwarder);
    console.log(await roles.owner());
    console.log(await hre.ethers.provider.getCode(forwarder));

    // await expect(spender.sendTransaction({ ...transaction, to: forwarder })).to
    //   .be.reverted;
    // await expect(receiver.sendTransaction({ ...transaction, to: forwarder })).to
    //   .be.reverted;
    //   await owner.sendTransaction({ ...transaction, to: forwarder });

    //   // integrity fails
    //   result = await evaluateAccount(
    //     { owner: owner.address, safe: safeAddress },
    //     config
    //   );
    //   expect(result.status).to.equal(AccountIntegrityStatus.RolesMisconfigured);
  });
});

async function evaluateAccount(
  { owner, safe }: { owner: string; safe: string },
  config: AccountConfig
) {
  const { to, data } = populateAccountQuery(safe, config);
  const resultData = await hre.ethers.provider.send("eth_call", [{ to, data }]);
  return evaluateAccountQuery({ owner, safe }, config, resultData);
}
