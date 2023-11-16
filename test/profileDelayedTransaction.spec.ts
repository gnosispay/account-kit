import { expect } from "chai";
import { ZeroAddress } from "ethers";
import hre from "hardhat";

import { createInnerLimitTransaction } from "../src";
import profileDelayedTransaction, {
  DelayedTransactionType,
} from "../src/entrypoints/profileDelayedTransaction";
import { IERC20__factory } from "../typechain-types";

const AddressOne = "0x0000000000000000000000000000000000000001";

describe("profileDelayedTransaction", () => {
  it("identifies an ether transfer", async () => {
    const [account] = await hre.ethers.getSigners();

    expect(
      profileDelayedTransaction(account.address, {
        to: ZeroAddress,
        value: 1,
      })
    ).to.equal(DelayedTransactionType.EtherTransfer);

    expect(
      profileDelayedTransaction(account.address, {
        to: ZeroAddress,
        value: 1,
        data: "0x1234",
      })
    ).to.not.equal(DelayedTransactionType.EtherTransfer);
  });

  it("identifies an erc20 transfer", async () => {
    const [account] = await hre.ethers.getSigners();

    const data = IERC20__factory.createInterface().encodeFunctionData(
      "transfer",
      [AddressOne, BigInt(1)]
    );

    expect(
      profileDelayedTransaction(account.address, {
        to: ZeroAddress,
        data,
      })
    ).to.equal(DelayedTransactionType.ERC20Transfer);

    expect(
      profileDelayedTransaction(account.address, {
        to: ZeroAddress,
        data: `0x${data.slice(4)}`,
      })
    ).to.not.equal(DelayedTransactionType.ERC20Transfer);
  });
  it("identifies a limit transaction", async () => {
    const [account] = await hre.ethers.getSigners();

    const transaction = createInnerLimitTransaction(account.address, {
      refill: 1,
      period: 2,
      timestamp: 3,
    });

    expect(profileDelayedTransaction(account.address, transaction)).to.equal(
      DelayedTransactionType.LimitChange
    );

    expect(
      profileDelayedTransaction(account.address, {
        ...transaction,
        to: AddressOne,
      })
    ).to.not.equal(DelayedTransactionType.LimitChange);

    expect(
      profileDelayedTransaction(account.address, {
        ...transaction,
        data: `0x${transaction.data.slice(4)}`,
      })
    ).to.not.equal(DelayedTransactionType.LimitChange);
  });
});
