import { expect } from "chai";
import hre from "hardhat";

import {
  populateCreateAccount,
  predictSafeAddress,
} from "../src/relayAccountCreation";

import { ISafe__factory } from "../typechain-types";

import { fork, forkReset } from "./setup";
import { getAllowanceModuleDeployment } from "@safe-global/safe-modules-deployments";

describe("relayAccountCreation()", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  it("runs", async () => {
    const [owner, , , relayer] = await hre.ethers.getSigners();

    const predictedAccountAddress = predictSafeAddress(owner.address);

    // account not deployed
    expect(await hre.ethers.provider.getCode(predictedAccountAddress)).to.equal(
      "0x"
    );

    const { to, data } = populateCreateAccount(owner.address, 1);

    await relayer.sendTransaction({ to, data });

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

    // const allowanceModule = getAllowanceModuleDeployment();
    // console.log(allowanceModule);
  });
});
