import hre from "hardhat";
import {
  SinglePurposeForwarder__factory,
  TestContract__factory,
} from "../typechain-types";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

describe.only("SinglePurposeForwarder", () => {
  async function setup() {
    const [caller, notTheCaller] = await hre.ethers.getSigners();

    const TestContract = await hre.ethers.getContractFactory("TestContract");
    const testContract = await TestContract.deploy();

    const SinglePurposeForwarder = await hre.ethers.getContractFactory(
      "SinglePurposeForwarder"
    );
    const forwarder = await SinglePurposeForwarder.deploy(
      await caller.getAddress(),
      await testContract.getAddress(),
      testContract.getFunction("fnThatMaybeReverts").fragment.selector
    );

    return {
      caller,
      notTheCaller,
      testContract: TestContract__factory.connect(
        await testContract.getAddress()
      ),
      forwarder: SinglePurposeForwarder__factory.connect(
        await forwarder.getAddress(),
        hre.ethers.provider
      ),
    };
  }

  it("only caller is allowed", async () => {
    const { caller, notTheCaller, testContract, forwarder } =
      await loadFixture(setup);

    const to = await forwarder.getAddress();
    const transaction =
      await testContract.fnThatMaybeReverts.populateTransaction(false);

    await expect(notTheCaller.sendTransaction({ ...transaction, to })).to.be
      .reverted;

    await expect(caller.sendTransaction({ ...transaction, to })).to.not.be
      .reverted;
  });

  it("only selector is allowed", async () => {
    const { caller, testContract, forwarder } = await loadFixture(setup);

    const to = await forwarder.getAddress();
    const transactionOther = await testContract.fnOther.populateTransaction();
    const transaction =
      await testContract.fnThatMaybeReverts.populateTransaction(false);

    await expect(caller.sendTransaction({ ...transactionOther, to })).to.be
      .reverted;

    await expect(caller.sendTransaction({ ...transaction, to })).to.not.be
      .reverted;
  });

  it("reverts if underlying reverts", async () => {
    const { caller, testContract, forwarder } = await loadFixture(setup);

    const to = await forwarder.getAddress();
    const transaction =
      await testContract.fnThatMaybeReverts.populateTransaction(true);

    await expect(caller.sendTransaction({ ...transaction, to })).to.be.reverted;
  });

  it("succeeds if underlying succeeds", async () => {
    const { caller, testContract, forwarder } = await loadFixture(setup);

    const to = await forwarder.getAddress();
    const transaction =
      await testContract.fnThatMaybeReverts.populateTransaction(false);

    await expect(caller.sendTransaction({ ...transaction, to })).to.not.be
      .reverted;
  });
});
