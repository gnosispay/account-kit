import { AbiCoder, ZeroHash } from "ethers";

import { _predictZodiacModAddress } from "./_zodiacMod";
import deployments from "../deployments";

import { TransactionRequest } from "../types";

export function predictSpenderModAddress(safe: string): string {
  return _predictZodiacModAddress(
    deployments.spenderModMastercopy.address,
    encodeSetUp(safe)
  );
}

export function populateSpenderModCreation(safe: string): TransactionRequest {
  const { moduleProxyFactory } = deployments;

  return {
    to: moduleProxyFactory.address,
    value: 0,
    data: moduleProxyFactory.iface.encodeFunctionData("deployModule", [
      deployments.spenderModMastercopy.address,
      encodeSetUp(safe),
      ZeroHash,
    ]),
  };
}

function encodeSetUp(safe: string) {
  const initializer = AbiCoder.defaultAbiCoder().encode(["address"], [safe]);

  return deployments.spenderModMastercopy.iface.encodeFunctionData("setUp", [
    initializer,
  ]);
}
