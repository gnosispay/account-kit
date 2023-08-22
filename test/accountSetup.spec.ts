import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { ISafe__factory } from "../typechain-types";

import { DAI, fork, forkReset } from "./setup";
import {
  populateAccountCreationTransaction,
  populateAccountSetupTransaction,
  predictModuleAddresses,
  predictSafeAddress,
  signAccountSetupParams,
} from "../src";

import { populateDelayDeploy } from "../src/populate/delay-mod";

describe("accountSetup", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  async function createAccount() {
    const [owner, , , relayer] = await hre.ethers.getSigners();

    const predictedAccountAddress = predictSafeAddress(owner.address);

    const { to, data } = populateAccountCreationTransaction(owner.address);

    await relayer.sendTransaction({ to, data });

    return { owner, safeAddress: predictedAccountAddress };
  }

  it("deploys a delay mod", async () => {
    const { owner, safeAddress } = await loadFixture(createAccount);

    const { delayModAddress } = predictModuleAddresses(safeAddress);

    expect(await hre.ethers.provider.getCode(delayModAddress)).to.equal("0x");

    await owner.sendTransaction(populateDelayDeploy(safeAddress));

    expect(await hre.ethers.provider.getCode(delayModAddress)).to.not.equal(
      "0x"
    );
  });

  it("enables two mods after running set up", async () => {
    const { owner, safeAddress } = await loadFixture(createAccount);
    const [, , , , , spender] = await hre.ethers.getSigners();

    const safe = ISafe__factory.connect(safeAddress, hre.ethers.provider);
    expect(await safe.isOwner(owner.address)).to.be.true;

    const allowanceConfig = {
      spender: spender.address,
      token: DAI,
      amount: 1000000,
      period: 60 * 24, // 1 day
    };

    const delayConfig = {
      cooldown: 60 * 20, // 20 minutes
    };

    const { domain, types, message } = signAccountSetupParams(
      safeAddress,
      31337, // chainId hardhat
      allowanceConfig,
      delayConfig,
      0
    );
    const signature = await owner._signTypedData(domain, types, message);

    const accountSetupTransaction = populateAccountSetupTransaction(
      safeAddress,
      allowanceConfig,
      delayConfig,
      signature
    );

    const { allowanceModAddress, delayModAddress } =
      predictModuleAddresses(safeAddress);

    expect(await safe.isModuleEnabled(allowanceModAddress)).to.be.false;
    expect(await safe.isModuleEnabled(delayModAddress)).to.be.false;

    await owner.sendTransaction(accountSetupTransaction);

    expect(await safe.isModuleEnabled(allowanceModAddress)).to.be.true;
    expect(await safe.isModuleEnabled(delayModAddress)).to.be.true;
  });
});
