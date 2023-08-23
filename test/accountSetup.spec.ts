import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import {
  IAllowanceMod__factory,
  IDelayMod__factory,
  ISafe__factory,
} from "../typechain-types";

import { DAI, createAccountSetupConfig, fork, forkReset } from "./setup";
import {
  paramsToSignAccountSetup,
  populateAccountCreationTransaction,
  populateAccountSetupTransaction,
  predictModuleAddresses,
  predictSafeAddress,
} from "../src";

describe("accountSetup", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  async function createAccount() {
    const [owner, , , alice, bob, charlie] = await hre.ethers.getSigners();

    const safeAddress = predictSafeAddress(owner.address);
    const transaction = populateAccountCreationTransaction(owner.address);

    const { delayModAddress, allowanceModAddress } =
      predictModuleAddresses(safeAddress);

    await charlie.sendTransaction(transaction);

    return {
      owner,
      alice,
      bob,
      charlie,
      safeAddress: safeAddress,
      safe: ISafe__factory.connect(safeAddress, hre.ethers.provider),
      delayMod: IDelayMod__factory.connect(
        delayModAddress,
        hre.ethers.provider
      ),
      allowanceMod: IAllowanceMod__factory.connect(
        allowanceModAddress,
        hre.ethers.provider
      ),
    };
  }

  it("setup enables two mods", async () => {
    const { owner, alice, safe, safeAddress } = await loadFixture(
      createAccount
    );

    const config = createAccountSetupConfig({ spender: alice.address });

    const { domain, types, message } = paramsToSignAccountSetup(
      safeAddress,
      31337, // chainId hardhat
      config
    );
    const signature = await owner._signTypedData(domain, types, message);

    const transaction = populateAccountSetupTransaction(
      safeAddress,
      config,
      signature
    );

    const { allowanceModAddress, delayModAddress } =
      predictModuleAddresses(safeAddress);

    expect(await safe.isModuleEnabled(allowanceModAddress)).to.be.false;
    expect(await safe.isModuleEnabled(delayModAddress)).to.be.false;

    await alice.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(allowanceModAddress)).to.be.true;
    expect(await safe.isModuleEnabled(delayModAddress)).to.be.true;
  });

  it("setup correctly configures allowance", async () => {
    const { owner, alice, bob, safe, allowanceMod } = await loadFixture(
      createAccount
    );

    const spender = alice;
    const PERIOD = 7654;
    const AMOUNT = 123;

    const config = createAccountSetupConfig({
      spender: alice.address,
      period: PERIOD,
      token: DAI,
      amount: AMOUNT,
    });

    const { domain, types, message } = paramsToSignAccountSetup(
      safe.address,
      31337, // chainId hardhat
      config
    );
    const signature = await owner._signTypedData(domain, types, message);

    const transaction = populateAccountSetupTransaction(
      safe.address,
      config,
      signature
    );

    await bob.sendTransaction(transaction);

    const [amount, spent, period, , nonce] =
      await allowanceMod.getTokenAllowance(safe.address, spender.address, DAI);

    expect(amount).to.equal(AMOUNT);
    expect(spent).to.equal(0);
    expect(period).to.equal(PERIOD);
    expect(nonce).to.equal(1); // allowance token 1 means new

    expect(await safe.isModuleEnabled(allowanceMod.address)).to.be.true;
  });

  it("setup correctly configures delay", async () => {
    const { owner, alice, bob, safe, delayMod } = await loadFixture(
      createAccount
    );

    const COOLDOWN = 9999;

    const config = createAccountSetupConfig({
      spender: alice.address,
      cooldown: COOLDOWN,
    });

    const { domain, types, message } = paramsToSignAccountSetup(
      safe.address,
      31337, // chainId hardhat
      config
    );
    const signature = await owner._signTypedData(domain, types, message);

    const transaction = populateAccountSetupTransaction(
      safe.address,
      config,
      signature
    );

    await bob.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(delayMod.address)).to.be.true;
    expect(await delayMod.txCooldown()).to.equal(9999);
    expect(await delayMod.queueNonce()).to.equal(await delayMod.txNonce());
  });
});
