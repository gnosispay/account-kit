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
  predictSafeAddress,
} from "../src";

import { ALLOWANCE_SPENDING_KEY } from "../src/constants";
import { predictDelayAddress } from "../src/deployers/delay";
import { predictRolesAddress } from "../src/deployers/roles";
import {
  IDelayModule__factory,
  IRolesModifier__factory,
  ISafe__factory,
} from "../typechain-types";
import {
  predictOwnerChannelAddress,
  predictSpenderChannelAddress,
} from "../src/deployers/channel";

describe.only("account-setup", () => {
  before(async () => {
    await fork(29800000);
  });

  after(async () => {
    await forkReset();
  });

  async function createAccount() {
    const [eoa, spender, receiver, relayer] = await hre.ethers.getSigners();

    const transaction = populateAccountCreation(eoa.address);

    const safeAddress = predictSafeAddress(eoa.address);
    const rolesAddress = predictRolesAddress(safeAddress);
    const delayAddress = predictDelayAddress(safeAddress);

    await relayer.sendTransaction(transaction);

    return {
      eoa,
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
    };
  }

  it("setup deploys and setups up channels", async () => {
    const { eoa, spender, receiver, relayer, safeAddress } =
      await loadFixture(createAccount);

    const provider = hre.ethers.provider;
    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
    });

    const ownerChannelAddress = predictOwnerChannelAddress({
      eoa: eoa.address,
    });
    const spenderChannelAddress = predictSpenderChannelAddress({
      eoa: eoa.address,
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

  it("setup deploys and enables two mods", async () => {
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

  it("setup correctly configures Roles", async () => {
    const {
      eoa,
      spender,
      receiver,
      relayer,
      safe,
      rolesModifier,
      safeAddress,
      rolesAddress,
    } = await loadFixture(createAccount);

    const PERIOD = 7654;
    const AMOUNT = 123;

    const account = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
      period: PERIOD,
      token: GNO,
      allowance: AMOUNT,
    });

    expect(await safe.isModuleEnabled(rolesAddress)).to.be.false;

    const transaction = await populateAccountSetup(
      { eoa: eoa.address, safe: safeAddress, chainId: 31337, nonce: 0 },
      account,
      (...args) => eoa.signTypedData(...args)
    );
    await relayer.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(rolesAddress)).to.be.true;
    // expect(await rolesModifier.owner()).to.equal(forwarderAddress);

    expect(await rolesModifier.isModuleEnabled(eoa.address)).to.be.false;
    expect(await rolesModifier.isModuleEnabled(spender.address)).to.be.true;
    expect(await rolesModifier.isModuleEnabled(receiver.address)).to.be.false;

    const {
      refillAmount,
      refillInterval,
      refillTimestamp,
      balance,
      maxBalance,
    } = await rolesModifier.allowances(ALLOWANCE_SPENDING_KEY);
    expect(refillAmount).to.equal(AMOUNT);
    expect(refillInterval).to.equal(PERIOD);
    expect(refillTimestamp).to.equal(0);
    expect(balance).to.equal(AMOUNT);
    expect(maxBalance).to.equal(AMOUNT);
  });

  it("setup correctly configures Delay", async () => {
    const { eoa, spender, receiver, relayer, safe, delayModule } =
      await loadFixture(createAccount);

    const safeAddress = await safe.getAddress();
    const delayAddress = await delayModule.getAddress();
    const COOLDOWN = 9999;

    const account = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
      cooldown: COOLDOWN,
    });

    const transaction = await populateAccountSetup(
      { eoa: eoa.address, safe: safeAddress, chainId: 31337, nonce: 0 },
      account,
      (...args) => eoa.signTypedData(...args)
    );

    await relayer.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(delayAddress)).to.be.true;

    expect(await delayModule.isModuleEnabled(eoa.address)).to.be.true;
    expect(await delayModule.isModuleEnabled(spender.address)).to.be.false;
    expect(await delayModule.isModuleEnabled(receiver.address)).to.be.false;

    expect(await delayModule.owner()).to.equal(safeAddress);
    expect(await delayModule.txCooldown()).to.equal(9999);
    expect(await delayModule.queueNonce()).to.equal(
      await delayModule.txNonce()
    );
  });
});
