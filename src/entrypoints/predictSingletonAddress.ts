import {
  getSingletonFactoryInfo,
  SingletonFactoryInfo,
} from "@safe-global/safe-singleton-factory";
import assert from "assert";
import { AbiCoder, getCreate2Address, keccak256, ZeroHash } from "ethers";
import {
  IRolesModifier__factory,
  SinglePurposeForwarder__factory,
} from "../../typechain-types";
import { predictRolesAddress } from "./predictModuleAddress";

export function predictForwarderAddress({
  owner,
  safe,
}: {
  owner: string;
  safe: string;
}) {
  return predictSingletonAddress(forwarderBytecode({ owner, safe }));
}

export function forwarderBytecode({
  owner,
  safe,
}: {
  owner: string;
  safe: string;
}) {
  const selector =
    IRolesModifier__factory.createInterface().getFunction(
      "setAllowance"
    ).selector;

  // encode the creationBytecode
  return AbiCoder.defaultAbiCoder().encode(
    ["bytes", "address", "address", "bytes4"],
    [
      SinglePurposeForwarder__factory.bytecode,
      owner,
      predictRolesAddress(safe),
      selector,
    ]
  );
}

/*
 * Bytecode Types:
 *
 * Creation Bytecode: This is the code that generates the runtime bytecode. It includes the
 * constructor logic and constructor parameters of a smart contract. The creation bytecode is
 * equivalent to the input data of the transaction that creates a contract. When you compile a
 * contract, the creation bytecode is generated for you.
 *
 * Runtime Bytecode: This is the code that is stored on-chain and describes a smart contract. It
 * does not include the constructor logic or constructor parameters of a contract, as they are not
 * relevant to the code used to create the contract1.
 *
 */

function predictSingletonAddress(creationBytecode: string) {
  const info = getSingletonFactoryInfo(1) as SingletonFactoryInfo;
  assert(!!info);
  const salt = ZeroHash;

  return getCreate2Address(info.address, salt, keccak256(creationBytecode));
}
