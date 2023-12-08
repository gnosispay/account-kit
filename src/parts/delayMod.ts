import { AbiCoder, ZeroHash } from "ethers";

import { _predictZodiacModAddress } from "./_zodiacMod";
import deployments from "../deployments";

import { TransactionRequest } from "../types";

export function predictDelayModAddress(safe: string): string {
  return _predictZodiacModAddress(
    deployments.delayModMastercopy.address,
    encodeSetUp(safe)
  );
}

export function populateDelayModCreation(safe: string): TransactionRequest {
  const { moduleProxyFactory } = deployments;

  return {
    to: moduleProxyFactory.address,
    value: 0,
    data: moduleProxyFactory.iface.encodeFunctionData("deployModule", [
      deployments.delayModMastercopy.address,
      encodeSetUp(safe),
      ZeroHash,
    ]),
  };
}

function encodeSetUp(safe: string) {
  const initializer = AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "uint256", "uint256"],
    [safe, safe, safe, 0, 0]
  );

  return deployments.delayModMastercopy.iface.encodeFunctionData("setUp", [
    initializer,
  ]);
}
