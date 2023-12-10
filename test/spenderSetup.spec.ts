import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { concat } from "ethers";
import hre from "hardhat";

import { postFixture, preFixture } from "./test-helpers";
import populateSpenderSetup from "../src/entrypoints/spender-actions/spenderSetup";
import {
  _populateSafeCreation,
  _predictSafeAddress,
  predictSpenderModAddress,
} from "../src/parts";
import {
  ISafe__factory,
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
    const [owner1, owner2, owner3, delegate, relayer] =
      await hre.ethers.getSigners();

    const erc20 = await (
      await hre.ethers.getContractFactory("TestERC20")
    ).deploy();

    return {
      owner1,
      owner2,
      owner3,
      delegate,
      relayer,
      token: TestERC20__factory.connect(await erc20.getAddress(), relayer),
    };
  }

  it("creates and enables a spender mod", async () => {
    const { owner1, owner2, delegate, relayer } = await loadFixture(setup);

    const spenderCreationArgs = {
      owners: [owner1.address, owner2.address],
      threshold: 1,
      creationNonce: BigInt(999),
    };

    const spenderAddress = _predictSafeAddress(spenderCreationArgs);
    const spenderModAddress = predictSpenderModAddress(spenderAddress);
    const creationTx = _populateSafeCreation(spenderCreationArgs);
    const transaction = await populateSpenderSetup(
      {
        spender: spenderAddress,
        delegate: delegate.address,
        chainId: 31337,
        nonce: 0,
      },
      ({ domain, types, message }) =>
        owner1.signTypedData(domain, types, message)
    );

    const spender = ISafe__factory.connect(spenderAddress, relayer);
    const spenderMod = ISpenderModifier__factory.connect(
      spenderModAddress,
      relayer
    );

    await relayer.sendTransaction(creationTx);
    expect(await spender.isModuleEnabled(spenderModAddress)).to.be.false;

    await relayer.sendTransaction(transaction);
    expect(await spender.isModuleEnabled(spenderModAddress)).to.be.true;
    expect(await spenderMod.isModuleEnabled(delegate.address)).to.be.true;
  });

  it("creates and enables a spender, threshold 2", async () => {
    const { owner1, owner2, delegate, relayer } = await loadFixture(setup);

    const args = {
      owners: [owner1.address, owner2.address],
      threshold: 2,
      creationNonce: BigInt(333),
    };

    const spenderAddress = _predictSafeAddress(args);
    const creationTx = _populateSafeCreation(args);

    const spenderModAddress = predictSpenderModAddress(spenderAddress);
    const setupTx = await populateSpenderSetup(
      {
        spender: spenderAddress,
        delegate: delegate.address,
        chainId: 31337,
        nonce: 0,
      },
      async ({ domain, types, message }) => {
        const [signer1, signer2] = [owner1, owner2].sort((a, b) =>
          a.address < b.address ? -1 : 1
        );

        return concat([
          await signer1.signTypedData(domain, types, message),
          await signer2.signTypedData(domain, types, message),
        ]);
      }
    );
    const spender = ISafe__factory.connect(spenderAddress, relayer);
    const spenderMod = ISpenderModifier__factory.connect(
      spenderModAddress,
      relayer
    );

    await relayer.sendTransaction(creationTx);
    expect(await spender.isOwner(owner1.address)).to.be.true;
    expect(await spender.isOwner(owner2.address)).to.be.true;
    expect(await spender.isModuleEnabled(spenderModAddress)).to.be.false;

    await relayer.sendTransaction(setupTx);
    expect(await spender.isModuleEnabled(spenderModAddress)).to.be.true;
    expect(await spenderMod.isModuleEnabled(delegate.address)).to.be.true;
  });
});
