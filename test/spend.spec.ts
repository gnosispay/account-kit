import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import {
  GNO,
  GNO_WHALE,
  createAccountConfig,
  fork,
  forkReset,
  moveERC20,
} from "./test-helpers/setup";

import {
  populateAccountCreation,
  populateAccountSetup,
  populateSpend,
  predictAccountAddress,
} from "../src";

import { IERC20__factory, ISafe__factory } from "../typechain-types";

describe("spend", () => {
  before(async () => {
    await fork(29800000);
  });

  after(async () => {
    await forkReset();
  });

  async function createAccount() {
    const [eoa, spender, receiver, other, relayer] =
      await hre.ethers.getSigners();

    const safeAddress = predictAccountAddress(eoa.address);
    const createTransaction = populateAccountCreation(eoa.address);

    await other.sendTransaction(createTransaction);

    await moveERC20(GNO_WHALE, safeAddress, GNO);

    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
      token: GNO,
      allowance: 1000,
    });

    const setupTransaction = await populateAccountSetup(
      { owner: eoa.address, account: safeAddress, chainId: 31337, nonce: 0 },
      config,
      (domain, types, message) => eoa.signTypedData(domain, types, message)
    );

    await other.sendTransaction(setupTransaction);

    const safe = ISafe__factory.connect(safeAddress, hre.ethers.provider);

    return {
      eoa,
      spender,
      receiver,
      other,
      relayer,
      safe,
    };
  }

  it("enforces configured spender as signer on spend tx", async () => {
    const { safe, spender, receiver, other } = await loadFixture(createAccount);

    const gno = IERC20__factory.connect(GNO, hre.ethers.provider);
    const safeAddress = await safe.getAddress();

    const token = GNO;
    const to = receiver.address;
    const amount = 10;

    const spendSignedByOther = await populateSpend(
      {
        account: safeAddress,
        spender: spender.address,
        chainId: 31337,
        nonce: 0,
      },
      {
        token,
        to,
        amount,
      },
      (...args) => other.signTypedData(...args)
    );
    const spendSignedBySpender = await populateSpend(
      {
        account: safeAddress,
        spender: spender.address,
        chainId: 31337,
        nonce: 0,
      },
      {
        token,
        to,
        amount,
      },
      (...args) => spender.signTypedData(...args)
    );

    await expect(other.sendTransaction(spendSignedByOther)).to.be.reverted;
    expect(await gno.balanceOf(to)).to.be.equal(0);

    // only spender can execute the allowance transfer
    await spender.sendTransaction(spendSignedBySpender);
    expect(await gno.balanceOf(to)).to.be.equal(amount);
  });

  it("enforces configured receiver as to on spend tx", async () => {
    const { safe, spender, receiver, other } = await loadFixture(createAccount);

    const gno = IERC20__factory.connect(GNO, hre.ethers.provider);
    const safeAddress = await safe.getAddress();

    const token = GNO;
    const amount = 10;

    const txToOther = await populateSpend(
      {
        account: safeAddress,
        spender: spender.address,
        chainId: 31337,
        nonce: 0,
      },
      {
        token,
        to: other.address,
        amount,
      },
      (...args) => spender.signTypedData(...args)
    );

    const txToReceiver = await populateSpend(
      {
        account: safeAddress,
        spender: spender.address,
        chainId: 31337,
        nonce: 0,
      },
      {
        token,
        to: receiver.address,
        amount,
      },
      (...args) => spender.signTypedData(...args)
    );

    // since we don't provide signature, the spender must be the sender:
    await expect(spender.sendTransaction(txToOther)).to.be.reverted;
    expect(await gno.balanceOf(receiver.address)).to.be.equal(0);

    // only spender can execute the allowance transfer
    await spender.sendTransaction(txToReceiver);
    expect(await gno.balanceOf(receiver.address)).to.be.equal(amount);
  });

  it("spend overusing allowance fails", async () => {
    const { safe, spender, receiver } = await loadFixture(createAccount);

    const safeAddress = await safe.getAddress();
    const gno = IERC20__factory.connect(GNO, hre.ethers.provider);

    const token = GNO;
    const amount = 2000;

    const txToReceiver = await populateSpend(
      {
        account: safeAddress,
        spender: spender.address,
        chainId: 31337,
        nonce: 0,
      },
      {
        token,
        to: receiver.address,
        amount,
      },
      (...args) => spender.signTypedData(...args)
    );

    expect(await gno.balanceOf(receiver.address)).to.be.equal(0);
    await expect(spender.sendTransaction(txToReceiver)).to.be.reverted;
  });
});
