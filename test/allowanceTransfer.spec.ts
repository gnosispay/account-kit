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
  populateAllowanceTransfer,
  predictSafeAddress,
} from "../src";
import deployments from "../src/deployments";
import {
  IAllowanceModule__factory,
  IERC20__factory,
  ISafe__factory,
} from "../typechain-types";

describe("allowance-tranfer", () => {
  before(async () => {
    await fork(29800000);
  });

  after(async () => {
    await forkReset();
  });

  async function createAccount() {
    const [owner, alice, , relayer] = await hre.ethers.getSigners();

    const safeAddress = predictSafeAddress(owner.address);
    const createTransaction = populateAccountCreation(owner.address);

    await relayer.sendTransaction(createTransaction);

    await moveERC20(GNO_WHALE, safeAddress, GNO);

    const config = createAccountConfig({
      owner: owner.address,
      spender: alice.address,
      amount: 1000,
      token: GNO,
    });

    const setupTransaction = await populateAccountSetup(
      { account: safeAddress, chainId: 31337, nonce: 0 },
      config,
      (domain, types, message) => owner.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(setupTransaction);

    const safe = ISafe__factory.connect(safeAddress, hre.ethers.provider);

    return {
      owner,
      spender: alice,
      relayer,
      safe,
      allowanceMod: IAllowanceModule__factory.connect(
        deployments.allowanceSingleton.address,
        hre.ethers.provider
      ),
    };
  }

  it("transfer using allowance and spender", async () => {
    const { safe, spender, relayer } = await loadFixture(createAccount);

    const gno = IERC20__factory.connect(GNO, hre.ethers.provider);
    const safeAddress = await safe.getAddress();

    const token = GNO;
    const to = "0x0000000000000000000000000000000000000003";
    const amount = 10;

    const transaction = await populateAllowanceTransfer(safeAddress, {
      spender: spender.address,
      token,
      to,
      amount,
    });

    // since we don't provide signature, the spender must be the sender:
    await expect(relayer.sendTransaction(transaction)).to.be.reverted;

    expect(await gno.balanceOf(to)).to.be.equal(0);

    // only spender can execute the allowance transfer
    await spender.sendTransaction(transaction);

    expect(await gno.balanceOf(to)).to.be.equal(amount);
  });

  it("transfer overusing allowance fails", async () => {
    const { safe, spender } = await loadFixture(createAccount);

    const safeAddress = await safe.getAddress();
    const gno = IERC20__factory.connect(GNO, hre.ethers.provider);

    const token = GNO;
    const to = "0x0000000000000000000000000000000000000003";
    const amount = 2000;

    const transaction = await populateAllowanceTransfer(safeAddress, {
      spender: spender.address,
      token,
      to,
      amount,
    });

    expect(await gno.balanceOf(to)).to.be.equal(0);

    await expect(spender.sendTransaction(transaction)).to.be.reverted;
  });
});
