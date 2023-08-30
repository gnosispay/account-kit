import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import { fork, forkReset, moveERC20 } from "./test-helpers/setup";
import {
  populateAccountCreationTransaction,
  populateTokenTransferTransaction,
  predictSafeAddress,
} from "../src";
import { IERC20__factory } from "../typechain-types";
import { signTokenTransfer } from "../src/entrypoints/token-transfer";

describe("token-transfer", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  const DAI_WHALE = "0x075e72a5edf65f0a5f44699c7654c1a76941ddc8";

  async function createAccount() {
    const [owner, , , relayer] = await hre.ethers.getSigners();

    const predictedAccountAddress = predictSafeAddress(owner.address);

    await relayer.sendTransaction(
      populateAccountCreationTransaction(owner.address)
    );

    await moveERC20(DAI_WHALE, predictedAccountAddress, DAI);

    return { owner, safeAddress: predictedAccountAddress };
  }

  it("correctly transfer an ERC20 from the safe with a Signature", async () => {
    const { owner, safeAddress } = await loadFixture(createAccount);
    const [, , , , notTheOwner] = await hre.ethers.getSigners();
    const dai = IERC20__factory.connect(DAI, hre.ethers.provider);

    const AddressThree = "0x0000000000000000000000000000000000000003";
    const balance = await dai.balanceOf(safeAddress);

    const signature = await signTokenTransfer(
      safeAddress,
      31337,
      {
        token: DAI,
        to: AddressThree,
        amount: balance,
      },
      0,
      (domain, types, message) => owner.signTypedData(domain, types, message)
    );

    const trasnferTokenTransaction = populateTokenTransferTransaction(
      safeAddress,
      {
        token: DAI,
        to: AddressThree,
        amount: balance,
      },
      signature
    );

    expect(await dai.balanceOf(safeAddress)).to.be.equal(balance);
    expect(await dai.balanceOf(AddressThree)).to.equal(0);

    await notTheOwner.sendTransaction(trasnferTokenTransaction);

    expect(await dai.balanceOf(safeAddress)).to.equal(0);
    expect(await dai.balanceOf(AddressThree)).to.be.equal(balance);
  });
});
