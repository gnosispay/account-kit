import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress, ZeroHash, keccak256, toUtf8Bytes } from "ethers";
import hre from "hardhat";

import {
  GNO,
  GNO_WHALE,
  createSetupConfig,
  fork,
  forkReset,
  moveERC20,
} from "./setup";

import {
  populateAccountCreation,
  populateAccountSetup,
  populateSpend,
  predictAccountAddress,
} from "../src";

import { SPENDING_ALLOWANCE_KEY } from "../src/constants";
import { RolesConditionStatus } from "../src/parts/roles";
import { IERC20__factory, IRolesModifier__factory } from "../typechain-types";

describe("spend", () => {
  before(async () => {
    await fork(parseInt(process.env.FORK_BLOCK as string));
  });

  after(async () => {
    await forkReset();
  });

  async function createAccount() {
    const [owner, spender, receiver, relayer] = await hre.ethers.getSigners();

    const config = createSetupConfig({
      spender: spender.address,
      receiver: receiver.address,
      token: GNO,
      allowance: 1000,
    });
    const account = predictAccountAddress(owner.address);
    const createTx = populateAccountCreation(owner.address);
    const setupTx = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(createTx);
    await relayer.sendTransaction(setupTx);
    await moveERC20(GNO_WHALE, account, GNO);

    return {
      account,
      owner,
      spender,
      receiver,
      relayer,
      roles: IRolesModifier__factory.connect(ZeroAddress),
    };
  }

  it("enforces configured spender as signer on spend tx", async () => {
    const { account, spender, receiver, relayer, roles } =
      await loadFixture(createAccount);

    const gno = IERC20__factory.connect(GNO, hre.ethers.provider);

    const token = GNO;
    const to = receiver.address;
    const amount = 10;

    const spendSignedByOther = await populateSpend(
      { account, chainId: 31337 },
      { token, to, amount },
      ({ domain, types, message }) =>
        relayer.signTypedData(domain, types, message)
    );
    const spendSignedBySpender = await populateSpend(
      { account, chainId: 31337 },
      { token, to, amount },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );

    await expect(
      relayer.sendTransaction(spendSignedByOther)
    ).to.be.revertedWithCustomError(roles, "NotAuthorized");

    expect(await gno.balanceOf(to)).to.be.equal(0);
    await relayer.sendTransaction(spendSignedBySpender);
    expect(await gno.balanceOf(to)).to.be.equal(amount);
  });
  it("enforces configured receiver as to on spend tx", async () => {
    const { account, spender, receiver, relayer, roles } =
      await loadFixture(createAccount);

    const gno = IERC20__factory.connect(GNO, hre.ethers.provider);

    const token = GNO;
    const amount = 10;

    const txToOther = await populateSpend(
      { account, chainId: 31337 },
      { token, to: relayer.address, amount },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );

    const txToReceiver = await populateSpend(
      { account, chainId: 31337 },
      { token, to: receiver.address, amount },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );

    await expect(relayer.sendTransaction(txToOther))
      .to.be.revertedWithCustomError(roles, "ConditionViolation")
      .withArgs(RolesConditionStatus.ParameterNotAllowed, ZeroHash);

    expect(await gno.balanceOf(receiver.address)).to.be.equal(0);
    await relayer.sendTransaction(txToReceiver);
    expect(await gno.balanceOf(receiver.address)).to.be.equal(amount);
  });
  it("spend overusing allowance fails", async () => {
    const { account, spender, receiver, relayer, roles } =
      await loadFixture(createAccount);

    const gno = IERC20__factory.connect(GNO, hre.ethers.provider);

    const token = GNO;
    const amount = 2000;

    const txOverspending = await populateSpend(
      { account, chainId: 31337 },
      { token, to: receiver.address, amount },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );
    const txUnderspending = await populateSpend(
      { account, chainId: 31337 },
      { token, to: receiver.address, amount: 10 },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );

    await expect(relayer.sendTransaction(txOverspending))
      .to.be.revertedWithCustomError(roles, "ConditionViolation")
      .withArgs(RolesConditionStatus.AllowanceExceeded, SPENDING_ALLOWANCE_KEY);

    expect(await gno.balanceOf(receiver.address)).to.be.equal(0);
    await relayer.sendTransaction(txUnderspending);
    expect(await gno.balanceOf(receiver.address)).to.be.equal(10);
  });
  it("reverts on replayed spend tx", async () => {
    const { account, spender, receiver, relayer } =
      await loadFixture(createAccount);

    const gno = IERC20__factory.connect(GNO, hre.ethers.provider);

    const token = GNO;
    const to = receiver.address;
    const amount = 10;

    const spendSignedBySpender = await populateSpend(
      { account, chainId: 31337, salt: keccak256(toUtf8Bytes("Some Salt")) },
      { token, to, amount },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );

    const roles = IRolesModifier__factory.connect(spendSignedBySpender.to);

    await relayer.sendTransaction(spendSignedBySpender);
    expect(await gno.balanceOf(to)).to.be.equal(amount);

    // sending the same transaction fails
    await expect(
      relayer.sendTransaction(spendSignedBySpender)
    ).to.be.revertedWithCustomError(roles, "HashAlreadyConsumed");
  });
});
