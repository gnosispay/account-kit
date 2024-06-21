import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { keccak256, toUtf8Bytes } from "ethers";
import hre from "hardhat";
import { createSetupConfig, postFixture, preFixture } from "./test-helpers";
import {
  populateAccountCreation,
  populateAccountSetup,
  populateSignMessageDispatch,
  populateSignMessageEnqueue,
  predictAccountAddress,
} from "../src";
import { predictDelayModAddress } from "../src/parts";
import { IDelayModifier__factory } from "../typechain-types";

const PERIOD = 12345;
const AMOUNT = 76543;
const COOLDOWN = 120;

const MESSAGE = "Hello World!";
const SALT = keccak256(toUtf8Bytes(MESSAGE));

describe("signMessage", () => {
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
      delayMod: IDelayModifier__factory.connect(
        predictDelayModAddress(account),
        relayer
      ),
      config,
    };
  }

  it("signs message enqueue", async () => {
    const { account, owner, relayer } = await loadFixture(setupAccount);

    const enqueueTx = await populateSignMessageEnqueue(
      { account, chainId: 31337 },
      MESSAGE,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    await expect(relayer.sendTransaction(enqueueTx)).to.not.be.reverted;
  });

  it("executes signed message", async () => {
    const { account, owner, relayer } = await loadFixture(setupAccount);

    const enqueueTx = await populateSignMessageEnqueue(
      { account, chainId: 31337, salt: SALT },
      MESSAGE,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    await expect(relayer.sendTransaction(enqueueTx)).to.not.be.reverted;

    const executeTx = populateSignMessageDispatch({ account }, MESSAGE);

    // we try to send the dispatch tx, but gets reverted before cooldown
    await expect(relayer.sendTransaction(executeTx)).to.be.revertedWith(
      "Transaction is still in cooldown"
    );

    await mine(2, { interval: 120 });

    await expect(relayer.sendTransaction(executeTx)).to.not.be.reverted;
  });

  it("prevents replaying signed message", async () => {
    const { account, owner, relayer } = await loadFixture(setupAccount);

    const enqueueTx = await populateSignMessageEnqueue(
      { account, chainId: 31337, salt: SALT },
      MESSAGE,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    await expect(relayer.sendTransaction(enqueueTx)).to.not.be.reverted;
    await mine(2, { interval: 120 });

    const executeTx = populateSignMessageDispatch({ account }, MESSAGE);

    await expect(relayer.sendTransaction(executeTx)).to.not.be.reverted;

    await expect(relayer.sendTransaction(executeTx)).to.be.reverted;
  });
});
