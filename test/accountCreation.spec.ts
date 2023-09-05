import { expect } from "chai";
import hre from "hardhat";

import { fork, forkReset } from "./test-helpers/setup";
import { populateAccountCreation, predictSafeAddress } from "../src";
import { ISafe__factory } from "../typechain-types";

describe("account-creation", () => {
  before(async () => {
    await fork(29800000);
  });

  after(async () => {
    await forkReset();
  });

  it("the default saltNonce is correct", async () => {
    const owner = "0x8d99F8b2710e6A3B94d9bf465A98E5273069aCBd";
    const account = "0xa2F31c16B55a9392E515273D7F35cb8aA1F0a3D6";

    expect(predictSafeAddress(owner)).to.equal(account);
  });

  it("sets up a 1/1 safe", async () => {
    const [owner, , , other] = await hre.ethers.getSigners();

    const predictedSafeAddress = predictSafeAddress(owner.address);

    // account not deployed
    expect(await hre.ethers.provider.getCode(predictedSafeAddress)).to.equal(
      "0x"
    );

    const accountCreationTransaction = populateAccountCreation(owner.address);
    await other.sendTransaction(accountCreationTransaction);

    // account deployed
    expect(
      await hre.ethers.provider.getCode(predictedSafeAddress)
    ).to.not.equal("0x");

    const safe = ISafe__factory.connect(
      predictedSafeAddress,
      hre.ethers.provider
    );
    expect(await safe.isOwner(owner.address)).to.be.true;
    expect(await safe.isOwner(other.address)).to.be.false;
  });
});
