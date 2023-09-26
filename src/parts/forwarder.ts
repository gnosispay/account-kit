import {
  AbiCoder,
  concat,
  getCreate2Address,
  keccak256,
  ZeroHash,
} from "ethers";

import { predictRolesAddress } from "./roles";

import {
  IRolesModifier__factory,
  SinglePurposeForwarder__factory,
} from "../../typechain-types";
import deployments from "../deployments";
import { TransactionData } from "../types";

export function predictForwarderAddress({ safe }: { safe: string }) {
  const salt = ZeroHash;

  return getCreate2Address(
    deployments.singletonFactory.address,
    salt,
    keccak256(creationBytecode(safe))
  );
}

export function populateForwarderCreation({
  safe,
}: {
  safe: string;
}): TransactionData {
  return {
    to: deployments.singletonFactory.address,
    data: `${ZeroHash}${creationBytecode(safe).slice(2)}`,
  };
}

function creationBytecode(safe: string) {
  const from = safe;
  const to = predictRolesAddress(safe);
  const selector =
    IRolesModifier__factory.createInterface().getFunction(
      "setAllowance"
    ).selector;

  // encode the creationBytecode
  return concat([
    SinglePurposeForwarder__factory.bytecode,
    AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "bytes4"],
      [from, to, selector]
    ),
  ]);
}
