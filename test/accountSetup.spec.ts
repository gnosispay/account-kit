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
  populateDelayDeployTransaction,
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
    const { to, data } = populateDelayDeployTransaction(safeAddress);

    expect(await hre.ethers.provider.getCode(proxyAddress)).to.equal("0x");

    await owner.sendTransaction({ to, data });

    expect(await hre.ethers.provider.getCode(proxyAddress)).to.not.equal("0x");
  });

  it("sets up the account after creation", async () => {
    // we are forking mainnet
    const forkChainId = 1;
    // we are executing in hardhat
    const executionChainId = 31337;

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
      forkChainId,
      allowanceConfig,
      0
    );
    const signature = await owner._signTypedData(
      // we need to patch the chain id because we are actually running this
      // in a hardhat fork, so chainId 31337
      { ...domain, chainId: executionChainId },
      types,
      message
    );

    const { to, data } = populateAccountSetupTransaction(
      owner.address,
      forkChainId,
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
