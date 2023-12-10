import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroHash, getAddress } from "ethers";
import hre from "hardhat";

import {
  createSetupConfig,
  postFixture,
  preFixture,
} from "./test-helpers/index";

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
import populateSpenderSetup from "../src/entrypoints/spender-actions/spenderSetup";
import {
  _populateSafeCreation,
  _predictSafeAddress,
  predictBouncerAddress,
  predictDelayModAddress,
  predictRolesModAddress,
} from "../src/parts";
import { SetupConfig, AccountIntegrityStatus } from "../src/types";
import {
  IDelayModifier__factory,
  IRolesModifier__factory,
  ISafe__factory,
  TestERC20__factory,
} from "../typechain-types";

const AddressOne = "0x0000000000000000000000000000000000000001";

describe("account-query", () => {
  before(async () => {
    await preFixture();
  });

  after(async () => {
    await postFixture();
  });

  async function setupAccount() {
    const [owner, signer, receiver, delegate, relayer] =
      await hre.ethers.getSigners();

    const testERC20 = await (
      await hre.ethers.getContractFactory("TestERC20")
    ).deploy();

    const token = TestERC20__factory.connect(
      await testERC20.getAddress(),
      relayer
    );

    const spender = {
      address: _predictSafeAddress({
        owners: [signer.address],
        threshold: 1,
        creationNonce: BigInt(123),
      }),
      creationTx: _populateSafeCreation({
        owners: [signer.address],
        threshold: 1,
        creationNonce: BigInt(123),
      }),
    };

    const config = createSetupConfig({
      spender: spender.address,
      receiver: receiver.address,
      period: 60 * 60 * 24, // 86400 seconds one day
      token: await token.getAddress(),
      allowance: 123,
      cooldown: 120, // 120 seconds
      expiration: 120 * 1000,
    });
    const account = predictAccountAddress({ owner: owner.address });
    const delayAddress = predictDelayModAddress(account);
    const rolesAddress = predictRolesModAddress(account);

    const creationTx = populateAccountCreation({ owner: owner.address });
    const setupTx = await populateAccountSetup(
      { account, owner: owner.address, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    const spenderSetupTx = await populateSpenderSetup(
      {
        spender: config.spender,
        delegate: delegate.address,
        chainId: 31337,
        nonce: 0,
      },
      ({ domain, types, message }) =>
        signer.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(creationTx);
    await relayer.sendTransaction(setupTx);
    await relayer.sendTransaction(spender.creationTx);
    await relayer.sendTransaction(spenderSetupTx);
    await token.mint(account, 2000);

    return {
      account,
      owner,
      signer,
      receiver,
      delegate,
      relayer,
      token,
      safe: ISafe__factory.connect(account, relayer),
      delay: IDelayModifier__factory.connect(delayAddress, relayer),
      roles: IRolesModifier__factory.connect(rolesAddress, relayer),
      config,
    };
  }

  it("passes for a well configured account", async () => {
    const { account, config } = await loadFixture(setupAccount);

    const result = await evaluateAccount(account, config);

    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.allowance.balance).to.equal(123);
    expect(result.allowance.refill).to.equal(123);
    expect(result.allowance.period).to.equal(60 * 60 * 24);
  });

  it("calculates accrued allowance", async () => {
    const { account, owner, receiver, delegate, relayer, config } =
      await loadFixture(setupAccount);

    const oneDay = 60 * 60 * 24;
    const refill = 1000;
    const spent = 50;

    const enqueue = await populateLimitEnqueue(
      { account, chainId: 31337, salt: ZeroHash },
      { period: oneDay, refill },
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    // go forward3 minutes
    await mine(3, { interval: 60 });

    const dispatch = populateLimitDispatch(
      { account },
      {
        period: oneDay,
        refill,
      }
    );
    await relayer.sendTransaction(dispatch);

    let result = await evaluateAccount(account, config);
    expect(result.allowance.balance).to.equal(refill);

    const transfer = {
      token: config.token,
      to: receiver.address,
      amount: spent,
    };

    const spendTx = await populateSpend(
      { account, spender: config.spender, chainId: 31337 },
      transfer,
      ({ domain, types, message }) =>
        delegate.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(spendTx);

    result = await evaluateAccount(account, config);
    expect(result.allowance.balance).to.equal(refill - spent);

    // go forward 12 hours
    await mine(13, { interval: 60 * 60 });

    // still no replenish
    result = await evaluateAccount(account, config);
    expect(result.allowance.balance).to.equal(refill - spent);

    // go forward 12 hours more
    await mine(13, { interval: 60 * 60 });

    // yes it replenished
    result = await evaluateAccount(account, config);
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
      { account, chainId: 31337 },
      { period: oneDay, refill, timestamp: startOfDay },
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    // go forward3 minutes
    await mine(3, { interval: 60 });

    const dispatch = populateLimitDispatch(
      { account },
      {
        period: oneDay,
        refill,
        timestamp: startOfDay,
      }
    );
    await relayer.sendTransaction(dispatch);

    let result = await evaluateAccount(account, config);
    expect(result.allowance.nextRefill).to.equal(startOfDay + oneDay);

    // go forward 24 hours
    await mine(25, { interval: 60 * 60 });

    // refill is next day
    result = await evaluateAccount(account, config);
    expect(result.allowance.nextRefill).to.equal(startOfDay + oneDay + oneDay);
  });
  it("passes and reflects recent spending on the result", async () => {
    const { account, receiver, delegate, relayer, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(account, config);

    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.allowance.balance).to.equal(config.allowance.refill);

    const justSpent = 23;
    const transfer = {
      token: config.token,
      to: receiver.address,
      amount: justSpent,
    };

    const transaction = await populateSpend(
      { account, spender: config.spender, chainId: 31337 },
      transfer,
      ({ domain, types, message }) =>
        delegate.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(transaction);

    // run the query again, expect it to reflect the used amount
    result = await evaluateAccount(account, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.allowance.balance).to.equal(
      Number(config.allowance.refill) - justSpent
    );
  });
  it("handles balances exceeding max refill", async () => {
    const { roles, account, owner, config, relayer } =
      await loadFixture(setupAccount);

    // while not possible using account-kit functions, users might set a balance exceeding maxBalance
    const PERIOD = 7654;
    const AMOUNT = 123;

    const updateLimitTx = {
      to: predictBouncerAddress(account),
      value: 0,
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
        chainId: hre.network.config.chainId as number,
      },
      updateLimitTx,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueueTx);

    // wait for cooldown & dispatch
    await mine(2, { interval: config.delay.cooldown });
    const dispatchTx = await populateExecuteDispatch(
      { account },
      updateLimitTx
    );
    await relayer.sendTransaction(dispatchTx);

    // we should handle this correctly
    const result = await evaluateAccount(account, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.allowance.balance).to.equal(AMOUNT * 2);
  });
  it("fails when ownership isn't renounced", async () => {
    const { account, owner, signer, relayer, safe, config } =
      await loadFixture(setupAccount);

    // ACCOUNT starts OK
    let result = await evaluateAccount(account, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    const reconfigTx = {
      value: 0,
      ...(await safe.addOwnerWithThreshold.populateTransaction(
        await signer.getAddress(),
        2
      )),
    };

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { account, chainId: 31337, salt: ZeroHash },
      reconfigTx,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    // FAIL: queue not empty
    result = await evaluateAccount(account, config);
    expect(result.status).to.equal(AccountIntegrityStatus.DelayQueueNotEmpty);

    // move 3 minutes forward, cooldown is 2 minutes
    await mine(4, { interval: 60 });
    const dispatch = populateExecuteDispatch({ account }, reconfigTx);
    await relayer.sendTransaction(dispatch);

    // FAIL: no renounce ownership
    result = await evaluateAccount(account, config);
    expect(result.status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });
  it("fails when the number of modules enabled is not two", async () => {
    const { account, owner, relayer, safe, config } =
      await loadFixture(setupAccount);

    const reconfig = {
      value: 0,
      ...(await safe.enableModule.populateTransaction(
        "0x0000000000000000000000000000000000000005"
      )),
    };

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { account, chainId: 31337 },
      reconfig,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = populateExecuteDispatch({ account }, reconfig);
    await relayer.sendTransaction(dispatch);

    const { status } = await evaluateAccount(account, config);
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });
  it("fails when roles module is not enabled", async () => {
    const { owner, relayer, safe, account, config } =
      await loadFixture(setupAccount);

    const delayAddress = predictDelayModAddress(account);
    const rolesAddress = predictRolesModAddress(account);

    const reconfig = {
      value: 0,
      ...(await safe.disableModule.populateTransaction(
        delayAddress,
        rolesAddress
      )),
    };

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { account, chainId: 31337 },
      reconfig,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = populateExecuteDispatch({ account }, reconfig);
    await relayer.sendTransaction(dispatch);

    const { status } = await evaluateAccount(account, config);
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });
  it("fails when delay module is not enabled", async () => {
    const { account, owner, relayer, safe, config } =
      await loadFixture(setupAccount);

    const delayAddress = predictDelayModAddress(account);

    const reconfig = {
      value: 0,
      ...(await safe.disableModule.populateTransaction(
        AddressOne,
        delayAddress
      )),
    };

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { account, chainId: 31337 },
      reconfig,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = populateExecuteDispatch({ account }, reconfig);
    await relayer.sendTransaction(dispatch);

    const { status } = await evaluateAccount(account, config);
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });
  it("fails when the safe is not the owner of delay", async () => {
    const { account, owner, relayer, delay, config } =
      await loadFixture(setupAccount);

    await expect(await delay.owner()).to.equal(account);

    const reconfig = {
      value: 0,
      ...(await delay.transferOwnership.populateTransaction(
        "0x000000000000000000000000000000000000000f"
      )),
    };

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { account, chainId: 31337 },
      reconfig,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = populateExecuteDispatch({ account }, reconfig);
    await relayer.sendTransaction(dispatch);

    expect(await delay.owner()).to.equal(
      getAddress("0x000000000000000000000000000000000000000f")
    );

    const { status } = await evaluateAccount(account, config);
    expect(status).to.equal(AccountIntegrityStatus.DelayMisconfigured);
  });
  it("fails when cooldown is too short", async () => {
    const { account, owner, relayer, delay, config } =
      await loadFixture(setupAccount);

    const reconfig = {
      value: 0,
      ...(await delay.setTxCooldown.populateTransaction(5)),
    };

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { account, chainId: 31337 },
      reconfig,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = populateExecuteDispatch({ account }, reconfig);
    await relayer.sendTransaction(dispatch);

    const { status } = await evaluateAccount(account, config);
    expect(status).to.equal(AccountIntegrityStatus.DelayMisconfigured);
  });
  it("fails when queue is not empty", async () => {
    const { account, owner, relayer, delay, config } =
      await loadFixture(setupAccount);

    const reconfig = {
      value: 0,
      ...(await delay.setTxCooldown.populateTransaction(5)),
    };

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { account, chainId: 31337 },
      reconfig,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    const { status } = await evaluateAccount(account, config);
    expect(status).to.equal(AccountIntegrityStatus.DelayQueueNotEmpty);
  });
  it("still computes allowance when queue is not empty", async () => {
    const { account, owner, relayer, delay, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(account, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.allowance.balance).to.equal(config.allowance.refill);
    expect(result.allowance.refill).to.equal(config.allowance.refill);
    expect(result.allowance.nextRefill).to.not.equal(BigInt(0));
    expect(result.allowance.nextRefill != null).to.equal(true);

    const reconfig = {
      value: 0,
      ...(await delay.setTxCooldown.populateTransaction(5)),
    };

    // enqueue the change
    const enqueue = await populateExecuteEnqueue(
      { account, chainId: 31337 },
      reconfig,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueue);

    result = await evaluateAccount(account, config);
    expect(result.status).to.equal(AccountIntegrityStatus.DelayQueueNotEmpty);
    expect(result.allowance.balance).to.equal(config.allowance.refill);
    expect(result.allowance.refill).to.equal(config.allowance.refill);
    expect(result.allowance.nextRefill).to.not.equal(BigInt(0));
    expect(result.allowance.nextRefill != null).to.equal(true);
  });
});

async function evaluateAccount(account: string, config: SetupConfig) {
  return accountQuery(
    {
      account,
      cooldown: config.delay.cooldown,
    },
    ({ to, data }) => hre.ethers.provider.send("eth_call", [{ to, data }])
  );
}
