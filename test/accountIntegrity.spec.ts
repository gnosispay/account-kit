import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress } from "ethers";
import hre from "hardhat";

import execSafeTransaction from "./test-helpers/execSafeTransaction";
import {
  DAI,
  DAI_WHALE,
  createAccountSetupConfig,
  fork,
  forkReset,
  moveERC20,
} from "./test-helpers/setup";
import {
  evaluateAccountIntegrityQuery,
  populateAccountCreationTransaction,
  populateAccountIntegrityQuery,
  populateAccountSetup,
  populateAllowanceTransfer,
  predictDelayAddress,
  predictSafeAddress,
} from "../src";
import deployments from "../src/deployments";
import { AccountIntegrityStatus } from "../src/types";
import { IDelayModule__factory, ISafe__factory } from "../typechain-types";

const AddressOne = "0x0000000000000000000000000000000000000001";
const AddressOther = "0x0000000000000000000000000000000000000009";

describe("account-integrity", () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  async function setupAccount() {
    const [owner, , , alice, bob, relayer] = await hre.ethers.getSigners();

    const safeAddress = predictSafeAddress(owner.address);
    await moveERC20(DAI_WHALE, safeAddress, DAI);

    await relayer.sendTransaction(
      populateAccountCreationTransaction(owner.address)
    );

    const config = createAccountSetupConfig({
      owner: owner.address,
      spender: alice.address,
      period: 7654,
      token: DAI,
      amount: 123,
    });

    const transaction = await populateAccountSetup(
      safeAddress,
      31337,
      config,
      0,
      (domain, types, message) => owner.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(transaction);

    return {
      owner,
      alice,
      bob,
      relayer,
      safeAddress: safeAddress,
      config,
    };
  }

  it("passes for a well configured account", async () => {
    const { safeAddress, config } = await loadFixture(setupAccount);
    const provider = hre.ethers.provider;

    const data = populateAccountIntegrityQuery(safeAddress, config);

    const resultData = await provider.send("eth_call", [
      {
        from: null,
        to: deployments.multicall.address,
        data,
      },
    ]);

    const result = await evaluateAccountIntegrityQuery(
      resultData,
      safeAddress,
      config
    );

    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.amount).to.equal(config.amount);
  });

  it("passes and reflects recent spending on the result", async () => {
    const { safeAddress, alice, relayer, config } =
      await loadFixture(setupAccount);
    const provider = hre.ethers.provider;

    const nonce = 1;

    const query = populateAccountIntegrityQuery(safeAddress, config);

    let resultData = await provider.send("eth_call", [
      {
        from: null,
        to: deployments.multicall.address,
        data: query,
      },
    ]);

    let result = await evaluateAccountIntegrityQuery(
      resultData,
      safeAddress,
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.amount).to.equal(config.amount);

    const justSpent = 23;
    const transaction = await populateAllowanceTransfer(
      safeAddress,
      31337,
      {
        spender: alice.address,
        token: DAI,
        to: ZeroAddress,
        amount: justSpent,
      },
      nonce,
      (message) => alice.signMessage(message)
    );
    await relayer.sendTransaction(transaction);

    // run the query again, expect it to reflect the used amount
    resultData = await provider.send("eth_call", [
      {
        from: null,
        to: deployments.multicall.address,
        data: query,
      },
    ]);

    result = await evaluateAccountIntegrityQuery(
      resultData,
      safeAddress,
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);
    expect(result.amount).to.equal(Number(config.amount) - justSpent);
  });

  it("fails when the number of modules enabled is not two", async () => {
    const { safeAddress, owner, relayer, config } =
      await loadFixture(setupAccount);
    const provider = hre.ethers.provider;

    const safe = ISafe__factory.connect(safeAddress, relayer);

    await execSafeTransaction(
      safe,
      await safe.enableModule.populateTransaction(
        "0x0000000000000000000000000000000000000009"
      ),
      owner
    );

    const query = populateAccountIntegrityQuery(safeAddress, config);

    const resultData = await provider.send("eth_call", [
      {
        from: null,
        to: deployments.multicall.address,
        data: query,
      },
    ]);

    const result = await evaluateAccountIntegrityQuery(
      resultData,
      safeAddress,
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when allowance module is not enabled", async () => {
    const { safeAddress, owner, relayer, config } =
      await loadFixture(setupAccount);
    const provider = hre.ethers.provider;

    const safe = ISafe__factory.connect(safeAddress, relayer);
    const allowanceAddress = deployments.allowanceSingleton.address;
    const delayAddress = predictDelayAddress(safeAddress);

    await execSafeTransaction(
      safe,
      await safe.disableModule.populateTransaction(
        delayAddress,
        allowanceAddress
      ),
      owner
    );

    await execSafeTransaction(
      safe,
      await safe.enableModule.populateTransaction(AddressOther),
      owner
    );

    const query = populateAccountIntegrityQuery(safeAddress, config);

    const resultData = await provider.send("eth_call", [
      {
        from: null,
        to: deployments.multicall.address,
        data: query,
      },
    ]);

    const result = await evaluateAccountIntegrityQuery(
      resultData,
      safeAddress,
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when delay module is not enabled", async () => {
    const { safeAddress, owner, relayer, config } =
      await loadFixture(setupAccount);
    const provider = hre.ethers.provider;

    const safe = ISafe__factory.connect(safeAddress, relayer);
    const delayAddress = predictDelayAddress(safeAddress);

    await execSafeTransaction(
      safe,
      await safe.disableModule.populateTransaction(AddressOne, delayAddress),
      owner
    );

    await execSafeTransaction(
      safe,
      await safe.enableModule.populateTransaction(AddressOther),
      owner
    );

    const query = populateAccountIntegrityQuery(safeAddress, config);

    const resultData = await provider.send("eth_call", [
      {
        from: null,
        to: deployments.multicall.address,
        data: query,
      },
    ]);

    const result = await evaluateAccountIntegrityQuery(
      resultData,
      safeAddress,
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.SafeMisconfigured);
  });

  it("fails when cooldown is too short", async () => {
    const { safeAddress, owner, relayer, config } =
      await loadFixture(setupAccount);

    const delayAddress = predictDelayAddress(safeAddress);

    const safe = ISafe__factory.connect(safeAddress, relayer);
    const delay = IDelayModule__factory.connect(delayAddress, relayer);

    const query = populateAccountIntegrityQuery(safeAddress, config);

    await execSafeTransaction(
      safe,
      await delay.setTxCooldown.populateTransaction(5),
      owner
    );

    const resultData = await hre.ethers.provider.send("eth_call", [
      {
        from: null,
        to: deployments.multicall.address,
        data: query,
      },
    ]);

    const result = await evaluateAccountIntegrityQuery(
      resultData,
      safeAddress,
      config
    );
    expect(result.status).to.equal(AccountIntegrityStatus.DelayMisconfigured);
  });

  it("fails when queue is not empty", async () => {
    const { safeAddress, owner, config } = await loadFixture(setupAccount);

    const delayAddress = predictDelayAddress(safeAddress);
    const delay = IDelayModule__factory.connect(delayAddress, owner);

    const integrityQuery = populateAccountIntegrityQuery(safeAddress, config);

    let resultData = await hre.ethers.provider.send("eth_call", [
      {
        from: null,
        to: deployments.multicall.address,
        data: integrityQuery,
      },
    ]);

    let result = await evaluateAccountIntegrityQuery(
      resultData,
      safeAddress,
      config
    );
    // everything is alright
    expect(result.status).to.equal(AccountIntegrityStatus.Ok);

    // enqueue a via delay
    await delay.execTransactionFromModule(AddressOther, 0, "0x", 0);

    resultData = await hre.ethers.provider.send("eth_call", [
      {
        from: null,
        to: deployments.multicall.address,
        data: integrityQuery,
      },
    ]);

    result = await evaluateAccountIntegrityQuery(
      resultData,
      safeAddress,
      config
    );
    // integrity fails
    expect(result.status).to.equal(AccountIntegrityStatus.DelayQueueNotEmpty);
  });
});
