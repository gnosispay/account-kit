import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import {
  GNO,
  createAccountConfig,
  fork,
  forkReset,
} from "./test-helpers/setup";
import {
  populateAccountCreation,
  populateAccountSetup,
  predictDelayAddress,
  predictRolesAddress,
  predictSafeAddress,
} from "../src";

import {
  IDelayModule__factory,
  IRolesModifier__factory,
  ISafe__factory,
} from "../typechain-types";
import { predictAllowanceAdminAddress } from "../src/entrypoints/predictSingletonAddress";
import { ALLOWANCE_KEY } from "../src/entrypoints/predictModuleAddress";

describe("account-setup", () => {
  before(async () => {
    await fork(29800000);
  });

  after(async () => {
    await forkReset();
  });

  async function createAccount() {
    const [owner, , , alice, bob, charlie] = await hre.ethers.getSigners();

    const transaction = populateAccountCreation(owner.address);

    const safeAddress = predictSafeAddress(owner.address);
    const rolesAddress = predictRolesAddress(safeAddress);
    const delayAddress = predictDelayAddress(safeAddress);
    const forwarderAddress = predictAllowanceAdminAddress(
      owner.address,
      rolesAddress
    );

    await charlie.sendTransaction(transaction);

    return {
      owner,
      alice,
      bob,
      charlie,
      safe: ISafe__factory.connect(safeAddress, hre.ethers.provider),
      rolesModifier: IRolesModifier__factory.connect(
        rolesAddress,
        hre.ethers.provider
      ),
      delayModule: IDelayModule__factory.connect(
        delayAddress,
        hre.ethers.provider
      ),
      safeAddress: safeAddress,
      rolesAddress,
      delayAddress,
      forwarderAddress,
    };
  }

  it("setup deploys and enables two mods", async () => {
    const { owner, alice, bob, safe, safeAddress } =
      await loadFixture(createAccount);

    const provider = hre.ethers.provider;
    const config = createAccountConfig({
      owner: owner.address,
      spender: alice.address,
      receiver: bob.address,
    });

    const delayAddress = predictDelayAddress(safeAddress);
    const rolesAddress = predictRolesAddress(safeAddress);
    expect(delayAddress).to.not.equal(rolesAddress);

    const transaction = await populateAccountSetup(
      { account: safeAddress, chainId: 31337, nonce: 0 },
      config,
      (...args) => owner.signTypedData(...args)
    );

    expect(await provider.getCode(delayAddress)).to.equal("0x");
    expect(await safe.isModuleEnabled(delayAddress)).to.be.false;
    expect(await provider.getCode(rolesAddress)).to.equal("0x");
    expect(await safe.isModuleEnabled(rolesAddress)).to.be.false;

    await alice.sendTransaction(transaction);

    expect(await provider.getCode(rolesAddress)).to.not.equal("0x");
    expect(await safe.isModuleEnabled(rolesAddress)).to.be.true;
    expect(await provider.getCode(delayAddress)).to.not.equal("0x");
    expect(await safe.isModuleEnabled(delayAddress)).to.be.true;
  });

  it("setup correctly configures Roles", async () => {
    const {
      owner,
      alice,
      bob,
      charlie,
      safe,
      rolesModifier,
      safeAddress,
      rolesAddress,
      forwarderAddress,
    } = await loadFixture(createAccount);

    const PERIOD = 7654;
    const AMOUNT = 123;

    const account = createAccountConfig({
      owner: owner.address,
      spender: alice.address,
      receiver: bob.address,
      period: PERIOD,
      token: GNO,
      amount: AMOUNT,
    });

    expect(await safe.isModuleEnabled(rolesAddress)).to.be.false;

    const transaction = await populateAccountSetup(
      { account: safeAddress, chainId: 31337, nonce: 0 },
      account,
      (...args) => owner.signTypedData(...args)
    );
    await charlie.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(rolesAddress)).to.be.true;
    expect(await rolesModifier.owner()).to.equal(forwarderAddress);

    const {
      refillAmount,
      refillInterval,
      refillTimestamp,
      balance,
      maxBalance,
    } = await rolesModifier.allowances(ALLOWANCE_KEY);
    expect(refillAmount).to.equal(AMOUNT);
    expect(refillInterval).to.equal(PERIOD);
    expect(refillTimestamp).to.equal(0);
    expect(balance).to.equal(AMOUNT);
    expect(maxBalance).to.equal(AMOUNT);
  });

  it("setup correctly configures delay", async () => {
    const { owner, alice, bob, safe, delayModule } =
      await loadFixture(createAccount);

    const safeAddress = await safe.getAddress();
    const delayAddress = await delayModule.getAddress();
    const COOLDOWN = 9999;

    const account = createAccountConfig({
      owner: owner.address,
      spender: alice.address,
      receiver: bob.address,
      cooldown: COOLDOWN,
    });

    const transaction = await populateAccountSetup(
      { account: safeAddress, chainId: 31337, nonce: 0 },
      account,
      (...args) => owner.signTypedData(...args)
    );

    await bob.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(delayAddress)).to.be.true;
    expect(await delayModule.owner()).to.equal(safeAddress);
    expect(await delayModule.txCooldown()).to.equal(9999);
    expect(await delayModule.queueNonce()).to.equal(
      await delayModule.txNonce()
    );
  });
});
