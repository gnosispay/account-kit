import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import hre from "hardhat";

import { DAI, createAccountSetupConfig, fork, forkReset } from "./setup";
import {
  evaluateAccountIntegrityQuery,
  paramsToSignAccountSetup,
  populateAccountCreationTransaction,
  populateAccountIntegrityQuery,
  populateAccountSetupTransaction,
  predictSafeAddress,
} from "../src";
import deployments from "../src/deployments";

describe.skip("account-integrity", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  async function setupAccount() {
    const [owner, , , alice, bob, relayer] = await hre.ethers.getSigners();

    const safeAddress = predictSafeAddress(owner.address);
    let transaction = populateAccountCreationTransaction(owner.address);

    await relayer.sendTransaction(transaction);

    const PERIOD = 7654;
    const AMOUNT = 123;

    const config = createAccountSetupConfig({
      spender: alice.address,
      period: PERIOD,
      token: DAI,
      amount: AMOUNT,
    });

    const { domain, types, message } = paramsToSignAccountSetup(
      safeAddress,
      31337, // chainId hardhat
      config
    );
    const signature = await owner.signTypedData(domain, types, message);

    transaction = populateAccountSetupTransaction(
      safeAddress,
      config,
      signature
    );

    await relayer.sendTransaction(transaction);

    return {
      owner,
      alice,
      bob,
      safeAddress: safeAddress,
    };
  }

  it("sketch", async () => {
    const { safeAddress, alice } = await loadFixture(setupAccount);
    const provider = hre.ethers.provider;

    const config = createAccountSetupConfig({
      spender: alice.address,
      token: DAI,
    });

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
  });

  it("passes for a well configured account", async () => {});

  it("passes and reflects recent spending on the result", async () => {});

  it("fails when the delay mod is not deployed", async () => {});

  it("fails when more than two modules are enabled", async () => {});

  it("fails when allowance module is not enabled", async () => {});

  it("fails when delay module is not enabled", async () => {});

  it("fails when cooldown is too short", async () => {});

  it("fails when queue is not empty", async () => {});
});
