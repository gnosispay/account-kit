import { AbiCoder, ZeroHash } from "ethers";

import { _predictZodiacModAddress } from "./_zodiacMod";
import deployments from "../deployments";
import { TransactionData } from "../types";

export function predictRolesAddress(safe: string): string {
  return _predictZodiacModAddress(
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
  const owner = safe;
  const avatar = safe;
  const target = safe;

  const initializer = AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address"],
    [owner, avatar, target]
  );

  return deployments.rolesMastercopy.iface.encodeFunctionData("setUp", [
    initializer,
  ]);
}
