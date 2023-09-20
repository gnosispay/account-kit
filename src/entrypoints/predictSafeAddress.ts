import { AbiCoder, concat, getCreate2Address, keccak256 } from "ethers";

import { initializer } from "./accountCreation";
import deployments, { proxyCreationBytecode } from "../deployments";

// the salt nonce used for gnosis-pay account creation
export const SALT_NONCE = BigInt(
  "5114647649581446628743670001764890754687493338792207058163325042301318925668"
);

export default function predictSafeAddress(
  eoa: string,
  saltNonce: bigint = SALT_NONCE
): string {
  const { address: factory } = deployments.safeProxyFactory;
  const { address: mastercopy } = deployments.safeMastercopy;

  const abi = AbiCoder.defaultAbiCoder();

  const salt = keccak256(
    concat([keccak256(initializer(eoa)), abi.encode(["uint256"], [saltNonce])])
  );

  const deploymentData = concat([
    proxyCreationBytecode,
    abi.encode(["address"], [mastercopy]),
  ]);

  return getCreate2Address(factory, salt, keccak256(deploymentData));
}
