import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import { DAI, createAccountSetupConfig, fork, forkReset } from "./setup";
import {
  paramsToSignAccountSetup,
  populateAccountCreationTransaction,
  populateAccountSetupTransaction,
  predictSafeAddress,
} from "../src";
import deployments from "../src/deployments";
import { predictDelayAddress } from "../src/entrypoints/account-setup/delay-mod";
import {
  IAllowanceModule__factory,
  IDelayModule__factory,
  ISafe__factory,
} from "../typechain-types";

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

    const allowanceAddress = deployments.allowanceSingleton.address;
    const delayAddress = predictDelayAddress(safeAddress);

    await charlie.sendTransaction(transaction);

    return {
      owner,
      alice,
      bob,
      charlie,
      safe: ISafe__factory.connect(safeAddress, hre.ethers.provider),
      allowanceModule: IAllowanceModule__factory.connect(
        allowanceAddress,
        hre.ethers.provider
      ),
      delayModule: IDelayModule__factory.connect(
        delayAddress,
        hre.ethers.provider
      ),
      safeAddress: safeAddress,
      allowanceAddress,
      delayAddress,
    };
  }

  it("setup enables two mods", async () => {
    const { owner, alice, safe, safeAddress, allowanceAddress, delayAddress } =
      await loadFixture(createAccount);

    const config = createAccountSetupConfig({ spender: alice.address });
    const { domain, types, message } = paramsToSignAccountSetup(
      safeAddress,
      31337, // chainId hardhat
      config
    );
    const signature = await owner.signTypedData(domain, types, message);

    const transaction = populateAccountSetupTransaction(
      safeAddress,
      config,
      signature
    );

    expect(await safe.isModuleEnabled(allowanceAddress)).to.be.false;
    expect(await safe.isModuleEnabled(delayAddress)).to.be.false;

    await alice.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(allowanceAddress)).to.be.true;
    expect(await safe.isModuleEnabled(delayAddress)).to.be.true;
  });

  it("setup correctly configures allowance", async () => {
    const { owner, alice, bob, safe, allowanceModule } =
      await loadFixture(createAccount);

    const safeAddress = await safe.getAddress();
    const allowanceAddress = await allowanceModule.getAddress();

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
      safeAddress,
      31337, // chainId hardhat
      config
    );
    const signature = await owner.signTypedData(domain, types, message);

    const transaction = populateAccountSetupTransaction(
      safeAddress,
      config,
      signature
    );

    await bob.sendTransaction(transaction);

    const [amount, spent, period, , nonce] =
      await allowanceModule.getTokenAllowance(
        safeAddress,
        spender.address,
        DAI
      );

    expect(amount).to.equal(AMOUNT);
    expect(spent).to.equal(0);
    expect(period).to.equal(PERIOD);
    expect(nonce).to.equal(1); // allowance token 1 means new

    expect(await safe.isModuleEnabled(allowanceAddress)).to.be.true;
  });

  it("setup correctly configures delay", async () => {
    const { owner, alice, bob, safe, delayModule } =
      await loadFixture(createAccount);

    const safeAddress = await safe.getAddress();
    const delayAddress = await delayModule.getAddress();
    const COOLDOWN = 9999;

    const config = createAccountSetupConfig({
      spender: alice.address,
      cooldown: COOLDOWN,
    });

    const { domain, types, message } = paramsToSignAccountSetup(
      safeAddress,
      31337, // chainId hardhat
      config
    );
    const signature = await owner.signTypedData(domain, types, message);

    const transaction = populateAccountSetupTransaction(
      safeAddress,
      config,
      signature
    );

    await bob.sendTransaction(transaction);

    expect(await safe.isModuleEnabled(delayAddress)).to.be.true;
    expect(await delayModule.txCooldown()).to.equal(9999);
    expect(await delayModule.queueNonce()).to.equal(
      await delayModule.txNonce()
    );
  });
});
