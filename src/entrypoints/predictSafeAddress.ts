import { AbiCoder, concat, getCreate2Address, keccak256 } from "ethers";

import { initializer } from "./accountCreation";
import deployments, { proxyCreationBytecode } from "../deployments";

export default function predictSafeAddress(
  owner: string,
  seed: bigint = BigInt(0)
): string {
  const { address: factory } = deployments.safeProxyFactory;
  const { address: mastercopy } = deployments.safeMastercopy;

  const abi = AbiCoder.defaultAbiCoder();

  const salt = keccak256(
    concat([keccak256(initializer(owner)), abi.encode(["uint256"], [seed])])
  );

  const deploymentData = concat([
    proxyCreationBytecode,
    abi.encode(["address"], [mastercopy]),
  ]);

  return getCreate2Address(factory, salt, keccak256(deploymentData));
}
