import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import { postFixture, preFixture } from "./test-helpers";
import {
  populateAccountCreation,
  populateDirectTransfer,
  predictAccountAddress,
} from "../src";
import { ISafe__factory, TestERC20__factory } from "../typechain-types";

describe("account-creation", () => {
  before(async () => {
    await preFixture();
  });

  after(async () => {
    await postFixture();
  });

  it("the default creation nonce used in the create function is correct", async () => {
    const owner = "0x8d99F8b2710e6A3B94d9bf465A98E5273069aCBd";
    const account = "0xa2F31c16B55a9392E515273D7F35cb8aA1F0a3D6";

    // equals
    expect(predictAccountAddress({ owner })).to.equal(account);
    // does not
    expect(
      predictAccountAddress({ owner, creationNonce: BigInt(0) })
    ).to.not.equal(account);
  });

  async function setup() {
    const [owner, , , relayer] = await hre.ethers.getSigners();

    const erc20 = await (
      await hre.ethers.getContractFactory("TestERC20")
    ).deploy();

    return {
      owner,
      relayer,
      token: TestERC20__factory.connect(await erc20.getAddress(), relayer),
    };
  }

  it("sets up a 1/1 safe", async () => {
    const { owner, relayer } = await loadFixture(setup);

    const predictedSafeAddress = predictAccountAddress({
      owner: owner.address,
    });

    // account not deployed
    expect(await hre.ethers.provider.getCode(predictedSafeAddress)).to.equal(
      "0x"
    );

    const accountCreationTransaction = populateAccountCreation({
      owner: owner.address,
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
    expect(await safe.isOwner(owner.address)).to.be.true;
    expect(await safe.isOwner(relayer.address)).to.be.false;
  });

  it("correctly transfer an ERC20 from a fresh safe", async () => {
    const { owner, relayer, token } = await loadFixture(setup);

    const safeAddress = predictAccountAddress({ owner: owner.address });
    await relayer.sendTransaction(
      populateAccountCreation({ owner: owner.address })
    );

    const AddressThree = "0x0000000000000000000000000000000000000003";
    const balance = 987654;
    await token.mint(safeAddress, balance);

    const transaction = await populateDirectTransfer(
      { account: safeAddress, chainId: 31337, nonce: 0 },
      {
        token: await token.getAddress(),
        to: AddressThree,
        amount: balance,
      },
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    expect(await token.balanceOf(safeAddress)).to.be.equal(balance);
    expect(await token.balanceOf(AddressThree)).to.equal(0);

    await relayer.sendTransaction(transaction);

    expect(await token.balanceOf(safeAddress)).to.equal(0);
    expect(await token.balanceOf(AddressThree)).to.be.equal(balance);
  });
});
