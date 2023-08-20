import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { createSafeDeploymentRequest } from "../src";
import { Address, SponsoredCallRequest } from "../src/types";
import { predictSafeAddress } from "../src/relayAccountCreation";

import { ISafe, ISafe__factory } from "../typechain-types";

import { fork, forkReset } from "./setup";

describe("relayAccountCreation()", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  it("runs", async () => {
    const [owner, , , relayer] = await hre.ethers.getSigners();

    const predictedAccountAddress = predictSafeAddress(
      owner.address as Address
    );

    // account not deployed
    expect(await hre.ethers.provider.getCode(predictedAccountAddress)).to.equal(
      "0x"
    );

    const request = createSafeDeploymentRequest(owner.address, 1);

    await relayer.sendTransaction({
      to: request.target,
      value: 0,
      data: request.data,
    });

    // account deployed
    expect(
      await hre.ethers.provider.getCode(predictedAccountAddress)
    ).to.not.equal("0x");

    const safe = ISafe__factory.connect(
      predictedAccountAddress,
      hre.ethers.provider
    );
    expect(await safe.isOwner(owner.address)).to.be.true;
    expect(await safe.isOwner(relayer.address)).to.be.false;
  });
});

async function relay(request: SponsoredCallRequest, signer: SignerWithAddress) {
  await signer.sendTransaction(request);
}
