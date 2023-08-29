import hre from "hardhat";

import deploySafeProxy from "./deploySafeProxy";
import deploySingletons from "./deploySingletons";
import execTransaction from "./execSafeTransaction";
import deployments from "../../src/deployments";
import { IAllowanceMod__factory, ISafe__factory } from "../../typechain-types";

export default async function setup() {
  const [owner, alice, bob, deployer, relayer] = await hre.ethers.getSigners();

  const { safeProxyFactoryAddress, safeMastercopyAddress } =
    await deploySingletons(deployer);

  const allowanceModuleAddress = deployments.allowanceSingleton.defaultAddress;

  const safeAddress = await deploySafeProxy(
    safeProxyFactoryAddress,
    safeMastercopyAddress,
    owner.address,
    deployer
  );

  // both the safe and the allowance work by signature
  // connect the contracts to a signer that has funds
  // but isn't safe owner, or allowance spender
  const safe = ISafe__factory.connect(safeAddress, relayer);
  const allowanceModule = IAllowanceMod__factory.connect(
    allowanceModuleAddress,
    relayer
  );

  // enable Allowance as mod
  await execTransaction(
    safe,
    await safe.enableModule.populateTransaction(allowanceModuleAddress),
    owner
  );

  return {
    // the deployed safe
    safe,
    // singletons
    allowanceModule,
    // some signers
    owner,
    alice,
    bob,
  };
}
