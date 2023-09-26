import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import {
  GNO,
  GNO_WHALE,
  fork,
  forkReset,
  moveERC20,
} from "./test-helpers/setup";
import {
  populateAccountCreation,
  populateDirectTransfer,
  predictAccountAddress,
} from "../src";
import { IERC20__factory, ISafe__factory } from "../typechain-types";

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

    expect(predictAccountAddress(owner)).to.equal(account);
  });

  async function setup() {
    const [owner, , , relayer] = await hre.ethers.getSigners();

    return { owner, relayer };
  }

  it("sets up a 1/1 safe", async () => {
    const { owner, relayer } = await loadFixture(setup);

    const predictedSafeAddress = predictAccountAddress(owner.address);

    // account not deployed
    expect(await hre.ethers.provider.getCode(predictedSafeAddress)).to.equal(
      "0x"
    );

    const accountCreationTransaction = populateAccountCreation(owner.address);
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
    const { owner, relayer } = await loadFixture(setup);

    const safeAddress = predictAccountAddress(owner.address);
    await relayer.sendTransaction(populateAccountCreation(owner.address));

    await moveERC20(GNO_WHALE, safeAddress, GNO);

    const gno = IERC20__factory.connect(GNO, hre.ethers.provider);

    const AddressThree = "0x0000000000000000000000000000000000000003";
    const balance = await gno.balanceOf(safeAddress);

    const transaction = await populateDirectTransfer(
      { safe: safeAddress, chainId: 31337, nonce: 0 },
      {
        token: GNO,
        to: AddressThree,
        amount: balance,
      },
      (domain, types, message) => owner.signTypedData(domain, types, message)
    );

    expect(await gno.balanceOf(safeAddress)).to.be.equal(balance);
    expect(await gno.balanceOf(AddressThree)).to.equal(0);

    await relayer.sendTransaction(transaction);

    expect(await gno.balanceOf(safeAddress)).to.equal(0);
    expect(await gno.balanceOf(AddressThree)).to.be.equal(balance);
  });
});
