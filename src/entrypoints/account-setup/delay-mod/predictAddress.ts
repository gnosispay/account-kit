import {
  AbiCoder,
  ZeroHash,
  getCreate2Address,
  keccak256,
  solidityPackedKeccak256,
} from "ethers";

import {
  DELAY_INTERFACE,
  DELAY_MASTERCOPY_ADDRESS,
  MODULE_FACTORY_ADDRESS,
} from "./constants";

export default function predictDelayAddress(safeAddress: string): string {
  const mastercopy = DELAY_MASTERCOPY_ADDRESS;
  const factory = MODULE_FACTORY_ADDRESS;
  const saltNonce = ZeroHash;

  const byteCode =
    "0x602d8060093d393df3363d3d373d3d3d363d73" +
    mastercopy.toLowerCase().replace(/^0x/, "") +
    "5af43d82803e903d91602b57fd5bf3";

  const salt = solidityPackedKeccak256(
    ["bytes32", "uint256"],
    [solidityPackedKeccak256(["bytes"], [encodeSetUp(safeAddress)]), saltNonce]
  );

  return getCreate2Address(factory, salt, keccak256(byteCode));
}

export function encodeSetUp(safeAddress: string) {
  const abi = AbiCoder.defaultAbiCoder();
  const initializer = abi.encode(
    ["address", "address", "address", "uint256", "uint256"],
    [safeAddress, safeAddress, safeAddress, 0, 0]
  );
  return DELAY_INTERFACE.encodeFunctionData("setUp", [initializer]);
}
