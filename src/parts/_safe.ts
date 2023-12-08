import { bytecode as creationBytecode } from "@gnosis.pm/safe-contracts/build/artifacts/contracts/proxies/GnosisSafeProxy.sol/GnosisSafeProxy.json";
import {
  AbiCoder,
  ZeroAddress,
  concat,
  getCreate2Address,
  keccak256,
} from "ethers";

import deployments from "../deployments";

import { TransactionRequest } from "../types";

export function _predictSafeAddress({
  owners,
  threshold = 1,
  creationNonce,
}: {
  owners: string[];
  threshold?: number;
  creationNonce: bigint;
}): string {
  const { address: factory } = deployments.safeProxyFactory;
  const { address: mastercopy } = deployments.safeMastercopy;

  const abi = AbiCoder.defaultAbiCoder();

  const salt = keccak256(
    concat([
      keccak256(safeInitializer({ owners, threshold })),
      abi.encode(["uint256"], [creationNonce]),
    ])
  );

  const deploymentData = concat([
    creationBytecode,
    abi.encode(["address"], [mastercopy]),
  ]);

  return getCreate2Address(factory, salt, keccak256(deploymentData));
}

export function _populateSafeCreation({
  owners,
  threshold = 1,
  creationNonce,
}: {
  owners: string[];
  threshold?: number;
  creationNonce: bigint;
}): TransactionRequest {
  const { iface, address: factory } = deployments.safeProxyFactory;
  const mastercopy = deployments.safeMastercopy.address;

  return {
    to: factory,
    value: 0,
    /*
     * Safe Proxy Creation works by calling proxy factory, and including an
     * embedded setup call (the initializer)
     */
    data: iface.encodeFunctionData("createProxyWithNonce", [
      mastercopy,
      safeInitializer({ owners, threshold }),
      creationNonce,
    ]),
  };
}

function safeInitializer({
  owners,
  threshold,
}: {
  owners: string[];
  threshold: number;
}) {
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
    owners,
    // threshold
    threshold,
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
