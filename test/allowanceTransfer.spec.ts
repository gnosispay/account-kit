import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import {
  DAI,
  DAI_WHALE,
  createAccountSetupConfig,
  fork,
  forkReset,
  moveERC20,
} from "./setup";

import {
  paramsToSignAccountSetup,
  paramsToSignAllowanceTransfer,
  populateAccountCreationTransaction,
  populateAccountSetupTransaction,
  populateAllowanceTransferTransaction,
  predictSafeAddress,
  signaturePatchAllowanceTransfer,
} from "../src";
import deployments from "../src/deployments";
import {
  IAllowanceModule__factory,
  IERC20__factory,
  ISafe__factory,
} from "../typechain-types";

describe("allowance-tranfer", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  async function createAccount() {
    const [owner, alice, , charlie] = await hre.ethers.getSigners();

    const safeAddress = predictSafeAddress(owner.address);
    const createTransaction = populateAccountCreationTransaction(owner.address);

    await charlie.sendTransaction(createTransaction);

    await moveERC20(DAI_WHALE, safeAddress, DAI);

    const config = createAccountSetupConfig({
      owner: owner.address,
      spender: alice.address,
      amount: 1000,
      token: DAI,
    });

    const { domain, types, message } = paramsToSignAccountSetup(
      safeAddress,
      31337, // chainId hardhat
      config
    );
    const signature = await owner.signTypedData(domain, types, message);

    const setupTransaction = populateAccountSetupTransaction(
      safeAddress,
      config,
      signature
    );

    await charlie.sendTransaction(setupTransaction);

    const safe = ISafe__factory.connect(safeAddress, hre.ethers.provider);

    return {
      owner,
      spender: alice,
      charlie,
      safe,
      allowanceMod: IAllowanceModule__factory.connect(
        deployments.allowanceSingleton.address,
        hre.ethers.provider
      ),
    };
  }

  it("transfer using allowance and spender", async () => {
    const { safe, spender, charlie } = await loadFixture(createAccount);

    const dai = IERC20__factory.connect(DAI, hre.ethers.provider);

    const token = DAI;
    const to = "0x0000000000000000000000000000000000000003";
    const amount = 10;
    const nonce = 1;

    const { message } = paramsToSignAllowanceTransfer(
      await safe.getAddress(),
      31337,
      { token, to, amount },
      nonce
    );

    const signature = signaturePatchAllowanceTransfer(
      await spender.signMessage(message)
    );

    const transaction = populateAllowanceTransferTransaction(
      await safe.getAddress(),
      { spender: spender.address, token, to, amount },
      signature
    );

    expect(await dai.balanceOf(to)).to.be.equal(0);

    await charlie.sendTransaction(transaction);

    expect(await dai.balanceOf(to)).to.be.equal(amount);
  });

  it("transfer overusing allowance fails", async () => {
    const { safe, spender, charlie } = await loadFixture(createAccount);

    const dai = IERC20__factory.connect(DAI, hre.ethers.provider);

    const token = DAI;
    const to = "0x0000000000000000000000000000000000000003";
    const amount = 2000;
    const nonce = 1;

    const { message } = paramsToSignAllowanceTransfer(
      await safe.getAddress(),
      31337,
      { token, to, amount },
      nonce
    );

    const signature = signaturePatchAllowanceTransfer(
      await spender.signMessage(message)
    );

    const transaction = populateAllowanceTransferTransaction(
      await safe.getAddress(),
      { spender: spender.address, token, to, amount },
      signature
    );

    expect(await dai.balanceOf(to)).to.be.equal(0);

    await expect(charlie.sendTransaction(transaction)).to.be.reverted;
  });
});
