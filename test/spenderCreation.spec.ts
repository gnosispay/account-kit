import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import { postFixture, preFixture } from "./test-helpers";
import { predictSpenderAddress } from "../src/entrypoints/predictAddresses";
import populateSpenderCreation from "../src/entrypoints/spender-actions/spenderCreation";
import { ISafe__factory, TestERC20__factory } from "../typechain-types";

describe("spender creation", () => {
  before(async () => {
    await preFixture();
  });

  after(async () => {
    await postFixture();
  });

  async function setup() {
    const [owner1, owner2, owner3, payer, relayer] =
      await hre.ethers.getSigners();

    const erc20 = await (
      await hre.ethers.getContractFactory("TestERC20")
    ).deploy();

    return {
      owner1,
      owner2,
      owner3,
      payer,
      relayer,
      token: TestERC20__factory.connect(await erc20.getAddress(), relayer),
    };
  }

  it("sets up a spender safe", async () => {
    const { owner1, owner2, owner3, relayer } = await loadFixture(setup);

    const predictedSafeAddress = predictSpenderAddress({
      owners: [owner1.address, owner2.address, owner3.address],
      threshold: 2,
    });

    // account not deployed
    expect(await hre.ethers.provider.getCode(predictedSafeAddress)).to.equal(
      "0x"
    );

    const accountCreationTransaction = populateSpenderCreation({
      owners: [owner1.address, owner2.address, owner3.address],
      threshold: 2,
    });
    await relayer.sendTransaction(accountCreationTransaction);

    // account deployed
    expect(
      await hre.ethers.provider.getCode(predictedSafeAddress)
    ).to.not.equal("0x");

    const safe = ISafe__factory.connect(
      predictedSafeAddress,
      hre.ethers.provider
    );
    expect(await safe.isOwner(owner1.address)).to.be.true;
    expect(await safe.isOwner(owner2.address)).to.be.true;
    expect(await safe.isOwner(owner3.address)).to.be.true;
    expect(await safe.isOwner(relayer.address)).to.be.false;
    expect(await safe.getThreshold()).to.equal(2);
  });
});
