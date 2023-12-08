import {
  AbiCoder,
  concat,
  getCreate2Address,
  keccak256,
  ZeroHash,
} from "ethers";

import { predictRolesModAddress } from "./rolesMod";

import { Bouncer__factory } from "../../typechain-types";
import deployments from "../deployments";

import { TransactionRequest } from "../types";

export function predictBouncerAddress(safe: string) {
  const salt = ZeroHash;

  return getCreate2Address(
    deployments.singletonFactory.address,
    salt,
    keccak256(creationBytecode(safe))
  );
}

export function populateBouncerCreation(safe: string): TransactionRequest {
  return {
    to: deployments.singletonFactory.address,
    value: 0,
    data: `${ZeroHash}${creationBytecode(safe).slice(2)}`,
  };
}

function creationBytecode(safe: string) {
  const from = safe;
  const to = predictRolesModAddress(safe);
  const { selector } =
    deployments.rolesModMastercopy.iface.getFunction("setAllowance");

  // encode the creationBytecode
  return concat([
    Bouncer__factory.bytecode,
    AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "bytes4"],
      [from, to, selector]
    ),
  ]);
}
