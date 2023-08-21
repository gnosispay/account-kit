import { ethers } from "ethers";

import { TransactionData } from "../../types";
import {
  BYTES32_ZERO,
  DELAY_INTERFACE,
  DELAY_MASTERCOPY_ADDRESS,
  MODULE_FACTORY_ADDRESS,
  MODULE_FACTORY_INTERFACE,
} from "./constants";

export function populateDelayDeployTransaction(
  safeAddress: string,
  saltNonce: string = BYTES32_ZERO
): TransactionData {
  const factoryIface = MODULE_FACTORY_INTERFACE;
  const mastercopy = DELAY_MASTERCOPY_ADDRESS;
  const factory = MODULE_FACTORY_ADDRESS;

  return {
    data: factoryIface.encodeFunctionData("deployModule", [
      mastercopy,
      initializer(safeAddress),
      saltNonce,
    ]),
    to: factory,
    value: 0,
  };
}

export const predictDelayAddress = (
  safeAddress: string,
  saltNonce: string = BYTES32_ZERO
): string => {
  const mastercopy = DELAY_MASTERCOPY_ADDRESS;
  const factory = MODULE_FACTORY_ADDRESS;

  const byteCode =
    "0x602d8060093d393df3363d3d373d3d3d363d73" +
    mastercopy.toLowerCase().replace(/^0x/, "") +
    "5af43d82803e903d91602b57fd5bf3";

  const salt = ethers.utils.solidityKeccak256(
    ["bytes32", "uint256"],
    [
      ethers.utils.solidityKeccak256(["bytes"], [initializer(safeAddress)]),
      saltNonce,
    ]
  );

  return ethers.utils.getCreate2Address(
    factory,
    salt,
    ethers.utils.keccak256(byteCode)
  );
};

function initializer(safeAddress: string) {
  return DELAY_INTERFACE.encodeFunctionData("setUp", [
    ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "address", "uint256", "uint256"],
      [safeAddress, safeAddress, safeAddress, 0, 0]
    ),
  ]);
}
