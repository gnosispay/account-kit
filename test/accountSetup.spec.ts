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
  predictForwarderAddress,
  predictRolesAddress,
  predictSafeAddress,
} from "../src";

import {
  IDelayModule__factory,
  IRolesModifier__factory,
  ISafe__factory,
} from "../typechain-types";

import { ALLOWANCE_KEY } from "../src/entrypoints/predictModuleAddress";

describe.only("account-setup", () => {
  before(async () => {
    await fork(29800000);
  });

  after(async () => {
    await forkReset();
  });

  async function createAccount() {
    const [owner, spender, receiver, relayer] = await hre.ethers.getSigners();

    const transaction = populateAccountCreation(owner.address);

    const safeAddress = predictSafeAddress(owner.address);
    const rolesAddress = predictRolesAddress(safeAddress);
    const delayAddress = predictDelayAddress(safeAddress);
    const forwarderAddress = predictForwarderAddress({
      owner: owner.address,
      safe: safeAddress,
    });

    await relayer.sendTransaction(transaction);

    return {
      owner,
      spender,
      receiver,
      relayer,
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
    const {
      owner,
      spender,
      receiver,
      relayer,
      safe,
      safeAddress,
      forwarderAddress,
    } = await loadFixture(createAccount);

    const provider = hre.ethers.provider;
    const config = createAccountConfig({
      owner: owner.address,
      spender: spender.address,
      receiver: receiver.address,
    });

    const delayAddress = predictDelayAddress(safeAddress);
    const rolesAddress = predictRolesAddress(safeAddress);
    expect(delayAddress).to.not.equal(rolesAddress);

    const transaction = await populateAccountSetup(
      { account: safeAddress, chainId: 31337, nonce: 0 },
      config,
      (...args) => owner.signTypedData(...args)
    );

    expect(await provider.getCode(forwarderAddress)).to.equal("0x");
    expect(await provider.getCode(delayAddress)).to.equal("0x");
    expect(await safe.isModuleEnabled(delayAddress)).to.be.false;
    expect(await provider.getCode(rolesAddress)).to.equal("0x");
    expect(await safe.isModuleEnabled(rolesAddress)).to.be.false;

    await relayer.sendTransaction(transaction);

    expect(await provider.getCode(forwarderAddress)).to.not.equal("0x");
    expect(await provider.getCode(rolesAddress)).to.not.equal("0x");
    expect(await safe.isModuleEnabled(rolesAddress)).to.be.true;
    expect(await provider.getCode(delayAddress)).to.not.equal("0x");
    expect(await safe.isModuleEnabled(delayAddress)).to.be.true;
  });

  it("setup correctly configures Roles", async () => {
    const {
      owner,
      spender,
      receiver,
      relayer,
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
      spender: spender.address,
      receiver: receiver.address,
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
    await relayer.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(rolesAddress)).to.be.true;
    expect(await rolesModifier.owner()).to.equal(forwarderAddress);

    expect(await rolesModifier.isModuleEnabled(owner.address)).to.be.false;
    expect(await rolesModifier.isModuleEnabled(spender.address)).to.be.true;
    expect(await rolesModifier.isModuleEnabled(receiver.address)).to.be.false;

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

  it("setup correctly configures Delay", async () => {
    const { owner, spender, receiver, relayer, safe, delayModule } =
      await loadFixture(createAccount);

    const safeAddress = await safe.getAddress();
    const delayAddress = await delayModule.getAddress();
    const COOLDOWN = 9999;

    const account = createAccountConfig({
      owner: owner.address,
      spender: spender.address,
      receiver: receiver.address,
      cooldown: COOLDOWN,
    });

    const transaction = await populateAccountSetup(
      { account: safeAddress, chainId: 31337, nonce: 0 },
      account,
      (...args) => owner.signTypedData(...args)
    );

    await relayer.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(delayAddress)).to.be.true;

    expect(await delayModule.isModuleEnabled(owner.address)).to.be.true;
    expect(await delayModule.isModuleEnabled(spender.address)).to.be.false;
    expect(await delayModule.isModuleEnabled(receiver.address)).to.be.false;

    expect(await delayModule.owner()).to.equal(safeAddress);
    expect(await delayModule.txCooldown()).to.equal(9999);
    expect(await delayModule.queueNonce()).to.equal(
      await delayModule.txNonce()
    );
  });
});
