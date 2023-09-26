import { AbiCoder, ZeroHash } from "ethers";

import { _predictZodiacModAddress } from "./_zodiacMod";

import deployments from "../deployments";
import { TransactionData } from "../types";

export function predictDelayAddress(safe: string): string {
  return _predictZodiacModAddress(
    deployments.delayMastercopy.address,
    encodeSetUp(safe)
  );
}

export function populateDelayCreation(safe: string): TransactionData {
  const { moduleProxyFactory } = deployments;

  return {
    to: moduleProxyFactory.address,
    data: moduleProxyFactory.iface.encodeFunctionData("deployModule", [
      deployments.delayMastercopy.address,
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

  return deployments.delayMastercopy.iface.encodeFunctionData("setUp", [
    initializer,
  ]);
}
