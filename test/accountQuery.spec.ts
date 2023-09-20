import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
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
  evaluateAccountQuery,
  populateAccountCreation,
  populateAccountQuery,
  populateAccountSetup,
  populateAllowanceReconfig,
  populateAllowanceTransfer,
  predictDelayAddress,
  predictRolesAddress,
  predictSafeAddress,
} from "../src";
import { AccountConfig, AccountIntegrityStatus } from "../src/types";
import {
  IDelayModule__factory,
  IRolesModifier__factory,
  ISafe__factory,
} from "../typechain-types";

const AddressOne = "0x0000000000000000000000000000000000000001";
const AddressOther = "0x0000000000000000000000000000000000000009";

describe("account-query", () => {
  before(async () => {
    await fork(29800000);
  });

  after(async () => {
    await forkReset();
  });

  async function setupAccount() {
    const [eoa, spender, receiver, other, relayer] =
      await hre.ethers.getSigners();

    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
      period: 7654,
      token: GNO,
      allowance: 123,
    });
    const safeAddress = predictSafeAddress(eoa.address);
    const delayAddress = predictDelayAddress(safeAddress);
    const rolesAddress = predictRolesAddress(safeAddress);
    await moveERC20(GNO_WHALE, safeAddress, GNO, 2000);

    const creationTx = populateAccountCreation(eoa.address);
    const setupTx = await populateAccountSetup(
      { eoa: eoa.address, safe: safeAddress, chainId: 31337, nonce: 0 },
      config,
      (domain, types, message) => eoa.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(creationTx);
    await relayer.sendTransaction(setupTx);

    return {
      eoa,
      spender,
      receiver,
      other,
      relayer,
      safe: ISafe__factory.connect(safeAddress, relayer),
      delay: IDelayModule__factory.connect(delayAddress, relayer),
      roles: IRolesModifier__factory.connect(rolesAddress, relayer),
      safeAddress,
      rolesAddress,
      config,
    };
  }

  it("passes for a well configured account", async () => {
    const { eoa, safeAddress, config } = await loadFixture(setupAccount);

    const result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );

    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.balance).to.equal(config.allowance);
  });

  it("calculates accrued allowance", async () => {
    const { eoa, safeAddress, roles, config } = await loadFixture(setupAccount);

    const REFILL = 100;

    const timestamp = (await hre.ethers.provider.getBlock("latest"))
      ?.timestamp as number;

    const transaction = populateAllowanceReconfig(
      {
        eoa: eoa.address,
        safe: safeAddress,
      },
      { period: 1000, refill: REFILL, balance: 0, timestamp }
    );
    await eoa.sendTransaction(transaction);

    let result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.balance).to.equal(0);

    // go forward 1200 seconds
    await mine(3, { interval: 600 });

    result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.balance).to.equal(REFILL);
  });

  it("passes and reflects recent spending on the result", async () => {
    const { eoa, spender, receiver, safeAddress, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );

    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.balance).to.equal(config.allowance);

    const justSpent = 23;
    const transaction = populateAllowanceTransfer(
      { safe: safeAddress },
      {
        token: GNO,
        to: receiver.address,
        amount: justSpent,
      }
    );

    await spender.sendTransaction(transaction);

    // run the query again, expect it to reflect the used amount
    result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.balance).to.equal(Number(config.allowance) - justSpent);
  });

  it("fails when there aren't exactly two owners", async () => {
    const { eoa, spender, safe, safeAddress, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    await execSafeTransaction(
      safe,
      await safe.removeOwner.populateTransaction(
        await spender.getAddress(),
        await eoa.getAddress(),
        1
      ),
      [eoa, spender]
    );

    result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when threshold is tampered with", async () => {
    const { eoa, spender, safe, safeAddress, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    // move threshold to 1, fails
    await execSafeTransaction(
      safe,
      await safe.changeThreshold.populateTransaction(1),
      [eoa, spender]
    );
    result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when the gnosis signer is not one of the owners", async () => {
    const { eoa, spender, safe, safeAddress, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    const sentinel = "0x0000000000000000000000000000000000000001";
    const oldSigner = await spender.getAddress();
    const newSigner = "0x000000000000000000000000000000000000000f";

    await execSafeTransaction(
      safe,
      await safe.swapOwner.populateTransaction(sentinel, oldSigner, newSigner),
      [eoa, spender]
    );

    expect(await safe.getOwners()).to.have.length(2);
    result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when the number of modules enabled is not two", async () => {
    const { eoa, spender, safe, safeAddress, config } =
      await loadFixture(setupAccount);

    await execSafeTransaction(
      safe,
      await safe.enableModule.populateTransaction(
        "0x0000000000000000000000000000000000000009"
      ),
      [eoa, spender]
    );

    const { status } = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when roles module is not enabled", async () => {
    const { eoa, safe, safeAddress, spender, config } =
      await loadFixture(setupAccount);

    const rolesAddress = predictRolesAddress(safeAddress);
    const delayAddress = predictDelayAddress(safeAddress);

    await execSafeTransaction(
      safe,
      await safe.disableModule.populateTransaction(delayAddress, rolesAddress),
      [eoa, spender]
    );

    const { status } = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when delay module is not enabled", async () => {
    const { safe, spender, eoa, config } = await loadFixture(setupAccount);

    const safeAddress = await safe.getAddress();
    const delayAddress = predictDelayAddress(safeAddress);

    await execSafeTransaction(
      safe,
      await safe.disableModule.populateTransaction(AddressOne, delayAddress),
      [eoa, spender]
    );

    await execSafeTransaction(
      safe,
      await safe.enableModule.populateTransaction(AddressOther),
      [eoa, spender]
    );

    const { status } = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when the safe is not the owner of delay", async () => {
    const { eoa, safe, safeAddress, delay, spender, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    await execSafeTransaction(
      safe,
      await delay.transferOwnership.populateTransaction(
        "0x000000000000000000000000000000000000000f"
      ),
      [eoa, spender]
    );

    result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.DelayMisconfigured);
  });

  it("fails when cooldown is too short", async () => {
    const { eoa, safe, delay, safeAddress, spender, config } =
      await loadFixture(setupAccount);

    await execSafeTransaction(
      safe,
      await delay.setTxCooldown.populateTransaction(5),
      [eoa, spender]
    );

    const { status } = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(status).to.equal(AccountIntegrityStatus.DelayMisconfigured);
  });

  it("fails when queue is not empty", async () => {
    const { safeAddress, eoa, config } = await loadFixture(setupAccount);

    const delayAddress = predictDelayAddress(safeAddress);
    // owner is configured as module on the delay. connect both here
    const delay = IDelayModule__factory.connect(delayAddress, eoa);

    // everything is alright
    let result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    // enqueue a via delay
    await delay.execTransactionFromModule(AddressOther, 0, "0x", 0);

    // integrity fails
    result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.DelayQueueNotEmpty);
  });

  it("fails when allowance for spender was removed", async () => {
    const { eoa, spender, receiver, safeAddress, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    const transaction = populateAllowanceReconfig(
      { eoa: eoa.address, safe: safeAddress },
      { refill: 0, period: 0 }
    );

    await expect(spender.sendTransaction(transaction)).to.be.reverted;
    await expect(receiver.sendTransaction(transaction)).to.be.reverted;
    await eoa.sendTransaction(transaction);

    // integrity fails
    result = await evaluateAccount(
      { eoa: eoa.address, safe: safeAddress },
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.RolesMisconfigured);
  });
});

async function evaluateAccount(
  { eoa, safe }: { eoa: string; safe: string },
  config: AccountConfig
) {
  const { to, data } = populateAccountQuery(safe);
  const resultData = await hre.ethers.provider.send("eth_call", [{ to, data }]);
  return evaluateAccountQuery({ eoa, safe }, config, resultData);
}
