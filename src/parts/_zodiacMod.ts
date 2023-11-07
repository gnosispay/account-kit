import {
  getCreate2Address,
  keccak256,
  solidityPackedKeccak256,
  ZeroHash,
} from "ethers";

import deployments from "../deployments";

export function _predictZodiacModAddress(
  mastercopy: string,
  encodedSetUp: string
) {
  const factory = deployments.moduleProxyFactory.address;
  const saltNonce = ZeroHash;

  const bytecode =
    "0x602d8060093d393df3363d3d373d3d3d363d73" +
    mastercopy.toLowerCase().replace(/^0x/, "") +
    "5af43d82803e903d91602b57fd5bf3";

  const salt = solidityPackedKeccak256(
    ["bytes32", "uint256"],
    [solidityPackedKeccak256(["bytes"], [encodedSetUp]), saltNonce]
  );

  return getCreate2Address(factory, salt, keccak256(bytecode));
}
