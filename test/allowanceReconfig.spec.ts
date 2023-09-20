import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
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
  populateAllowanceReconfig,
  predictDelayAddress,
  predictSafeAddress,
  predictRolesAddress,
} from "../src";
import { ALLOWANCE_KEY } from "../src/entrypoints/predictModuleAddress";
import {
  IDelayModule__factory,
  IRolesModifier__factory,
  ISafe__factory,
} from "../typechain-types";

const PERIOD = 12345;
const AMOUNT = 76543;

describe("allowanceReconfig", () => {
  before(async () => {
    await fork(29800000);
  });

  after(async () => {
    await forkReset();
  });

  async function setupAccount() {
    const [eoa, spender, receiver, other, relayer] =
      await hre.ethers.getSigners();

    const config = createAccountConfig({
      spender: spender.address,
      receiver: receiver.address,
      period: PERIOD,
      token: GNO,
      allowance: AMOUNT,
    });
    const safeAddress = predictSafeAddress(eoa.address);
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
      other,
      relayer,
      safe: ISafe__factory.connect(safeAddress, relayer),
      delay: IDelayModule__factory.connect(delayAddress, relayer),
      roles: IRolesModifier__factory.connect(rolesAddress, relayer),
      safeAddress: safeAddress,
      config,
    };
  }

  it("correctly reconfigures allowance", async () => {
    const { eoa, roles, safeAddress, config } = await loadFixture(setupAccount);

    let allowance = await roles.allowances(ALLOWANCE_KEY);
    expect(allowance.refillInterval).to.not.equal(1);
    expect(allowance.refillAmount).to.not.equal(1);

    const transaction = populateAllowanceReconfig(
      { eoa: eoa.address, safe: safeAddress },
      { refill: 1, period: 1 }
    );

    await eoa.sendTransaction(transaction);

    allowance = await roles.allowances(ALLOWANCE_KEY);
    expect(allowance.refillInterval).to.equal(1);
    expect(allowance.refillAmount).to.equal(1);
  });

  it("only eoa can reconfigure allowance", async () => {
    const { eoa, spender, receiver, safeAddress, roles } =
      await loadFixture(setupAccount);

    const transaction = populateAllowanceReconfig(
      { eoa: eoa.address, safe: safeAddress },
      { refill: 7, period: 7 }
    );

    const rolesAddress = predictRolesAddress(safeAddress);
    await expect(spender.sendTransaction(transaction)).to.be.reverted;
    await expect(receiver.sendTransaction(transaction)).to.be.reverted;
    await expect(eoa.sendTransaction({ ...transaction, to: rolesAddress })).to
      .be.reverted;
    await eoa.sendTransaction(transaction);

    const allowance = await roles.allowances(ALLOWANCE_KEY);
    expect(allowance.refillInterval).to.equal(7);
    expect(allowance.refillAmount).to.equal(7);
  });
});
