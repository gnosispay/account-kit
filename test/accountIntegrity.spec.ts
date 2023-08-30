import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import hre from "hardhat";

import { fork, forkReset } from "./setup";
import { populateAccountCreationTransaction, predictSafeAddress } from "../src";
import deployments from "../src/deployments";

describe.skip("account-integrity", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  async function createAccount() {
    const [owner, , , alice, bob, relayer] = await hre.ethers.getSigners();

    const safeAddress = predictSafeAddress(owner.address);
    const transaction = populateAccountCreationTransaction(owner.address);

    await relayer.sendTransaction(transaction);

    return {
      owner,
      alice,
      bob,
      safeAddress: safeAddress,
    };
  }

  it("setup enables two mods", async () => {
    const { safeAddress } = await loadFixture(createAccount);
    const provider = hre.ethers.provider;

    const a = [
      {
        from: null,
        to: "0x6b175474e89094c44da98b954eedeac495271d0f",
        data: "0x70a082310000000000000000000000006E0d01A76C3Cf4288372a29124A26D4353EE51BE",
      },
    ];

    const bah = await provider.send("eth_call", [
      {
        from: null,
        to: deployments.multicall.address,
        // data: ,
      },
    ]);

    console.log(bah);
  });
});
