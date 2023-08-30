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
  const { address: factory } = deployments.safeProxyFactory;
  const { address: mastercopy } = deployments.safeMastercopy;

  const salt = keccak256(
    concat([keccak256(initializer(ownerAddress)), saltNonce(seed)])
  );

  const abi = AbiCoder.defaultAbiCoder();

  const deploymentData = concat([
    proxyCreationBytecode,
    abi.encode(["address"], [mastercopy]),
  ]);

  return getCreate2Address(factory, salt, keccak256(deploymentData));
}
