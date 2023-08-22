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

import {
  populateDelayDeploy,
  predictDelayAddress,
} from "../src/populate/delay-mod";

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

    const { to, data } = populateAccountCreationTransaction(owner.address, 1);

    await relayer.sendTransaction({ to, data });

    return { owner, safeAddress: predictedAccountAddress };
  }

  it("deploys and enables two mods via multisend", async () => {
    const { owner, safeAddress } = await loadFixture(createAccount);

    const proxyAddress = predictDelayAddress(safeAddress);
    const { to, data } = populateDelayDeploy(safeAddress);

    expect(await hre.ethers.provider.getCode(proxyAddress)).to.equal("0x");

    await owner.sendTransaction({ to, data });

    expect(await hre.ethers.provider.getCode(proxyAddress)).to.not.equal("0x");
  });

  it("sets up the account after creation", async () => {
    const hardhatChainId = 31337;

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

    const { domain, types, message } = signAccountSetupParams(
      owner.address,
      hardhatChainId,
      allowanceConfig,
      0
    );
    const signature = await owner._signTypedData(domain, types, message);

    const { to, data } = populateAccountSetupTransaction(
      owner.address,
      allowanceConfig,
      signature
    );

    const { allowanceAddress, delayAddress } = predictModuleAddresses(
      owner.address
    );

    expect(await safe.isModuleEnabled(allowanceAddress)).to.be.false;
    expect(await safe.isModuleEnabled(delayAddress)).to.be.false;

    await owner.sendTransaction({ to, data });

    expect(await safe.isModuleEnabled(allowanceAddress)).to.be.true;
    expect(await safe.isModuleEnabled(delayAddress)).to.be.true;
  });
});
