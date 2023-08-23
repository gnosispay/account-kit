import {
  concat,
  defaultAbiCoder,
  getCreate2Address,
  keccak256,
} from "ethers/lib/utils";

import deployments, { proxyCreationBytecode } from "../../deployments";
import { initializer, saltNonce } from ".";

export const BYTES32_ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export default function predictSafeAddress(
  ownerAddress: string,
  seed: string = BYTES32_ZERO
): string {
  const factoryAddress = deployments.proxyFactory.networkAddresses[100];
  const mastercopyAddress = deployments.safe.networkAddresses[100];

  const salt = keccak256(
    concat([keccak256(initializer(ownerAddress)), saltNonce(seed)])
  );

  const deploymentData = concat([
    proxyCreationBytecode,
    defaultAbiCoder.encode(["address"], [mastercopyAddress]),
  ]);

  return getCreate2Address(factoryAddress, salt, keccak256(deploymentData));
}
