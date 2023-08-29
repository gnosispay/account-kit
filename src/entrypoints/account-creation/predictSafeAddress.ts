import {
  AbiCoder,
  ZeroHash,
  concat,
  getCreate2Address,
  keccak256,
} from "ethers";

import { initializer, saltNonce } from ".";
import deployments, { proxyCreationBytecode } from "../../deployments";

export default function predictSafeAddress(
  ownerAddress: string,
  seed: string = ZeroHash
): string {
  const factoryAddress = deployments.proxyFactory.address;
  const mastercopyAddress = deployments.safe.address;

  const salt = keccak256(
    concat([keccak256(initializer(ownerAddress)), saltNonce(seed)])
  );

  const abi = AbiCoder.defaultAbiCoder();

  const deploymentData = concat([
    proxyCreationBytecode,
    abi.encode(["address"], [mastercopyAddress]),
  ]);

  return getCreate2Address(factoryAddress, salt, keccak256(deploymentData));
}
