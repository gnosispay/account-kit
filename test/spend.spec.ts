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
    const [gnosis, user, receiver, delegate, relayer] =
      await hre.ethers.getSigners();

    const erc20 = await (
      await hre.ethers.getContractFactory("TestERC20")
    ).deploy();

    const spender = {
      address: _predictSafeAddress({
        owners: [gnosis.address],
        threshold: 1,
        creationNonce: BigInt(123456),
      }),
      creationTx: _populateSafeCreation({
        owners: [gnosis.address],
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

    const account = predictAccountAddress({ owner: user.address });
    const creationTx = populateAccountCreation({ owner: user.address });
    const setupTx = await populateAccountSetup(
      { owner: user.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) => user.signTypedData(domain, types, message)
    );
    const spenderSetupTx = await populateSpenderSetup(
      {
        spender: config.spender,
        delegate: delegate.address,
        chainId: 31337,
        nonce: 0,
      },
      ({ domain, types, message }) =>
        gnosis.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(creationTx);
    await relayer.sendTransaction(setupTx);
    await relayer.sendTransaction(spender.creationTx);
    await relayer.sendTransaction(spenderSetupTx);

    return {
      config,
      delegate,
      account,
      receiver,
      relayer,
      token: TestERC20__factory.connect(await erc20.getAddress(), relayer),
    };
  }

  it("enforces configured spender as signer on spend tx", async () => {
    const { account, delegate, receiver, relayer, token, config } =
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
    const spendSignedByDelegate = await populateSpend(
      { account, spender: config.spender, chainId: 31337 },
      transfer,
      ({ domain, types, message }) =>
        delegate.signTypedData(domain, types, message)
    );

    await expect(relayer.sendTransaction(spendSignedByOther)).to.be.reverted;

    expect(await token.balanceOf(to)).to.be.equal(0);
    await relayer.sendTransaction(spendSignedByDelegate);
    expect(await token.balanceOf(to)).to.be.equal(amount);
  });
  it("enforces configured receiver as to on spend tx", async () => {
    const { account, receiver, delegate, relayer, token, config } =
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

    const spendToOther = await populateSpend(
      { account, spender: config.spender, chainId: 31337 },
      transferToOther,
      ({ domain, types, message }) =>
        delegate.signTypedData(domain, types, message)
    );

    const spendToReceiver = await populateSpend(
      { account, spender: config.spender, chainId: 31337 },
      transferToReceiver,
      ({ domain, types, message }) =>
        delegate.signTypedData(domain, types, message)
    );

    await expect(relayer.sendTransaction(spendToOther)).to.be.reverted;

    expect(await token.balanceOf(receiver.address)).to.be.equal(0);
    await relayer.sendTransaction(spendToReceiver);
    expect(await token.balanceOf(receiver.address)).to.be.equal(amount);
  });
  it("spend overusing allowance fails", async () => {
    const { account, receiver, delegate, relayer, token, config } =
      await loadFixture(createAccount);

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

    const overspendTx = await populateSpend(
      { account, spender: config.spender, chainId: 31337 },
      transferOverspending,
      ({ domain, types, message }) =>
        delegate.signTypedData(domain, types, message)
    );
    const underspendTx = await populateSpend(
      { account, spender: config.spender, chainId: 31337 },
      transferUnderspending,
      ({ domain, types, message }) =>
        delegate.signTypedData(domain, types, message)
    );

    await token.mint(account, 2000);

    await expect(relayer.sendTransaction(overspendTx)).to.be.revertedWith(
      "Spend Transaction Failed"
    );
    expect(await token.balanceOf(receiver.address)).to.be.equal(0);
    await relayer.sendTransaction(underspendTx);
    expect(await token.balanceOf(receiver.address)).to.be.equal(10);
  });
});
