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
  populateSpend,
  predictAccountAddress,
} from "../src";

import populateSpenderSetup from "../src/entrypoints/spender-actions/spenderSetup";

import { _populateSafeCreation, _predictSafeAddress } from "../src/parts";
import { TestERC20__factory } from "../typechain-types";

describe("spend", () => {
  before(async () => {
    await preFixture();
  });

  after(async () => {
    await postFixture();
  });

  async function createAccount() {
    const [owner, signer, receiver, payer, relayer] =
      await hre.ethers.getSigners();

    const erc20 = await (
      await hre.ethers.getContractFactory("TestERC20")
    ).deploy();

    const spender = {
      address: _predictSafeAddress({
        owners: [signer.address],
        threshold: 1,
        creationNonce: BigInt(123456),
      }),
      creationTx: _populateSafeCreation({
        owners: [signer.address],
        threshold: 1,
        creationNonce: BigInt(123456),
      }),
    };

    const config = createSetupConfig({
      spender: spender.address,
      receiver: receiver.address,
      token: await erc20.getAddress(),
      allowance: 1000,
    });

    const account = predictAccountAddress({ owner: owner.address });
    const creationTx = populateAccountCreation({ owner: owner.address });
    const setupTx = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    const spenderSetupTx = await populateSpenderSetup(
      {
        spender: config.spender,
        delegate: payer.address,
        chainId: 31337,
        nonce: 0,
      },
      ({ domain, types, message }) =>
        signer.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(creationTx);
    await relayer.sendTransaction(setupTx);
    await relayer.sendTransaction(spender.creationTx);
    await relayer.sendTransaction(spenderSetupTx);

    return {
      config,
      account,
      owner,
      signer,
      receiver,
      payer,
      relayer,
      token: TestERC20__factory.connect(await erc20.getAddress(), relayer),
    };
  }

  it("enforces configured spender as signer on spend tx", async () => {
    const { account, payer, receiver, relayer, token, config } =
      await loadFixture(createAccount);

    await token.mint(account, 10);

    const to = receiver.address;
    const amount = 10;
    const transfer = {
      token: await token.getAddress(),
      to,
      amount,
    };

    const spendSignedByOther = await populateSpend(
      { account, spender: config.spender, chainId: 31337 },
      transfer,
      ({ domain, types, message }) =>
        relayer.signTypedData(domain, types, message)
    );
    const spendSignedByPayer = await populateSpend(
      { account, spender: config.spender, chainId: 31337 },
      transfer,
      ({ domain, types, message }) =>
        payer.signTypedData(domain, types, message)
    );

    await expect(relayer.sendTransaction(spendSignedByOther)).to.be.reverted;

    expect(await token.balanceOf(to)).to.be.equal(0);
    await relayer.sendTransaction(spendSignedByPayer);
    expect(await token.balanceOf(to)).to.be.equal(amount);
  });
  it("enforces configured receiver as to on spend tx", async () => {
    const { account, receiver, payer, relayer, token, config } =
      await loadFixture(createAccount);

    await token.mint(account, 10);
    const amount = 10;

    const transferToOther = {
      token: await token.getAddress(),
      to: relayer.address,
      amount,
    };

    const transferToReceiver = {
      token: await token.getAddress(),
      to: receiver.address,
      amount,
    };

    const txToOther = await populateSpend(
      { account, spender: config.spender, chainId: 31337 },
      transferToOther,
      ({ domain, types, message }) =>
        payer.signTypedData(domain, types, message)
    );

    const txToReceiver = await populateSpend(
      { account, spender: config.spender, chainId: 31337 },
      transferToReceiver,
      ({ domain, types, message }) =>
        payer.signTypedData(domain, types, message)
    );

    // we could previously assert on a roles mod error. But now swallowed by the safe
    // await expect(relayer.sendTransaction(txToOther))
    // .to.be.revertedWithCustomError(roles, "ConditionViolation")
    // .withArgs(RolesConditionStatus.ParameterNotAllowed, ZeroHash);
    await expect(relayer.sendTransaction(txToOther)).to.be.reverted;

    expect(await token.balanceOf(receiver.address)).to.be.equal(0);
    await relayer.sendTransaction(txToReceiver);
    expect(await token.balanceOf(receiver.address)).to.be.equal(amount);
  });
  it("spend overusing allowance fails", async () => {
    const { account, receiver, payer, relayer, token, config } =
      await loadFixture(createAccount);

    await token.mint(account, 2000);

    const transferOverspending = {
      token: await token.getAddress(),
      to: receiver.address,
      amount: 2000,
    };

    const transferUnderspending = {
      token: await token.getAddress(),
      to: receiver.address,
      amount: 10,
    };

    const txOverspending = await populateSpend(
      { account, spender: config.spender, chainId: 31337 },
      transferOverspending,
      ({ domain, types, message }) =>
        payer.signTypedData(domain, types, message)
    );
    const txUnderspending = await populateSpend(
      { account, spender: config.spender, chainId: 31337 },
      transferUnderspending,
      ({ domain, types, message }) =>
        payer.signTypedData(domain, types, message)
    );

    await expect(relayer.sendTransaction(txOverspending)).to.be.revertedWith(
      "Spend Transaction Failed"
    );

    expect(await token.balanceOf(receiver.address)).to.be.equal(0);
    await relayer.sendTransaction(txUnderspending);
    expect(await token.balanceOf(receiver.address)).to.be.equal(10);
  });
});
