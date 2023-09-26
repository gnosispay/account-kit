import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { getAddress } from "ethers";
import hre from "hardhat";

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
  populateLimitEnqueue,
  populateLimitDispatch,
  populateSpend,
  predictAccountAddress,
} from "../src";
import {
  populateExecDispatch,
  populateExecEnqueue,
} from "../src/entrypoints/exec";
import { predictDelayAddress } from "../src/parts/delay";
import { predictRolesAddress } from "../src/parts/roles";

import { AccountConfig, AccountIntegrityStatus } from "../src/types";
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
    const [eoa, spender, receiver, other, relayer] =
      await hre.ethers.getSigners();

    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
      period: 60 * 60 * 24, // 86400 seconds one day
      token: GNO,
      allowance: 123,
      cooldown: 120, // 120 seconds
    });
    const safeAddress = predictAccountAddress(eoa.address);
    const delayAddress = predictDelayAddress(safeAddress);
    const rolesAddress = predictRolesAddress(safeAddress);
    await moveERC20(GNO_WHALE, safeAddress, GNO, 2000);

    const creationTx = populateAccountCreation(eoa.address);
    const setupTx = await populateAccountSetup(
      { owner: eoa.address, account: safeAddress, chainId: 31337, nonce: 0 },
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
    const { safeAddress, config } = await loadFixture(setupAccount);

    const result = await evaluateAccount(safeAddress, config);

    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.allowance).to.equal(config.allowance);
  });

  it("calculates accrued allowance", async () => {
    const { eoa, relayer, safeAddress, config } =
      await loadFixture(setupAccount);

    const REFILL = 987;

    const timestamp = (await hre.ethers.provider.getBlock("latest"))
      ?.timestamp as number;

    const limitEnqueueTx = await populateLimitEnqueue(
      {
        owner: eoa.address,
        account: safeAddress,
        chainId: 31337,
        nonce: 0,
      },
      { period: 1000, refill: REFILL, balance: 0, timestamp },
      (...args) => eoa.signTypedData(...args)
    );
    await relayer.sendTransaction(limitEnqueueTx);

    // go forward3 minutes
    await mine(3, { interval: 60 });

    const limitExecuteTx = await populateLimitDispatch(safeAddress, {
      period: 1000,
      refill: REFILL,
      balance: 0,
      timestamp,
    });
    await relayer.sendTransaction(limitExecuteTx);

    let result = await evaluateAccount(safeAddress, config);
    expect(result.allowance).to.equal(0);

    // go forward 24 times one houre, one day
    await mine(2, { interval: 1000 });

    result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.allowance).to.equal(REFILL);
  });

  it("passes and reflects recent spending on the result", async () => {
    const { spender, receiver, relayer, safeAddress, config } =
      await loadFixture(setupAccount);

    let result = await evaluateAccount(safeAddress, config);

    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.allowance).to.equal(config.allowance);

    const justSpent = 23;
    const transaction = await populateSpend(
      {
        account: safeAddress,
        spender: spender.address,
        chainId: 31337,
        nonce: 0,
      },
      {
        token: GNO,
        to: receiver.address,
        amount: justSpent,
      },
      (...args) => spender.signTypedData(...args)
    );

    await relayer.sendTransaction(transaction);

    // run the query again, expect it to reflect the used amount
    result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.allowance).to.equal(Number(config.allowance) - justSpent);
  });

  it("fails when ownership isn't renounced", async () => {
    const { eoa, spender, relayer, safe, safeAddress, config } =
      await loadFixture(setupAccount);

    // ACCOUNT starts OK
    let result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    const reconfigTx = await safe.addOwnerWithThreshold.populateTransaction(
      await spender.getAddress(),
      2
    );

    // enqueue the change
    const enqueue = await populateExecEnqueue(
      { owner: eoa.address, account: safeAddress, chainId: 31337, nonce: 0 },
      reconfigTx,
      (...args) => eoa.signTypedData(...args)
    );
    await relayer.sendTransaction(enqueue);

    // FAIL: queue not empty
    result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(AccountIntegrityStatus.DelayQueueNotEmpty);

    // move 3 minutes forward, cooldown is 2 minutes
    await mine(4, { interval: 60 });
    const dispatch = await populateExecDispatch(safeAddress, reconfigTx);
    await relayer.sendTransaction(dispatch);

    // FAIL: no renounce ownership
    result = await evaluateAccount(safeAddress, config);
    expect(result.status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });
  it("fails when the number of modules enabled is not two", async () => {
    const { eoa, relayer, safe, safeAddress, config } =
      await loadFixture(setupAccount);

    const reconfig = await safe.enableModule.populateTransaction(
      "0x0000000000000000000000000000000000000005"
    );

    // enqueue the change
    const enqueue = await populateExecEnqueue(
      { owner: eoa.address, account: safeAddress, chainId: 31337, nonce: 0 },
      reconfig,
      (...args) => eoa.signTypedData(...args)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = await populateExecDispatch(safeAddress, reconfig);
    await relayer.sendTransaction(dispatch);

    const { status } = await evaluateAccount(safeAddress, config);
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });
  it("fails when roles module is not enabled", async () => {
    const { eoa, relayer, safe, safeAddress, config } =
      await loadFixture(setupAccount);

    const delayAddress = predictDelayAddress(safeAddress);
    const rolesAddress = predictRolesAddress(safeAddress);

    const reconfig = await safe.disableModule.populateTransaction(
      delayAddress,
      rolesAddress
    );

    // enqueue the change
    const enqueue = await populateExecEnqueue(
      { owner: eoa.address, account: safeAddress, chainId: 31337, nonce: 0 },
      reconfig,
      (...args) => eoa.signTypedData(...args)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = await populateExecDispatch(safeAddress, reconfig);
    await relayer.sendTransaction(dispatch);

    const { status } = await evaluateAccount(safeAddress, config);
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });
  it("fails when delay module is not enabled", async () => {
    const { safe, relayer, eoa, config } = await loadFixture(setupAccount);

    const safeAddress = await safe.getAddress();
    const delayAddress = predictDelayAddress(safeAddress);

    const reconfig = await safe.disableModule.populateTransaction(
      AddressOne,
      delayAddress
    );

    // enqueue the change
    const enqueue = await populateExecEnqueue(
      { owner: eoa.address, account: safeAddress, chainId: 31337, nonce: 0 },
      reconfig,
      (...args) => eoa.signTypedData(...args)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = await populateExecDispatch(safeAddress, reconfig);
    await relayer.sendTransaction(dispatch);

    const { status } = await evaluateAccount(safeAddress, config);
    expect(status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });
  it("fails when the safe is not the owner of delay", async () => {
    const { eoa, relayer, safeAddress, delay, config } =
      await loadFixture(setupAccount);

    await expect(await delay.owner()).to.equal(safeAddress);

    const reconfig = await delay.transferOwnership.populateTransaction(
      "0x000000000000000000000000000000000000000f"
    );

    // enqueue the change
    const enqueue = await populateExecEnqueue(
      { owner: eoa.address, account: safeAddress, chainId: 31337, nonce: 0 },
      reconfig,
      (...args) => eoa.signTypedData(...args)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = await populateExecDispatch(safeAddress, reconfig);
    await relayer.sendTransaction(dispatch);

    expect(await delay.owner()).to.equal(
      getAddress("0x000000000000000000000000000000000000000f")
    );

    const { status } = await evaluateAccount(safeAddress, config);
    expect(status).to.equal(AccountIntegrityStatus.DelayMisconfigured);
  });
  it("fails when cooldown is too short", async () => {
    const { eoa, relayer, delay, safeAddress, config } =
      await loadFixture(setupAccount);

    const reconfig = await delay.setTxCooldown.populateTransaction(5);

    // enqueue the change
    const enqueue = await populateExecEnqueue(
      { owner: eoa.address, account: safeAddress, chainId: 31337, nonce: 0 },
      reconfig,
      (...args) => eoa.signTypedData(...args)
    );
    await relayer.sendTransaction(enqueue);

    await mine(4, { interval: 60 });
    const dispatch = await populateExecDispatch(safeAddress, reconfig);
    await relayer.sendTransaction(dispatch);

    const { status } = await evaluateAccount(safeAddress, config);
    expect(status).to.equal(AccountIntegrityStatus.DelayMisconfigured);
  });
  it("fails when queue is not empty", async () => {
    const { eoa, relayer, delay, safeAddress, config } =
      await loadFixture(setupAccount);

    const reconfig = await delay.setTxCooldown.populateTransaction(5);

    // enqueue the change
    const enqueue = await populateExecEnqueue(
      { owner: eoa.address, account: safeAddress, chainId: 31337, nonce: 0 },
      reconfig,
      (...args) => eoa.signTypedData(...args)
    );
    await relayer.sendTransaction(enqueue);

    const { status } = await evaluateAccount(safeAddress, config);
    expect(status).to.equal(AccountIntegrityStatus.DelayQueueNotEmpty);
  });
});

async function evaluateAccount(account: string, config: AccountConfig) {
  const { to, data } = populateAccountQuery(account);
  const resultData = await hre.ethers.provider.send("eth_call", [{ to, data }]);
  return evaluateAccountQuery(
    { account, cooldown: config.cooldown },
    resultData
  );
}
