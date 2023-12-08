import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import { postFixture, preFixture } from "./test-helpers";
import { predictSpenderAddress } from "../src/entrypoints/predictAddresses";
import populateSpenderCreation from "../src/entrypoints/spender-actions/spenderCreation";
import populateSpenderSetup from "../src/entrypoints/spender-actions/spenderSetup";
import { predictSpenderModifierAddress } from "../src/parts";
import {
  ISpenderModifier__factory,
  TestERC20__factory,
} from "../typechain-types";

describe("spender setup", () => {
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

  it("creates and enables a spender mod", async () => {
    const { owner1, owner2, payer, relayer } = await loadFixture(setup);

    const spenderAddress = predictSpenderAddress({
      owners: [owner1.address, owner2.address],
      threshold: 1,
    });

    const modifierAddress = predictSpenderModifierAddress(spenderAddress);

    const spenderCreationTransaction = populateSpenderCreation({
      owners: [owner1.address, owner2.address],
      threshold: 1,
    });
    await relayer.sendTransaction(spenderCreationTransaction);

    const spender = ISpenderModifier__factory.connect(spenderAddress, relayer);

    expect(await spender.isModuleEnabled(modifierAddress)).to.be.false;

    const transaction = await populateSpenderSetup(
      {
        spender: spenderAddress,
        delegate: payer.address,
        chainId: 31337,
        nonce: 0,
      },
      ({ domain, types, message }) =>
        owner1.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(transaction);

    expect(await spender.isModuleEnabled(modifierAddress)).to.be.true;

    const modifier = ISpenderModifier__factory.connect(
      modifierAddress,
      relayer
    );
    expect(await modifier.isModuleEnabled(payer.address)).to.be.true;
  });
});
