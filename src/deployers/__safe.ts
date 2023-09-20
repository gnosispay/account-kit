import {
  AbiCoder,
  ZeroAddress,
  concat,
  getCreate2Address,
  keccak256,
} from "ethers";

import deployments, { proxyCreationBytecode } from "../deployments";
import { TransactionData } from "../types";

export function populateSafeCreation(
  owner: string,
  seed: bigint
): TransactionData {
  const { iface, address: factory } = deployments.safeProxyFactory;
  const mastercopy = deployments.safeMastercopy.address;

  return {
    to: factory,
    /*
     * Safe Proxy Creation works by calling proxy factory, and including an
     * embedded setup call (the initializer)
     */
    data: iface.encodeFunctionData("createProxyWithNonce", [
      mastercopy,
      safeInitializer(owner),
      seed,
    ]),
  };
}

export function safeInitializer(owner: string) {
  /*
   * The initializer contains the calldata that invokes the setup
   * function. This is what effectively sets up the proxy's storage
   * (owner/threshold etc, other safe config)
   *
   * This calldata will be sent embedded in the the createProxy call
   * at the SafeProxyFactory
   */

  const { iface } = deployments.safeMastercopy;
  const fallbackHandlerAddress = deployments.fallbackHandler.address;

  const initializer = iface.encodeFunctionData("setup", [
    // owners
    [owner],
    // threshold
    1,
    // to - for setupModules
    ZeroAddress,
    // data - for setupModules
    "0x",
    // fallbackHandler
    fallbackHandlerAddress,
    // paymentToken
    ZeroAddress,
    // payment
    0,
    // paymentReceiver
    ZeroAddress,
  ]);

  return initializer;
}

export function predictSafeAddress(owner: string, saltNonce: bigint): string {
  const { address: factory } = deployments.safeProxyFactory;
  const { address: mastercopy } = deployments.safeMastercopy;

  const abi = AbiCoder.defaultAbiCoder();

  const salt = keccak256(
    concat([
      keccak256(safeInitializer(owner)),
      abi.encode(["uint256"], [saltNonce]),
    ])
  );

  const deploymentData = concat([
    proxyCreationBytecode,
    abi.encode(["address"], [mastercopy]),
  ]);

  return getCreate2Address(factory, salt, keccak256(deploymentData));
}
