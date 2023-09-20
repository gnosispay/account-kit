import { AbiCoder, ZeroHash } from "ethers";

import { predictZodiacModAddress } from "./__zodiacMod";
import deployments from "../deployments";
import { TransactionData } from "../types";

export function predictRolesAddress(safe: string): string {
  return predictZodiacModAddress(
    deployments.rolesMastercopy.address,
    encodeSetUp(safe)
  );
}

export function populateRolesCreation(safe: string): TransactionData {
  const { moduleProxyFactory } = deployments;

  return {
    to: moduleProxyFactory.address,
    data: moduleProxyFactory.iface.encodeFunctionData("deployModule", [
      deployments.rolesMastercopy.address,
      encodeSetUp(safe),
      ZeroHash,
    ]),
  };
}

function encodeSetUp(safe: string) {
  const initializer = AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address"],
    [safe, safe, safe]
  );

  return deployments.rolesMastercopy.iface.encodeFunctionData("setUp", [
    initializer,
  ]);
}
