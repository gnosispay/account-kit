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
  predictAccountAddress,
} from "../src";

import { ALLOWANCE_SPENDING_KEY } from "../src/constants";
import {
  predictOwnerChannelAddress,
  predictSpenderChannelAddress,
} from "../src/deployers/channel";
import { predictDelayAddress } from "../src/deployers/delay";
import { predictForwarderAddress } from "../src/deployers/forwarder";
import { predictRolesAddress } from "../src/deployers/roles";
import {
  IDelayModule__factory,
  IRolesModifier__factory,
  ISafe__factory,
  SinglePurposeForwarder__factory,
} from "../typechain-types";

describe("account-setup", () => {
  before(async () => {
    await fork(29800000);
  });

  after(async () => {
    await forkReset();
  });

  async function createAccount() {
    const [eoa, spender, receiver, relayer] = await hre.ethers.getSigners();

    const transaction = populateAccountCreation(eoa.address);

    const safeAddress = predictAccountAddress(eoa.address);
    const rolesAddress = predictRolesAddress(safeAddress);
    const delayAddress = predictDelayAddress(safeAddress);

    await relayer.sendTransaction(transaction);

    return {
      eoa,
      spender,
      receiver,
      relayer,
      safe: ISafe__factory.connect(safeAddress, hre.ethers.provider),
      roles: IRolesModifier__factory.connect(rolesAddress, hre.ethers.provider),
      delay: IDelayModule__factory.connect(delayAddress, hre.ethers.provider),
      safeAddress,
      rolesAddress,
      delayAddress,
    };
  }

  it("deploys forwarder", async () => {
    const { eoa, spender, receiver, relayer, safeAddress, roles } =
      await loadFixture(createAccount);

    const provider = hre.ethers.provider;
    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
    });

    const forwarderAddresss = predictForwarderAddress({
      safe: safeAddress,
    });
    const forwarder = SinglePurposeForwarder__factory.connect(
      forwarderAddresss,
      hre.ethers.provider
    );

    const transaction = await populateAccountSetup(
      { eoa: eoa.address, safe: safeAddress, chainId: 31337, nonce: 0 },
      config,
      (...args) => eoa.signTypedData(...args)
    );
    expect(await provider.getCode(forwarderAddresss)).to.equal("0x");

    await relayer.sendTransaction(transaction);

    expect(await provider.getCode(forwarderAddresss)).to.not.equal("0x");

    expect(await forwarder.from()).to.equal(safeAddress);
    expect(await forwarder.to()).to.equal(await roles.getAddress());
    expect(await forwarder.selector()).to.equal(
      roles.interface.getFunction("setAllowance").selector
    );
  });

  it("deploys the owner and spender channels", async () => {
    const { eoa, spender, receiver, relayer, safeAddress } =
      await loadFixture(createAccount);

    const provider = hre.ethers.provider;
    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
    });

    const ownerChannelAddress = predictOwnerChannelAddress({
      eoa: eoa.address,
      safe: safeAddress,
    });
    const spenderChannelAddress = predictSpenderChannelAddress({
      safe: safeAddress,
      spender: spender.address,
    });

    const ownerChannel = ISafe__factory.connect(ownerChannelAddress, provider);
    const spenderChannel = ISafe__factory.connect(
      spenderChannelAddress,
      provider
    );

    const transaction = await populateAccountSetup(
      { eoa: eoa.address, safe: safeAddress, chainId: 31337, nonce: 0 },
      config,
      (...args) => eoa.signTypedData(...args)
    );
    expect(await provider.getCode(ownerChannelAddress)).to.equal("0x");
    expect(await provider.getCode(spenderChannelAddress)).to.equal("0x");

    await relayer.sendTransaction(transaction);

    expect(await provider.getCode(ownerChannelAddress)).to.not.equal("0x");
    expect(await provider.getCode(spenderChannelAddress)).to.not.equal("0x");
    expect(await ownerChannel.getThreshold()).to.equal(1);
    expect(await ownerChannel.isOwner(eoa.address)).to.be.true;
    expect(await spenderChannel.getThreshold()).to.equal(1);
    expect(await spenderChannel.isOwner(spender.address)).to.be.true;
  });

  it("renounces account ownership", async () => {
    const { eoa, spender, receiver, relayer, safe, safeAddress } =
      await loadFixture(createAccount);

    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
    });

    const transaction = await populateAccountSetup(
      { eoa: eoa.address, safe: safeAddress, chainId: 31337, nonce: 0 },
      config,
      (...args) => eoa.signTypedData(...args)
    );

    await expect(relayer.sendTransaction(transaction)).to.not.be.reverted;

    expect(await safe.getOwners()).to.deep.equal([
      "0x0000000000000000000000000000000000000002",
    ]);
  });

  it("deploys and enables two mods", async () => {
    const { eoa, spender, receiver, relayer, safe, safeAddress } =
      await loadFixture(createAccount);

    const provider = hre.ethers.provider;
    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
    });

    const delayAddress = predictDelayAddress(safeAddress);
    const rolesAddress = predictRolesAddress(safeAddress);
    expect(delayAddress).to.not.equal(rolesAddress);

    const transaction = await populateAccountSetup(
      { eoa: eoa.address, safe: safeAddress, chainId: 31337, nonce: 0 },
      config,
      (...args) => eoa.signTypedData(...args)
    );

    expect(await provider.getCode(delayAddress)).to.equal("0x");
    expect(await safe.isModuleEnabled(delayAddress)).to.be.false;
    expect(await provider.getCode(rolesAddress)).to.equal("0x");
    expect(await safe.isModuleEnabled(rolesAddress)).to.be.false;

    await relayer.sendTransaction(transaction);

    expect(await provider.getCode(rolesAddress)).to.not.equal("0x");
    expect(await safe.isModuleEnabled(rolesAddress)).to.be.true;
    expect(await provider.getCode(delayAddress)).to.not.equal("0x");
    expect(await safe.isModuleEnabled(delayAddress)).to.be.true;
  });

  it("correctly configures Roles", async () => {
    const {
      eoa,
      spender,
      receiver,
      relayer,
      safe,
      roles,
      safeAddress,
      rolesAddress,
    } = await loadFixture(createAccount);

    const PERIOD = 7654;
    const AMOUNT = 123;

    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
      period: PERIOD,
      token: GNO,
      allowance: AMOUNT,
    });

    const forwarderAddress = predictForwarderAddress({
      safe: safeAddress,
    });

    const spenderChannelAddress = predictSpenderChannelAddress({
      safe: safeAddress,
      spender: spender.address,
    });

    expect(await safe.isModuleEnabled(rolesAddress)).to.be.false;

    const transaction = await populateAccountSetup(
      { eoa: eoa.address, safe: safeAddress, chainId: 31337, nonce: 0 },
      config,
      (...args) => eoa.signTypedData(...args)
    );
    await relayer.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(rolesAddress)).to.be.true;
    expect(await roles.isModuleEnabled(eoa.address)).to.be.false;
    expect(await roles.isModuleEnabled(spender.address)).to.be.false;
    expect(await roles.isModuleEnabled(spenderChannelAddress)).to.be.true;
    expect(await roles.owner()).to.equal(forwarderAddress);

    const {
      refillAmount,
      refillInterval,
      refillTimestamp,
      balance,
      maxBalance,
    } = await roles.allowances(ALLOWANCE_SPENDING_KEY);

    expect(refillAmount).to.equal(AMOUNT);
    expect(refillInterval).to.equal(PERIOD);
    expect(refillTimestamp).to.equal(0);
    expect(balance).to.equal(AMOUNT);
    expect(maxBalance).to.equal(AMOUNT);
  });

  it("correctly configures Delay", async () => {
    const { eoa, spender, receiver, relayer, safe, delay } =
      await loadFixture(createAccount);

    const safeAddress = await safe.getAddress();
    const delayAddress = await delay.getAddress();
    const COOLDOWN = 9999;

    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
      cooldown: COOLDOWN,
    });

    const ownerChannelAddress = predictOwnerChannelAddress({
      eoa: eoa.address,
      safe: safeAddress,
    });

    const transaction = await populateAccountSetup(
      { eoa: eoa.address, safe: safeAddress, chainId: 31337, nonce: 0 },
      config,
      (...args) => eoa.signTypedData(...args)
    );

    await relayer.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(delayAddress)).to.be.true;

    expect(await delay.isModuleEnabled(eoa.address)).to.be.false;
    expect(await delay.isModuleEnabled(spender.address)).to.be.false;
    expect(await delay.isModuleEnabled(receiver.address)).to.be.false;
    expect(await delay.isModuleEnabled(ownerChannelAddress)).to.be.true;

    expect(await delay.owner()).to.equal(safeAddress);
    expect(await delay.txCooldown()).to.equal(9999);
    expect(await delay.queueNonce()).to.equal(await delay.txNonce());
  });
});
