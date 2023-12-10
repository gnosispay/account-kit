import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { keccak256, toUtf8Bytes } from "ethers";
import hre from "hardhat";

import {
  createSetupConfig,
  preFixture,
  postFixture,
} from "./test-helpers/index";

import {
  populateAccountCreation,
  populateAccountSetup,
  populateLimitEnqueue,
  populateLimitDispatch,
  predictAccountAddress,
} from "../src";
import { SPENDING_ALLOWANCE_KEY } from "../src/constants";
import { predictRolesModAddress } from "../src/parts/rolesMod";

import { IRolesModifier__factory } from "../typechain-types";

const PERIOD = 12345;
const AMOUNT = 76543;
const COOLDOWN = 120;

describe("limit", () => {
  before(async () => {
    await preFixture();
  });

  after(async () => {
    await postFixture();
  });

  async function setupAccount() {
    const [owner, spender, receiver, relayer] = await hre.ethers.getSigners();

    const erc20 = await (
      await hre.ethers.getContractFactory("TestERC20")
    ).deploy();

    const config = createSetupConfig({
      spender: spender.address,
      receiver: receiver.address,
      period: PERIOD,
      token: await erc20.getAddress(),
      allowance: AMOUNT,
      cooldown: COOLDOWN,
    });
    const account = predictAccountAddress({ owner: owner.address });

    const creationTx = populateAccountCreation({ owner: owner.address });
    const setupTx = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(creationTx);
    await relayer.sendTransaction(setupTx);

    return {
      account,
      owner,
      spender,
      receiver,
      relayer,
      rolesMod: IRolesModifier__factory.connect(
        predictRolesModAddress(account),
        relayer
      ),
      config,
    };
  }

  it("sets allowance", async () => {
    const { account, owner, relayer, rolesMod } =
      await loadFixture(setupAccount);

    const enqueueTx = await populateLimitEnqueue(
      { account, chainId: 31337 },
      { refill: 1, period: 1 },
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    const executeTx = populateLimitDispatch(
      { account },
      {
        refill: 1,
        period: 1,
      }
    );

    let allowance = await rolesMod.allowances(SPENDING_ALLOWANCE_KEY);
    expect(allowance.period).to.equal(12345);
    expect(allowance.refill).to.equal(76543);

    await relayer.sendTransaction(enqueueTx);

    allowance = await rolesMod.allowances(SPENDING_ALLOWANCE_KEY);
    expect(allowance.period).to.equal(12345);
    expect(allowance.balance).to.equal(76543);

    // is reverted before cooldown
    await expect(relayer.sendTransaction(executeTx)).to.be.revertedWith(
      "Transaction is still in cooldown"
    );
    await mine(2, { interval: 120 });
    // works after cooldown
    await expect(relayer.sendTransaction(executeTx)).to.not.be.reverted;

    allowance = await rolesMod.allowances(SPENDING_ALLOWANCE_KEY);
    expect(allowance.period).to.equal(1);
    expect(allowance.balance).to.equal(1);
  });
  it("only owner can set allowance", async () => {
    const { account, owner, spender, relayer, rolesMod } =
      await loadFixture(setupAccount);

    let enqueueTx = await populateLimitEnqueue(
      { account, chainId: 31337 },
      { refill: 7, period: 7 },
      ({ domain, types, message }) =>
        spender.signTypedData(domain, types, message)
    );
    await expect(relayer.sendTransaction(enqueueTx)).to.be.reverted;

    enqueueTx = await populateLimitEnqueue(
      { account, chainId: 31337 },
      { refill: 7, period: 7 },
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    await relayer.sendTransaction(enqueueTx);

    await mine(2, { interval: 120 });

    const executeTx = populateLimitDispatch(
      { account },
      {
        refill: 7,
        period: 7,
      }
    );
    await expect(relayer.sendTransaction(executeTx)).to.not.be.reverted;

    const allowance = await rolesMod.allowances(SPENDING_ALLOWANCE_KEY);
    expect(allowance.period).to.equal(7);
    expect(allowance.balance).to.equal(7);
  });

  it("reverts on replayed set allowance tx", async () => {
    const { account, owner, relayer, rolesMod } =
      await loadFixture(setupAccount);

    const allowance = await rolesMod.allowances(SPENDING_ALLOWANCE_KEY);
    expect(allowance.period).to.equal(12345);
    expect(allowance.refill).to.equal(76543);

    const enqueueTx = await populateLimitEnqueue(
      { account, chainId: 31337 },
      { refill: 1, period: 1 },
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    const enqueueTxWithSalt = await populateLimitEnqueue(
      { account, chainId: 31337, salt: keccak256(toUtf8Bytes("Hello World!")) },
      { refill: 1, period: 1 },
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    await expect(relayer.sendTransaction(enqueueTx)).to.not.be.reverted;
    await expect(relayer.sendTransaction(enqueueTxWithSalt)).to.not.be.reverted;

    await expect(
      relayer.sendTransaction(enqueueTx)
    ).to.be.revertedWithCustomError(rolesMod, "HashAlreadyConsumed");

    await expect(
      relayer.sendTransaction(enqueueTxWithSalt)
    ).to.be.revertedWithCustomError(rolesMod, "HashAlreadyConsumed");
  });
});
