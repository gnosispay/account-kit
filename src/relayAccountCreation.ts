import {
  Interface,
  concat,
  defaultAbiCoder,
  getCreate2Address,
  keccak256,
  toUtf8Bytes,
} from "ethers/lib/utils.js";
import { TransactionRequest } from "@ethersproject/providers";

import deployments, { proxyCreationBytecode } from "./deployments";

export const AddressZero = "0x0000000000000000000000000000000000000000";

export function populateCreateAccount(
  ownerAddress: string,
  chainId: number
): TransactionRequest {
  const proxyFactoryAddress =
    deployments.proxyFactory.networkAddresses[chainId];
  const mastercopyAddress = deployments.safe.networkAddresses[chainId];
  const proxyFactoryInterface = new Interface(deployments.proxyFactory.abi);

  return {
    chainId,

    to: proxyFactoryAddress,
    /*
     * Safe Proxy Creation works by calling proxy factory, and including an
     * embedded setup call (the initializer)
     */
    data: proxyFactoryInterface.encodeFunctionData("createProxyWithNonce", [
      mastercopyAddress,
      getInitializer(ownerAddress),
      getSaltNonce(),
    ]),
  };
}

export function predictSafeAddress(ownerAddress: string): string {
  const factoryAddress = deployments.proxyFactory.networkAddresses[100];
  const mastercopyAddress = deployments.safe.networkAddresses[100];

  const salt = keccak256(
    concat([keccak256(getInitializer(ownerAddress)), getSaltNonce()])
  );

  const deploymentData = concat([
    proxyCreationBytecode,
    defaultAbiCoder.encode(["address"], [mastercopyAddress]),
  ]);

  return getCreate2Address(factoryAddress, salt, keccak256(deploymentData));
}

function getSaltNonce() {
  if (!process.env.NEXT_PUBLIC_SAFE_SALT_SEED) {
    throw new Error("NEXT_PUBLIC_SAFE_SALT_SEED not set");
  }
  return keccak256(toUtf8Bytes(process.env.NEXT_PUBLIC_SAFE_SALT_SEED));
}

function getInitializer(ownerAddress: string) {
  /*
   * The initializer contains the calldata that invokes the setup
   * function. This is what effectively sets up the proxy's storage
   * (owner/threshold etc, other safe config)
   *
   * This calldata will be sent embedded in the the createProxy call
   * at the SafeProxyFactory
   */

  const safeInterface = new Interface(deployments.safe.abi);
  const fallbackHandlerAddress =
    deployments.fallbackHandler.networkAddresses[100];

  const initializer = safeInterface.encodeFunctionData("setup", [
    // owners
    [ownerAddress],
    // threshold
    1,
    // to - for setupModules
    AddressZero,
    // data - for setupModules
    "0x",
    // fallbackHandler
    fallbackHandlerAddress,
    // paymentToken
    AddressZero,
    // payment
    0,
    // paymentReceiver
    AddressZero,
  ]);

  return initializer;
}
