import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import {
  createSetupConfig,
  postFixture,
  preFixture,
} from "./test-helpers/index";
import {
  populateAccountCreation,
  populateAccountSetup,
  predictAccountAddress,
} from "../src";

import { SPENDING_ALLOWANCE_KEY } from "../src/constants";
import { predictBouncerAddress } from "../src/parts/bouncer";

import { predictDelayAddress } from "../src/parts/delay";
import { predictRolesAddress } from "../src/parts/roles";
import {
  Bouncer__factory,
  IDelayModule__factory,
  IRolesModifier__factory,
  ISafe__factory,
  TestERC20__factory,
} from "../typechain-types";

describe("account-setup", () => {
  before(async () => {
    await preFixture();
  });

  after(async () => {
    await postFixture();
  });

  async function createAccount() {
    const [owner, spender, receiver, relayer] = await hre.ethers.getSigners();

    const erc20 = await (
      await hre.ethers.getContractFactory("TestERC20")
    ).deploy();
    const token = TestERC20__factory.connect(await erc20.getAddress(), relayer);

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
      token,
      safe: ISafe__factory.connect(account, hre.ethers.provider),
      roles: IRolesModifier__factory.connect(rolesAddress, hre.ethers.provider),
      delay: IDelayModule__factory.connect(delayAddress, hre.ethers.provider),
      rolesAddress,
      delayAddress,
    };
  }

  it("deploys bouncer", async () => {
    const { account, owner, spender, receiver, relayer, token, roles } =
      await loadFixture(createAccount);

    const provider = hre.ethers.provider;
    const config = createSetupConfig({
      token: await token.getAddress(),
      spender: spender.address,
      receiver: receiver.address,
    });

    const bouncerAddresss = predictBouncerAddress(account);
    const bouncer = Bouncer__factory.connect(
      bouncerAddresss,
      hre.ethers.provider
    );

    const transaction = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    expect(await provider.getCode(bouncer)).to.equal("0x");

    await relayer.sendTransaction(transaction);

    expect(await provider.getCode(bouncer)).to.not.equal("0x");

    expect(await bouncer.from()).to.equal(account);
    expect(await bouncer.to()).to.equal(await roles.getAddress());
    expect(await bouncer.selector()).to.equal(
      roles.interface.getFunction("setAllowance").selector
    );
  });

  it("renounces account ownership", async () => {
    const { account, owner, spender, receiver, relayer, token, safe } =
      await loadFixture(createAccount);

    const config = createSetupConfig({
      token: await token.getAddress(),
      spender: spender.address,
      receiver: receiver.address,
    });

    const transaction = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    await expect(relayer.sendTransaction(transaction)).to.not.be.reverted;

    expect(await safe.getOwners()).to.deep.equal([
      "0x0000000000000000000000000000000000000002",
    ]);
  });

  it("deploys and enables two mods", async () => {
    const { account, owner, spender, receiver, relayer, token, safe } =
      await loadFixture(createAccount);

    const provider = hre.ethers.provider;
    const config = createSetupConfig({
      token: await token.getAddress(),
      spender: spender.address,
      receiver: receiver.address,
    });

    const delayAddress = predictDelayAddress(account);
    const rolesAddress = predictRolesAddress(account);
    expect(delayAddress).to.not.equal(rolesAddress);

    const transaction = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
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
      token,
      safe,
      roles,
      rolesAddress,
    } = await loadFixture(createAccount);

    const PERIOD = 7654;
    const AMOUNT = 123;

    const config = createSetupConfig({
      spender: spender.address,
      receiver: receiver.address,
      timestamp: 432,
      period: PERIOD,
      token: await token.getAddress(),
      allowance: AMOUNT,
    });

    const bouncerAddress = predictBouncerAddress(account);

    expect(await safe.isModuleEnabled(rolesAddress)).to.be.false;

    const transaction = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    expect(await safe.isModuleEnabled(rolesAddress)).to.be.false;

    await relayer.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(rolesAddress)).to.be.true;
    expect(await roles.isModuleEnabled(owner.address)).to.be.false;
    expect(await roles.isModuleEnabled(spender.address)).to.be.true;
    expect(await roles.owner()).to.equal(bouncerAddress);

    const { balance, refill, maxRefill, period, timestamp } =
      await roles.allowances(SPENDING_ALLOWANCE_KEY);

    expect(balance).to.equal(AMOUNT);
    expect(refill).to.equal(AMOUNT);
    expect(maxRefill).to.equal(AMOUNT);
    expect(period).to.equal(PERIOD);
    expect(timestamp).to.equal(432);
  });

  it("correctly configures Delay", async () => {
    const { account, owner, spender, receiver, relayer, token, safe, delay } =
      await loadFixture(createAccount);

    const delayAddress = await delay.getAddress();
    const COOLDOWN = 60 * 3;
    const EXPIRATION = 60 * 30;

    const config = createSetupConfig({
      token: await token.getAddress(),
      spender: spender.address,
      receiver: receiver.address,
      cooldown: COOLDOWN,
      expiration: EXPIRATION,
    });

    const transaction = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    expect(await safe.isModuleEnabled(delayAddress)).to.be.false;

    await relayer.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(delayAddress)).to.be.true;
    expect(await delay.isModuleEnabled(owner.address)).to.be.true;
    expect(await delay.isModuleEnabled(spender.address)).to.be.false;
    expect(await delay.isModuleEnabled(receiver.address)).to.be.false;

    expect(await delay.owner()).to.equal(account);
    expect(await delay.txCooldown()).to.equal(COOLDOWN);
    expect(await delay.txExpiration()).to.equal(EXPIRATION);
    expect(await delay.queueNonce()).to.equal(await delay.txNonce());
  });
});
