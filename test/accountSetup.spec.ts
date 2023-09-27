import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import { GNO, createAccountConfig, fork, forkReset } from "./setup";
import {
  populateAccountCreation,
  populateAccountSetup,
  predictAccountAddress,
} from "../src";

import { SPENDING_ALLOWANCE_KEY } from "../src/constants";
import {
  predictOwnerChannelAddress,
  predictSpenderChannelAddress,
} from "../src/parts/channel";
import { predictDelayAddress } from "../src/parts/delay";
import { predictForwarderAddress } from "../src/parts/forwarder";
import { predictRolesAddress } from "../src/parts/roles";
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
    const [owner, spender, receiver, relayer] = await hre.ethers.getSigners();

    const transaction = populateAccountCreation(owner.address);

    const account = predictAccountAddress(owner.address);
    const rolesAddress = predictRolesAddress(account);
    const delayAddress = predictDelayAddress(account);

    await relayer.sendTransaction(transaction);

    return {
      account,
      owner,
      spender,
      receiver,
      relayer,
      safe: ISafe__factory.connect(account, hre.ethers.provider),
      roles: IRolesModifier__factory.connect(rolesAddress, hre.ethers.provider),
      delay: IDelayModule__factory.connect(delayAddress, hre.ethers.provider),
      rolesAddress,
      delayAddress,
    };
  }

  it("deploys forwarder", async () => {
    const { account, owner, spender, receiver, relayer, roles } =
      await loadFixture(createAccount);

    const provider = hre.ethers.provider;
    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
    });

    const forwarderAddresss = predictForwarderAddress(account);
    const forwarder = SinglePurposeForwarder__factory.connect(
      forwarderAddresss,
      hre.ethers.provider
    );

    const transaction = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      (...args) => owner.signTypedData(...args)
    );
    expect(await provider.getCode(forwarderAddresss)).to.equal("0x");

    await relayer.sendTransaction(transaction);

    expect(await provider.getCode(forwarderAddresss)).to.not.equal("0x");

    expect(await forwarder.from()).to.equal(account);
    expect(await forwarder.to()).to.equal(await roles.getAddress());
    expect(await forwarder.selector()).to.equal(
      roles.interface.getFunction("setAllowance").selector
    );
  });

  it("deploys the owner and spender channels", async () => {
    const { account, owner, spender, receiver, relayer } =
      await loadFixture(createAccount);

    const provider = hre.ethers.provider;
    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
    });

    const ownerChannelAddress = predictOwnerChannelAddress({
      account,
      owner: owner.address,
    });
    const spenderChannelAddress = predictSpenderChannelAddress({
      account,
      spender: spender.address,
    });

    const ownerChannel = ISafe__factory.connect(ownerChannelAddress, provider);
    const spenderChannel = ISafe__factory.connect(
      spenderChannelAddress,
      provider
    );

    const transaction = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      (...args) => owner.signTypedData(...args)
    );
    expect(await provider.getCode(ownerChannelAddress)).to.equal("0x");
    expect(await provider.getCode(spenderChannelAddress)).to.equal("0x");

    await relayer.sendTransaction(transaction);

    expect(await provider.getCode(ownerChannelAddress)).to.not.equal("0x");
    expect(await provider.getCode(spenderChannelAddress)).to.not.equal("0x");
    expect(await ownerChannel.getThreshold()).to.equal(1);
    expect(await ownerChannel.isOwner(owner.address)).to.be.true;
    expect(await spenderChannel.getThreshold()).to.equal(1);
    expect(await spenderChannel.isOwner(spender.address)).to.be.true;
  });

  it("renounces account ownership", async () => {
    const { account, owner, spender, receiver, relayer, safe } =
      await loadFixture(createAccount);

    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
    });

    const transaction = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      (...args) => owner.signTypedData(...args)
    );

    await expect(relayer.sendTransaction(transaction)).to.not.be.reverted;

    expect(await safe.getOwners()).to.deep.equal([
      "0x0000000000000000000000000000000000000002",
    ]);
  });

  it("deploys and enables two mods", async () => {
    const { account, owner, spender, receiver, relayer, safe } =
      await loadFixture(createAccount);

    const provider = hre.ethers.provider;
    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
    });

    const delayAddress = predictDelayAddress(account);
    const rolesAddress = predictRolesAddress(account);
    expect(delayAddress).to.not.equal(rolesAddress);

    const transaction = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      (...args) => owner.signTypedData(...args)
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
      account,
      owner,
      spender,
      receiver,
      relayer,
      safe,
      roles,
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

    const forwarderAddress = predictForwarderAddress(account);

    const spenderChannelAddress = predictSpenderChannelAddress({
      account,
      spender: spender.address,
    });

    expect(await safe.isModuleEnabled(rolesAddress)).to.be.false;

    const transaction = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      (...args) => owner.signTypedData(...args)
    );
    await relayer.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(rolesAddress)).to.be.true;
    expect(await roles.isModuleEnabled(owner.address)).to.be.false;
    expect(await roles.isModuleEnabled(spender.address)).to.be.false;
    expect(await roles.isModuleEnabled(spenderChannelAddress)).to.be.true;
    expect(await roles.owner()).to.equal(forwarderAddress);

    const {
      refillAmount,
      refillInterval,
      refillTimestamp,
      balance,
      maxBalance,
    } = await roles.allowances(SPENDING_ALLOWANCE_KEY);

    expect(refillAmount).to.equal(AMOUNT);
    expect(refillInterval).to.equal(PERIOD);
    expect(refillTimestamp).to.equal(0);
    expect(balance).to.equal(AMOUNT);
    expect(maxBalance).to.equal(AMOUNT);
  });

  it("correctly configures Delay", async () => {
    const { account, owner, spender, receiver, relayer, safe, delay } =
      await loadFixture(createAccount);

    const delayAddress = await delay.getAddress();
    const COOLDOWN = 9999;

    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
      cooldown: COOLDOWN,
    });

    const ownerChannelAddress = predictOwnerChannelAddress({
      account,
      owner: owner.address,
    });

    const transaction = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      (...args) => owner.signTypedData(...args)
    );

    await relayer.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(delayAddress)).to.be.true;

    expect(await delay.isModuleEnabled(owner.address)).to.be.false;
    expect(await delay.isModuleEnabled(spender.address)).to.be.false;
    expect(await delay.isModuleEnabled(receiver.address)).to.be.false;
    expect(await delay.isModuleEnabled(ownerChannelAddress)).to.be.true;

    expect(await delay.owner()).to.equal(account);
    expect(await delay.txCooldown()).to.equal(9999);
    expect(await delay.queueNonce()).to.equal(await delay.txNonce());
  });
});
