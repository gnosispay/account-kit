import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress, ZeroHash, keccak256, toUtf8Bytes } from "ethers";
import hre from "hardhat";

import {
  createSetupConfig,
  postFixture,
  preFixture,
} from "./test-helpers/index";

import {
  populateAccountCreation,
  populateAccountSetup,
  populateSpend,
  predictAccountAddress,
} from "../src";

import { SPENDING_ALLOWANCE_KEY } from "../src/constants";
import { RolesConditionStatus } from "../src/parts/roles";
import {
  IRolesModifier__factory,
  TestERC20__factory,
} from "../typechain-types";

describe("spend", () => {
  before(async () => {
    await preFixture();
  });

  after(async () => {
    await postFixture;
  });

  async function createAccount() {
    const [owner, spender, receiver, relayer] = await hre.ethers.getSigners();

    const erc20 = await (
      await hre.ethers.getContractFactory("TestERC20")
    ).deploy();

    const config = createSetupConfig({
      spender: spender.address,
      receiver: receiver.address,
      token: await erc20.getAddress(),
      allowance: 1000,
    });
    const account = predictAccountAddress({ owner: owner.address });
    const createTx = populateAccountCreation({ owner: owner.address });
    const setupTx = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(createTx);
    await relayer.sendTransaction(setupTx);

    return {
      account,
      owner,
      spender,
      receiver,
      relayer,
      token: TestERC20__factory.connect(await erc20.getAddress(), relayer),
      roles: IRolesModifier__factory.connect(ZeroAddress),
    };
  }

  it("enforces configured spender as signer on spend tx", async () => {
    const { account, spender, receiver, relayer, token, roles } =
      await loadFixture(createAccount);

    await token.mint(account, 10);

    const to = receiver.address;
    const amount = 10;

    const spendSignedByOther = await populateSpend(
      { account, chainId: 31337 },
      { token: await token.getAddress(), to, amount },
      ({ domain, types, message }) =>
        relayer.signTypedData(domain, types, message)
    );
    const spendSignedBySpender = await populateSpend(
      { account, chainId: 31337 },
      { token: await token.getAddress(), to, amount },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );

    await expect(
      relayer.sendTransaction(spendSignedByOther)
    ).to.be.revertedWithCustomError(roles, "NotAuthorized");

    expect(await token.balanceOf(to)).to.be.equal(0);
    await relayer.sendTransaction(spendSignedBySpender);
    expect(await token.balanceOf(to)).to.be.equal(amount);
  });
  it("enforces configured receiver as to on spend tx", async () => {
    const { account, spender, receiver, relayer, token, roles } =
      await loadFixture(createAccount);

    await token.mint(account, 10);
    const amount = 10;

    const txToOther = await populateSpend(
      { account, chainId: 31337 },
      { token: await token.getAddress(), to: relayer.address, amount },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );

    const txToReceiver = await populateSpend(
      { account, chainId: 31337 },
      { token: await token.getAddress(), to: receiver.address, amount },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );

    await expect(relayer.sendTransaction(txToOther))
      .to.be.revertedWithCustomError(roles, "ConditionViolation")
      .withArgs(RolesConditionStatus.ParameterNotAllowed, ZeroHash);

    expect(await token.balanceOf(receiver.address)).to.be.equal(0);
    await relayer.sendTransaction(txToReceiver);
    expect(await token.balanceOf(receiver.address)).to.be.equal(amount);
  });
  it("spend overusing allowance fails", async () => {
    const { account, spender, receiver, relayer, token, roles } =
      await loadFixture(createAccount);

    await token.mint(account, 2000);
    const amount = 2000;

    const txOverspending = await populateSpend(
      { account, chainId: 31337 },
      { token: await token.getAddress(), to: receiver.address, amount },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );
    const txUnderspending = await populateSpend(
      { account, chainId: 31337 },
      { token: await token.getAddress(), to: receiver.address, amount: 10 },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );

    await expect(relayer.sendTransaction(txOverspending))
      .to.be.revertedWithCustomError(roles, "ConditionViolation")
      .withArgs(RolesConditionStatus.AllowanceExceeded, SPENDING_ALLOWANCE_KEY);

    expect(await token.balanceOf(receiver.address)).to.be.equal(0);
    await relayer.sendTransaction(txUnderspending);
    expect(await token.balanceOf(receiver.address)).to.be.equal(10);
  });
  it("reverts on replayed spend tx", async () => {
    const { account, spender, receiver, relayer, token, roles } =
      await loadFixture(createAccount);

    await token.mint(account, 10);
    const to = receiver.address;
    const amount = 10;

    const spendSignedBySpender = await populateSpend(
      { account, chainId: 31337, salt: keccak256(toUtf8Bytes("Some Salt")) },
      { token: await token.getAddress(), to, amount },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(spendSignedBySpender);
    expect(await token.balanceOf(to)).to.be.equal(amount);

    // sending the same transaction fails
    await expect(
      relayer.sendTransaction(spendSignedBySpender)
    ).to.be.revertedWithCustomError(roles, "HashAlreadyConsumed");
  });
});
