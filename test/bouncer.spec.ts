import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { Bouncer__factory, TestContract__factory } from "../typechain-types";

describe("Bouncer", () => {
  async function setup() {
    const [caller, notTheCaller] = await hre.ethers.getSigners();

    const TestContract = await hre.ethers.getContractFactory("TestContract");
    const testContract = await TestContract.deploy();

    const Bouncer = await hre.ethers.getContractFactory("Bouncer");
    const bouncer = await Bouncer.deploy(
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
      bouncer: Bouncer__factory.connect(
        await bouncer.getAddress(),
        hre.ethers.provider
      ),
    };
  }

  it("only caller is allowed", async () => {
    const { caller, notTheCaller, testContract, bouncer } =
      await loadFixture(setup);

    const to = await bouncer.getAddress();
    const transaction =
      await testContract.fnThatMaybeReverts.populateTransaction(false);

    await expect(notTheCaller.sendTransaction({ ...transaction, to }))
      .to.be.revertedWithCustomError(bouncer, "BouncerBlockedCaller")
      .withArgs(notTheCaller.address);

    await expect(caller.sendTransaction({ ...transaction, to })).to.not.be
      .reverted;
  });

  it("only selector is allowed", async () => {
    const { caller, testContract, bouncer } = await loadFixture(setup);

    const to = await bouncer.getAddress();
    const transactionOther = await testContract.fnOther.populateTransaction();
    const transaction =
      await testContract.fnThatMaybeReverts.populateTransaction(false);

    await expect(caller.sendTransaction({ ...transactionOther, to }))
      .to.be.revertedWithCustomError(bouncer, "BouncerBlockedSelector")
      .withArgs(await testContract.fnOther.getFragment().selector);

    await expect(caller.sendTransaction({ ...transaction, to })).to.not.be
      .reverted;
  });

  it("reverts if underlying reverts", async () => {
    const { caller, testContract, bouncer } = await loadFixture(setup);

    const to = await bouncer.getAddress();
    const transaction =
      await testContract.fnThatMaybeReverts.populateTransaction(true);

    await expect(caller.sendTransaction({ ...transaction, to })).to.be.reverted;
  });

  it("succeeds if underlying succeeds", async () => {
    const { caller, testContract, bouncer } = await loadFixture(setup);

    const to = await bouncer.getAddress();
    const transaction =
      await testContract.fnThatMaybeReverts.populateTransaction(false);

    await expect(caller.sendTransaction({ ...transaction, to })).to.not.be
      .reverted;
  });
});
