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
  populateTokenTransfer,
  predictSafeAddress,
} from "../src";
import { IERC20__factory } from "../typechain-types";

describe("token-transfer", () => {
  before(async () => {
    await fork(29822842);
  });

  after(async () => {
    await forkReset();
  });

  async function createAccount() {
    const [owner, , , relayer] = await hre.ethers.getSigners();

    const predictedAccountAddress = predictSafeAddress(owner.address);

    await relayer.sendTransaction(populateAccountCreation(owner.address));

    await moveERC20(GNO_WHALE, predictedAccountAddress, GNO);

    return { owner, safeAddress: predictedAccountAddress };
  }

  it("correctly transfer an ERC20 from the safe with a Signature", async () => {
    const { owner, safeAddress } = await loadFixture(createAccount);
    const [, , , , notTheOwner] = await hre.ethers.getSigners();
    const gno = IERC20__factory.connect(GNO, hre.ethers.provider);

    const AddressThree = "0x0000000000000000000000000000000000000003";
    const balance = await gno.balanceOf(safeAddress);

    const transaction = await populateTokenTransfer(
      { account: safeAddress, chainId: 31337, nonce: 0 },
      {
        token: GNO,
        to: AddressThree,
        amount: balance,
      },
      (domain, types, message) => owner.signTypedData(domain, types, message)
    );

    expect(await gno.balanceOf(safeAddress)).to.be.equal(balance);
    expect(await gno.balanceOf(AddressThree)).to.equal(0);

    await notTheOwner.sendTransaction(transaction);

    expect(await gno.balanceOf(safeAddress)).to.equal(0);
    expect(await gno.balanceOf(AddressThree)).to.be.equal(balance);
  });
});
