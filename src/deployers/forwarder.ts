import { getSingletonFactoryInfo } from "@safe-global/safe-singleton-factory";
import { AbiCoder, concat, ZeroHash } from "ethers";

import { predictSingletonAddress } from "./__singleton";
import { predictRolesAddress } from "./roles";

import {
  IRolesModifier__factory,
  SinglePurposeForwarder__factory,
} from "../../typechain-types";
import { TransactionData } from "../types";

export function predictForwarderAddress({ safe }: { safe: string }) {
  return predictSingletonAddress(creationBytecode(safe));
}

export function populateForwarderCreation({
  safe,
}: {
  safe: string;
}): TransactionData {
  const factory = getSingletonFactoryInfo(1)?.address as string; // 1 or 100 same

  return {
    to: factory,
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
