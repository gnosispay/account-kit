import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress } from "ethers";
import hre from "hardhat";

import execSafeTransaction from "./test-helpers/execSafeTransaction";
import {
  DAI,
  DAI_WHALE,
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
} from "../src";
import deployments from "../src/deployments";
import { AccountConfig, AccountIntegrityStatus } from "../src/types";
import {
  IAllowanceModule__factory,
  IDelayModule__factory,
  ISafe__factory,
} from "../typechain-types";

const AddressOne = "0x0000000000000000000000000000000000000001";
const AddressOther = "0x0000000000000000000000000000000000000009";

describe("account-query", () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  async function setupAccount() {
    const [owner, , , alice, bob, relayer] = await hre.ethers.getSigners();

    const config = createAccountConfig({
      owner: owner.address,
      spender: alice.address,
      period: 7654,
      token: DAI,
      amount: 123,
    });
    const safeAddress = predictSafeAddress(owner.address);
    const delayAddress = predictDelayAddress(safeAddress);
    await moveERC20(DAI_WHALE, safeAddress, DAI, 2000);

    const creationTx = populateAccountCreation(owner.address);
    const setupTx = await populateAccountSetup(
      { safe: safeAddress, chainId: 31337, nonce: 0 },
      config,
      (domain, types, message) => owner.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(creationTx);
    await relayer.sendTransaction(setupTx);

    return {
      owner,
      spender: alice,
      alice,
      bob,
      relayer,
      safeAddress: safeAddress,
      safe: ISafe__factory.connect(safeAddress, relayer),
      allowance: IAllowanceModule__factory.connect(
        deployments.allowanceSingleton.address,
        relayer
      ),
      delay: IDelayModule__factory.connect(delayAddress, relayer),
      config,
    };
  }

  it("passes for a well configured account", async () => {
    const { safeAddress, config } = await loadFixture(setupAccount);

    const result = await evaluateAccount(safeAddress, config);

    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.detail?.allowance.unspent).to.equal(config.amount);
    expect(result.detail?.allowance.nonce).to.equal(1);
  });

  it("passes and reflects recent spending on the result", async () => {
    const { safeAddress, alice, relayer, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(safeAddress, config);

    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.detail?.allowance.unspent).to.equal(config.amount);
    expect(result.detail?.allowance.nonce).to.equal(1);

    const justSpent = 23;
    const transaction = await populateAllowanceTransfer(
      { safe: safeAddress, chainId: 31337, nonce: 1 },
      {
        spender: alice.address,
        token: DAI,
        to: ZeroAddress,
        amount: justSpent,
      },
      (message) => alice.signMessage(message)
    );
    await relayer.sendTransaction(transaction);

    // run the query again, expect it to reflect the used amount
    result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.detail?.allowance.unspent).to.equal(
      Number(config.amount) - justSpent
    );
    expect(result.detail?.allowance.nonce).to.equal(2);
  });

  it("fails when there aren't exactly two owners", async () => {
    const { safe, safeAddress, owner, spender, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(safeAddress, config);
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

    result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when threshold is tampered with", async () => {
    const { safe, safeAddress, owner, spender, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    // move threshold to 1, fails
    await execSafeTransaction(
      safe,
      await safe.changeThreshold.populateTransaction(1),
      [owner, spender]
    );
    result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when the gnosis signer is not one of the owners", async () => {
    const { safe, safeAddress, owner, spender, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(safeAddress, config);
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
    result = await evaluateAccount(safeAddress, config);
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

    const { status } = await evaluateAccount(safeAddress, config);
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when allowance module is not enabled", async () => {
    const { safe, safeAddress, owner, spender, config } =
      await loadFixture(setupAccount);

    const allowanceAddress = deployments.allowanceSingleton.address;
    const delayAddress = predictDelayAddress(safeAddress);

    await execSafeTransaction(
      safe,
      await safe.disableModule.populateTransaction(
        delayAddress,
        allowanceAddress
      ),
      [owner, spender]
    );

    await execSafeTransaction(
      safe,
      await safe.enableModule.populateTransaction(AddressOther),
      [owner, spender]
    );

    const { status } = await evaluateAccount(safeAddress, config);
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

    const { status } = await evaluateAccount(safeAddress, config);
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when the safe is not the owner of delay", async () => {
    const { safe, safeAddress, delay, owner, spender, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    await execSafeTransaction(
      safe,
      await delay.transferOwnership.populateTransaction(
        "0x000000000000000000000000000000000000000f"
      ),
      [owner, spender]
    );

    result = await evaluateAccount(safeAddress, config);
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

    const { status } = await evaluateAccount(safeAddress, config);
    expect(status).to.equal(AccountIntegrityStatus.DelayMisconfigured);
  });

  it("fails when queue is not empty", async () => {
    const { safeAddress, owner, config } = await loadFixture(setupAccount);

    const delayAddress = predictDelayAddress(safeAddress);
    // owner is configured as module on the delay. connect both here
    const delay = IDelayModule__factory.connect(delayAddress, owner);

    // everything is alright
    let result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    // enqueue a via delay
    await delay.execTransactionFromModule(AddressOther, 0, "0x", 0);

    // integrity fails
    result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(AccountIntegrityStatus.DelayQueueNotEmpty);
  });

  it("fails when spender was removed", async () => {
    const { safeAddress, safe, allowance, owner, spender, config } =
      await loadFixture(setupAccount);

    // everything is alright
    let result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    await execSafeTransaction(
      safe,
      await allowance.removeDelegate.populateTransaction(config.spender, true),
      [owner, spender]
    );

    // integrity fails
    result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(
      AccountIntegrityStatus.AllowanceMisconfigured
    );
  });

  it("fails when allowance for spender was removed", async () => {
    const { safeAddress, safe, allowance, owner, spender, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    await execSafeTransaction(
      safe,
      await allowance.deleteAllowance.populateTransaction(
        config.spender,
        config.token
      ),
      [owner, spender]
    );

    // integrity fails
    result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(
      AccountIntegrityStatus.AllowanceMisconfigured
    );
  });
});

async function evaluateAccount(safeAddress: string, config: AccountConfig) {
  const { to, data } = populateAccountQuery(safeAddress, config);
  const resultData = await hre.ethers.provider.send("eth_call", [{ to, data }]);
  return evaluateAccountQuery(safeAddress, config, resultData);
}
