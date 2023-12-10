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

    const creationNonce = BigInt(
      "5114647649581446628743670001764890754687493338792207058163325042301318925668"
    );

    // equals
    expect(predictAccountAddress({ owner })).to.equal(account);

    expect(
      predictAccountAddress({
        owner,
        creationNonce,
      })
    ).to.equal(account);
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

    const accountAddress = predictAccountAddress({
      owner: owner.address,
    });
    const creationTx = populateAccountCreation({
      owner: owner.address,
    });
    const account = ISafe__factory.connect(accountAddress, hre.ethers.provider);

    // account not deployed
    expect(await hre.ethers.provider.getCode(accountAddress)).to.equal("0x");
    await relayer.sendTransaction(creationTx);

    // account deployed
    expect(await hre.ethers.provider.getCode(accountAddress)).to.not.equal(
      "0x"
    );
    expect(await account.isOwner(owner.address)).to.be.true;
    expect(await account.isOwner(relayer.address)).to.be.false;
  });

  it("correctly transfer an ERC20 from a fresh safe", async () => {
    const { owner, relayer, token } = await loadFixture(setup);

    const AddressThree = "0x0000000000000000000000000000000000000003";
    const balance = 987654;

    const accountAddress = predictAccountAddress({ owner: owner.address });
    const creationTx = populateAccountCreation({ owner: owner.address });

    const transferTx = await populateDirectTransfer(
      { account: accountAddress, chainId: 31337, nonce: 0 },
      {
        token: await token.getAddress(),
        to: AddressThree,
        amount: balance,
      },
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    await token.mint(accountAddress, balance);
    expect(await token.balanceOf(accountAddress)).to.be.equal(balance);
    expect(await token.balanceOf(AddressThree)).to.equal(0);

    await relayer.sendTransaction(creationTx);
    await relayer.sendTransaction(transferTx);

    expect(await token.balanceOf(accountAddress)).to.equal(0);
    expect(await token.balanceOf(AddressThree)).to.be.equal(balance);
  });
});
