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
  const factoryAddress = deployments.proxyFactory.networkAddresses[100];
  const mastercopyAddress = deployments.safe.networkAddresses[100];

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
