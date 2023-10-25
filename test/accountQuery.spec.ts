import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { getAddress } from "ethers";
import hre from "hardhat";

import {
  GNO,
  GNO_WHALE,
  createSetupConfig,
  fork,
  forkReset,
  moveERC20,
} from "./setup";

import {
  populateAccountCreation,
  populateAccountSetup,
  populateLimitEnqueue,
  populateLimitDispatch,
  populateSpend,
  predictAccountAddress,
  accountQuery,
  populateExecuteEnqueue,
  populateExecuteDispatch,
} from "../src";

import { SPENDING_ALLOWANCE_KEY } from "../src/constants";
import { predictDelayAddress, predictRolesAddress } from "../src/parts";
import { SetupConfig, AccountIntegrityStatus } from "../src/types";
import {
  IDelayModule__factory,
  IRolesModifier__factory,
  ISafe__factory,
} from "../typechain-types";

const AddressOne = "0x0000000000000000000000000000000000000001";

describe("account-query", () => {
  before(async () => {
    await fork(29800000);
  });

  after(async () => {
    await forkReset();
  });

  async function setupAccount() {
    const [owner, spender, receiver, relayer] = await hre.ethers.getSigners();

    const config = createSetupConfig({
      spender: spender.address,
      receiver: receiver.address,
      period: 60 * 60 * 24, // 86400 seconds one day
      token: GNO,
      allowance: 123,
      cooldown: 120, // 120 seconds
    });
    const account = predictAccountAddress(owner.address);
    const delayAddress = predictDelayAddress(account);
    const rolesAddress = predictRolesAddress(account);
    await moveERC20(GNO_WHALE, account, GNO, 2000);

    const creationTx = populateAccountCreation(owner.address);
    const setupTx = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(creationTx);
    await relayer.sendTransaction(setupTx);

    return {
      account,
      owner,
      spender,
      receiver,
      relayer,
      safe: ISafe__factory.connect(account, relayer),
      delay: IDelayModule__factory.connect(delayAddress, relayer),
      roles: IRolesModifier__factory.connect(rolesAddress, relayer),
      config,
    };
  }

  it("passes for a well configured account", async () => {
    const { account, owner, config } = await loadFixture(setupAccount);

    const result = await evaluateAccount(account, owner.address, config);

    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.allowance.balance).to.equal(123);
    expect(result.allowance.maxBalance).to.equal(123);
    expect(result.allowance.refill).to.equal(123);
    expect(result.allowance.period).to.equal(60 * 60 * 24);
  });

  it("calculates accrued allowance", async () => {
    const { account, owner, spender, receiver, relayer, config } =
      await loadFixture(setupAccount);

    const oneDay = 60 * 60 * 24;
    const refill = 1000;
    const spent = 50;

    const enqueue = await populateLimitEnqueue(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      { period: oneDay, refill },
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    // go forward3 minutes
    await mine(3, { interval: 60 });

    const dispatch = populateLimitDispatch(account, {
      period: oneDay,
      refill,
    });
    await relayer.sendTransaction(dispatch);

    let result = await evaluateAccount(account, owner.address, config);
    expect(result.allowance.balance).to.equal(refill);

    const spendTx = await populateSpend(
      { account, spender: spender.address, chainId: 31337, nonce: 0 },
      {
        token: config.token,
        to: receiver.address,
        amount: spent,
      },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(spendTx);

    result = await evaluateAccount(account, owner.address, config);
    expect(result.allowance.balance).to.equal(refill - spent);

    // go forward 12 hours
    await mine(13, { interval: 60 * 60 });

    // still no replenish
    result = await evaluateAccount(account, owner.address, config);
    expect(result.allowance.balance).to.equal(refill - spent);

    // go forward 12 hours more
    await mine(13, { interval: 60 * 60 });

    // yes it replenished
    result = await evaluateAccount(account, owner.address, config);
    expect(result.allowance.balance).to.equal(refill);
  });

  it("calculates next refill timestamp", async () => {
    const { account, owner, relayer, config } = await loadFixture(setupAccount);

    const block = await hre.ethers.provider.getBlock("latest");
    if (!block) throw new Error("cannot get block");

    const date = new Date(block.timestamp * 1000);
    date.setUTCHours(0, 0, 0, 0);
    const startOfDay = date.getTime() / 1000;

    const oneDay = 60 * 60 * 24;
    const refill = 1000;
    const enqueue = await populateLimitEnqueue(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      { period: oneDay, refill, timestamp: startOfDay },
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    // go forward3 minutes
    await mine(3, { interval: 60 });

    const dispatch = populateLimitDispatch(account, {
      period: oneDay,
      refill,
      timestamp: startOfDay,
    });
    await relayer.sendTransaction(dispatch);

    let result = await evaluateAccount(account, owner.address, config);
    expect(result.allowance.nextRefill).to.equal(startOfDay + oneDay);

    // go forward 24 hours
    await mine(25, { interval: 60 * 60 });

    // refill is next day
    result = await evaluateAccount(account, owner.address, config);
    expect(result.allowance.nextRefill).to.equal(startOfDay + oneDay + oneDay);
  });

  it("passes and reflects recent spending on the result", async () => {
    const { account, owner, spender, receiver, relayer, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(account, owner.address, config);

    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.allowance.balance).to.equal(config.allowance.refill);

    const justSpent = 23;
    const transaction = await populateSpend(
      { account, spender: spender.address, chainId: 31337, nonce: 0 },
      { token: GNO, to: receiver.address, amount: justSpent },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(transaction);

    // run the query again, expect it to reflect the used amount
    result = await evaluateAccount(account, owner.address, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.allowance.balance).to.equal(
      Number(config.allowance.refill) - justSpent
    );
  });

  // TODO: Setting a balance > maxBalance will only be possible with Roles V2.1. Enable this test then.
  it.skip("handles balances exceeding max balance", async () => {
    const { roles, account, owner, config, relayer } =
      await loadFixture(setupAccount);

    // while not possible using account-kit functions, users might set a balance exceeding maxBalance
    const PERIOD = 7654;
    const AMOUNT = 123;

    const updateLimitTx = {
      to: await roles.getAddress(),
      data: roles.interface.encodeFunctionData("setAllowance", [
        SPENDING_ALLOWANCE_KEY,
        AMOUNT * 2,
        AMOUNT,
        AMOUNT,
        PERIOD,
        0,
      ]),
    };

    const enqueueTx = await populateExecuteEnqueue(
      {
        account,
        owner: await owner.address,
        chainId: hre.network.config.chainId as number,
        nonce: 0,
      },
      updateLimitTx,
      (...args) => owner.signTypedData(...args)
    );
    await relayer.sendTransaction(enqueueTx);

    // wait for cooldown & dispatch
    await mine(2, { interval: config.delay.cooldown });
    const dispatchTx = await populateExecuteDispatch(account, updateLimitTx);
    await relayer.sendTransaction(dispatchTx);

    // we should handle this correctly
    const result = await evaluateAccount(account, owner.address, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.allowance.balance).to.equal(AMOUNT * 2);
  });

  it("fails when ownership isn't renounced", async () => {
    const { account, owner, spender, relayer, safe, config } =
      await loadFixture(setupAccount);

    // ACCOUNT starts OK
    let result = await evaluateAccount(account, owner.address, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    const reconfigTx = await safe.addOwnerWithThreshold.populateTransaction(
      await spender.getAddress(),
      2
    );

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      reconfigTx,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    // FAIL: queue not empty
    result = await evaluateAccount(account, owner.address, config);
    expect(result.status).to.equal(AccountIntegrityStatus.DelayQueueNotEmpty);

    // move 3 minutes forward, cooldown is 2 minutes
    await mine(4, { interval: 60 });
    const dispatch = populateExecuteDispatch(account, reconfigTx);
    await relayer.sendTransaction(dispatch);

    // FAIL: no renounce ownership
    result = await evaluateAccount(account, owner.address, config);
    expect(result.status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });
  it("fails when the number of modules enabled is not two", async () => {
    const { account, owner, relayer, safe, config } =
      await loadFixture(setupAccount);

    const reconfig = await safe.enableModule.populateTransaction(
      "0x0000000000000000000000000000000000000005"
    );

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      reconfig,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = populateExecuteDispatch(account, reconfig);
    await relayer.sendTransaction(dispatch);

    const { status } = await evaluateAccount(account, owner.address, config);
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });
  it("fails when roles module is not enabled", async () => {
    const { owner, relayer, safe, account, config } =
      await loadFixture(setupAccount);

    const delayAddress = predictDelayAddress(account);
    const rolesAddress = predictRolesAddress(account);

    const reconfig = await safe.disableModule.populateTransaction(
      delayAddress,
      rolesAddress
    );

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      reconfig,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = populateExecuteDispatch(account, reconfig);
    await relayer.sendTransaction(dispatch);

    const { status } = await evaluateAccount(account, owner.address, config);
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });
  it("fails when delay module is not enabled", async () => {
    const { account, owner, relayer, safe, config } =
      await loadFixture(setupAccount);

    const delayAddress = predictDelayAddress(account);

    const reconfig = await safe.disableModule.populateTransaction(
      AddressOne,
      delayAddress
    );

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      reconfig,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = populateExecuteDispatch(account, reconfig);
    await relayer.sendTransaction(dispatch);

    const { status } = await evaluateAccount(account, owner.address, config);
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });
  it("fails when the safe is not the owner of delay", async () => {
    const { account, owner, relayer, delay, config } =
      await loadFixture(setupAccount);

    await expect(await delay.owner()).to.equal(account);

    const reconfig = await delay.transferOwnership.populateTransaction(
      "0x000000000000000000000000000000000000000f"
    );

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      reconfig,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = populateExecuteDispatch(account, reconfig);
    await relayer.sendTransaction(dispatch);

    expect(await delay.owner()).to.equal(
      getAddress("0x000000000000000000000000000000000000000f")
    );

    const { status } = await evaluateAccount(account, owner.address, config);
    expect(status).to.equal(AccountIntegrityStatus.DelayMisconfigured);
  });
  it("fails when cooldown is too short", async () => {
    const { account, owner, relayer, delay, config } =
      await loadFixture(setupAccount);

    const reconfig = await delay.setTxCooldown.populateTransaction(5);

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      reconfig,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = populateExecuteDispatch(account, reconfig);
    await relayer.sendTransaction(dispatch);

    const { status } = await evaluateAccount(account, owner.address, config);
    expect(status).to.equal(AccountIntegrityStatus.DelayMisconfigured);
  });
  it("fails when queue is not empty", async () => {
    const { account, owner, relayer, delay, config } =
      await loadFixture(setupAccount);

    const reconfig = await delay.setTxCooldown.populateTransaction(5);

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      reconfig,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    const { status } = await evaluateAccount(account, owner.address, config);
    expect(status).to.equal(AccountIntegrityStatus.DelayQueueNotEmpty);
  });
});

async function evaluateAccount(
  account: string,
  owner: string,
  config: SetupConfig
) {
  return accountQuery(
    {
      account,
      owner,
      spender: config.spender,
      cooldown: config.delay.cooldown,
    },
    ({ to, data }) => hre.ethers.provider.send("eth_call", [{ to, data }])
  );
}
