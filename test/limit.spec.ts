import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import {
  GNO,
  GNO_WHALE,
  createAccountConfig,
  fork,
  forkReset,
  moveERC20,
} from "./test-helpers/setup";

import {
  populateAccountCreation,
  populateAccountSetup,
  populateLimitEnqueue,
  populateLimitDispatch,
  predictAccountAddress,
} from "../src";
import { ALLOWANCE_SPENDING_KEY } from "../src/constants";
import { predictDelayAddress } from "../src/parts/delay";
import { predictRolesAddress } from "../src/parts/roles";

import {
  IDelayModule__factory,
  IRolesModifier__factory,
  ISafe__factory,
} from "../typechain-types";

const PERIOD = 12345;
const AMOUNT = 76543;
const COOLDOWN = 120;

describe("limit", () => {
  before(async () => {
    await fork(29800000);
  });

  after(async () => {
    await forkReset();
  });

  async function setupAccount() {
    const [eoa, spender, receiver, relayer] = await hre.ethers.getSigners();

    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
      period: PERIOD,
      token: GNO,
      allowance: AMOUNT,
      cooldown: COOLDOWN,
    });
    const safeAddress = predictAccountAddress(eoa.address);
    const delayAddress = predictDelayAddress(safeAddress);
    const rolesAddress = predictRolesAddress(safeAddress);
    await moveERC20(GNO_WHALE, safeAddress, GNO, 2000);

    const creationTx = populateAccountCreation(eoa.address);
    const setupTx = await populateAccountSetup(
      { eoa: eoa.address, safe: safeAddress, chainId: 31337, nonce: 0 },
      config,
      (domain, types, message) => eoa.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(creationTx);
    await relayer.sendTransaction(setupTx);

    return {
      eoa,
      spender,
      receiver,
      relayer,
      safe: ISafe__factory.connect(safeAddress, relayer),
      delay: IDelayModule__factory.connect(delayAddress, relayer),
      roles: IRolesModifier__factory.connect(rolesAddress, relayer),
      safeAddress,
      config,
    };
  }

  it("sets allowance", async () => {
    const { eoa, relayer, roles, safeAddress } =
      await loadFixture(setupAccount);

    let allowance = await roles.allowances(ALLOWANCE_SPENDING_KEY);
    expect(allowance.refillInterval).to.equal(12345);
    expect(allowance.refillAmount).to.equal(76543);

    const enqueueTx = await populateLimitEnqueue(
      { eoa: eoa.address, safe: safeAddress, chainId: 31337, nonce: 0 },
      { refill: 1, period: 1 },
      (...args) => eoa.signTypedData(...args)
    );

    const executeTx = populateLimitDispatch(
      { safe: safeAddress },
      { refill: 1, period: 1 }
    );

    await expect(relayer.sendTransaction(enqueueTx)).to.not.be.reverted;

    allowance = await roles.allowances(ALLOWANCE_SPENDING_KEY);
    expect(allowance.refillInterval).to.equal(12345);
    expect(allowance.refillAmount).to.equal(76543);

    // is reverted before cooldown
    await expect(relayer.sendTransaction(executeTx)).to.be.reverted;
    await mine(2, { interval: 120 });
    // works after cooldown
    await expect(relayer.sendTransaction(executeTx)).to.not.be.reverted;

    allowance = await roles.allowances(ALLOWANCE_SPENDING_KEY);
    expect(allowance.refillInterval).to.equal(1);
    expect(allowance.refillAmount).to.equal(1);
  });

  it("only eoa can set allowance", async () => {
    const { eoa, spender, relayer, safeAddress, roles } =
      await loadFixture(setupAccount);

    let enqueueTx = await populateLimitEnqueue(
      { eoa: eoa.address, safe: safeAddress, chainId: 31337, nonce: 0 },
      { refill: 7, period: 7 },
      (...args) => spender.signTypedData(...args)
    );
    await expect(relayer.sendTransaction(enqueueTx)).to.be.reverted;

    enqueueTx = await populateLimitEnqueue(
      { eoa: eoa.address, safe: safeAddress, chainId: 31337, nonce: 0 },
      { refill: 7, period: 7 },
      (...args) => eoa.signTypedData(...args)
    );
    await relayer.sendTransaction(enqueueTx);

    await mine(2, { interval: 120 });

    const executeTx = populateLimitDispatch(
      { safe: safeAddress },
      { refill: 7, period: 7 }
    );
    await expect(relayer.sendTransaction(executeTx)).to.not.be.reverted;

    const allowance = await roles.allowances(ALLOWANCE_SPENDING_KEY);
    expect(allowance.refillInterval).to.equal(7);
    expect(allowance.refillAmount).to.equal(7);
  });
});
