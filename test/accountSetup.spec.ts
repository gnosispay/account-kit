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

import { predictDelayModAddress } from "../src/parts/delayMod";
import { predictRolesModAddress } from "../src/parts/rolesMod";
import {
  Bouncer__factory,
  IDelayModifier__factory,
  IRolesModifier__factory,
  ISafe__factory,
} from "../typechain-types";

describe("account-setup", () => {
  before(async () => {
    await preFixture();
  });

  after(async () => {
    await postFixture();
  });

  async function createAccount() {
    const [user, spender, receiver, relayer] = await hre.ethers.getSigners();

    const account = predictAccountAddress({ owner: user.address });
    const creationTx = populateAccountCreation({ owner: user.address });
    const rolesModAddress = predictRolesModAddress(account);
    const delayModAddress = predictDelayModAddress(account);

    await relayer.sendTransaction(creationTx);

    return {
      user,
      spender,
      receiver,
      relayer,
      account,
      rolesMod: IRolesModifier__factory.connect(
        rolesModAddress,
        hre.ethers.provider
      ),
      delayMod: IDelayModifier__factory.connect(
        delayModAddress,
        hre.ethers.provider
      ),
    };
  }

  it("deploys bouncer", async () => {
    const { account, user, spender, relayer, rolesMod } =
      await loadFixture(createAccount);

    const provider = hre.ethers.provider;

    const config = createSetupConfig({
      spender: spender.address,
    });

    const bouncerAddress = predictBouncerAddress(account);
    const bouncer = Bouncer__factory.connect(
      bouncerAddress,
      hre.ethers.provider
    );
    const setupTx = await populateAccountSetup(
      { owner: user.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) => user.signTypedData(domain, types, message)
    );

    expect(await provider.getCode(bouncer)).to.equal("0x");

    await relayer.sendTransaction(setupTx);
    expect(await provider.getCode(bouncer)).to.not.equal("0x");

    expect(await bouncer.from()).to.equal(account);
    expect(await bouncer.to()).to.equal(await rolesMod.getAddress());
    expect(await bouncer.selector()).to.equal(
      rolesMod.interface.getFunction("setAllowance").selector
    );
  });

  it("renounces account ownership", async () => {
    const { account, user, relayer } = await loadFixture(createAccount);

    const config = createSetupConfig({});
    const setupTx = await populateAccountSetup(
      { owner: user.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) => user.signTypedData(domain, types, message)
    );
    const safe = ISafe__factory.connect(account, relayer);

    await expect(relayer.sendTransaction(setupTx)).to.not.be.reverted;

    expect(await safe.getOwners()).to.deep.equal([
      "0x0000000000000000000000000000000000000002",
    ]);
  });

  it("deploys and enables two mods", async () => {
    const { account, user, relayer } = await loadFixture(createAccount);

    const provider = hre.ethers.provider;
    const config = createSetupConfig({});

    const safe = ISafe__factory.connect(account, relayer);
    const delayModAddress = predictDelayModAddress(account);
    const rolesModAddress = predictRolesModAddress(account);
    expect(delayModAddress).to.not.equal(rolesModAddress);

    const transaction = await populateAccountSetup(
      { owner: user.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) => user.signTypedData(domain, types, message)
    );

    expect(await provider.getCode(delayModAddress)).to.equal("0x");
    expect(await safe.isModuleEnabled(delayModAddress)).to.be.false;
    expect(await provider.getCode(rolesModAddress)).to.equal("0x");
    expect(await safe.isModuleEnabled(rolesModAddress)).to.be.false;

    await relayer.sendTransaction(transaction);

    expect(await provider.getCode(delayModAddress)).to.not.equal("0x");
    expect(await safe.isModuleEnabled(delayModAddress)).to.be.true;
    expect(await provider.getCode(rolesModAddress)).to.not.equal("0x");
    expect(await safe.isModuleEnabled(rolesModAddress)).to.be.true;
  });

  it("correctly configures Roles", async () => {
    const { user, account, spender, relayer, rolesMod } =
      await loadFixture(createAccount);

    const PERIOD = 7654;
    const AMOUNT = 123;

    const safe = ISafe__factory.connect(account, relayer);
    const bouncerAddress = predictBouncerAddress(account);
    const rolesModAddress = await rolesMod.getAddress();

    const config = createSetupConfig({
      spender: spender.address,
      timestamp: 432,
      period: PERIOD,
      allowance: AMOUNT,
    });
    const setupTx = await populateAccountSetup(
      { owner: user.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) => user.signTypedData(domain, types, message)
    );

    expect(await safe.isModuleEnabled(rolesModAddress)).to.be.false;

    await relayer.sendTransaction(setupTx);
    expect(await safe.isModuleEnabled(rolesModAddress)).to.be.true;
    expect(await rolesMod.isModuleEnabled(user.address)).to.be.false;
    expect(await rolesMod.isModuleEnabled(spender.address)).to.be.true;
    expect(await rolesMod.owner()).to.equal(bouncerAddress);

    const { balance, refill, maxRefill, period, timestamp } =
      await rolesMod.allowances(SPENDING_ALLOWANCE_KEY);

    expect(balance).to.equal(AMOUNT);
    expect(refill).to.equal(AMOUNT);
    expect(maxRefill).to.equal(AMOUNT);
    expect(period).to.equal(PERIOD);
    expect(timestamp).to.equal(432);
  });

  it("correctly configures Delay", async () => {
    const { user, account, spender, receiver, relayer, delayMod } =
      await loadFixture(createAccount);

    const delayModAddress = await delayMod.getAddress();
    const COOLDOWN = 60 * 3;
    const EXPIRATION = 60 * 30;

    const safe = ISafe__factory.connect(account, relayer);
    const config = createSetupConfig({
      spender: spender.address,
      receiver: receiver.address,
      cooldown: COOLDOWN,
      expiration: EXPIRATION,
    });

    const setupTx = await populateAccountSetup(
      { owner: user.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) => user.signTypedData(domain, types, message)
    );

    expect(await safe.isModuleEnabled(delayModAddress)).to.be.false;

    await relayer.sendTransaction(setupTx);
    expect(await safe.isModuleEnabled(delayModAddress)).to.be.true;
    expect(await delayMod.isModuleEnabled(user.address)).to.be.true;
    expect(await delayMod.isModuleEnabled(spender.address)).to.be.false;
    expect(await delayMod.isModuleEnabled(receiver.address)).to.be.false;

    expect(await delayMod.owner()).to.equal(account);
    expect(await delayMod.txCooldown()).to.equal(COOLDOWN);
    expect(await delayMod.txExpiration()).to.equal(EXPIRATION);
    expect(await delayMod.queueNonce()).to.equal(await delayMod.txNonce());
  });
});
