import {
  AbiCoder,
  getCreate2Address,
  keccak256,
  solidityPackedKeccak256,
  toUtf8Bytes,
  ZeroHash,
} from "ethers";

import deployments from "../deployments";

export function predictRolesAddress(account: string): string {
  const mastercopy = deployments.rolesMastercopy.address;
  return predictModuleAddress(mastercopy, encodeRolesSetUp(account));
}

export function predictDelayAddress(account: string): string {
  const mastercopy = deployments.delayMastercopy.address;
  return predictModuleAddress(mastercopy, encodeDelaySetUp(account));
}

export function encodeDelaySetUp(safeAddress: string) {
  const initializer = AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "uint256", "uint256"],
    [safeAddress, safeAddress, safeAddress, 0, 0]
  );

  return deployments.delayMastercopy.iface.encodeFunctionData("setUp", [
    initializer,
  ]);
}

export function encodeRolesSetUp(safeAddress: string) {
  const initializer = AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address"],
    [safeAddress, safeAddress, safeAddress]
  );

  return deployments.rolesMastercopy.iface.encodeFunctionData("setUp", [
    initializer,
  ]);
}

// the role allowed to spend the allowance
export const SPENDING_ROLE_KEY = keccak256(toUtf8Bytes("SPENDING_ROLE"));

// the actual allowanced consumed by the role
export const ALLOWANCE_KEY = keccak256(toUtf8Bytes("ALLOWANCE"));

function predictModuleAddress(mastercopy: string, encodedSetUpData: string) {
  const factory = deployments.moduleProxyFactory.address;
  const saltNonce = ZeroHash;

  const byteCode =
    "0x602d8060093d393df3363d3d373d3d3d363d73" +
    mastercopy.toLowerCase().replace(/^0x/, "") +
    "5af43d82803e903d91602b57fd5bf3";

  const salt = solidityPackedKeccak256(
    ["bytes32", "uint256"],
    [solidityPackedKeccak256(["bytes"], [encodedSetUpData]), saltNonce]
  );

  return getCreate2Address(factory, salt, keccak256(byteCode));
}
