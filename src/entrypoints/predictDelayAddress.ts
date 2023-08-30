import {
  AbiCoder,
  ZeroHash,
  getCreate2Address,
  keccak256,
  solidityPackedKeccak256,
} from "ethers";
import deployments from "../deployments";

export default function predictDelayAddress(safeAddress: string): string {
  const factory = deployments.moduleProxyFactory.address;
  const mastercopy = deployments.delayMastercopy.address;
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
  const initializer = AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "uint256", "uint256"],
    [safeAddress, safeAddress, safeAddress, 0, 0]
  );

  return deployments.delayMastercopy.iface.encodeFunctionData("setUp", [
    initializer,
  ]);
}
