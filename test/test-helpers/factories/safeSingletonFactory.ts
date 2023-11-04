import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  getSingletonFactoryInfo,
  SingletonFactoryInfo,
} from "@safe-global/safe-singleton-factory";
import { getCreate2Address, keccak256, parseEther, ZeroHash } from "ethers";

// import {
//   ArtifactAllowanceModule,
//   ArtifactGnosisSafe,
//   ArtifactGnosisSafeProxyFactory,
// } from "./artifacts";

// export default async function deploySingletons(deployer: SignerWithAddress) {
//   const factoryAddress = await deploySingletonFactory(deployer);

//   const safeMastercopyAddress = await deploySingleton(
//     factoryAddress,
//     ArtifactGnosisSafe.bytecode,
//     deployer
//   );

//   const safeProxyFactoryAddress = await deploySingleton(
//     factoryAddress,
//     ArtifactGnosisSafeProxyFactory.bytecode,
//     deployer
//   );

//   const allowanceModuleAddress = await deploySingleton(
//     factoryAddress,
//     ArtifactAllowanceModule.bytecode,
//     deployer
//   );

//   return {
//     safeMastercopyAddress,
//     safeProxyFactoryAddress,
//     allowanceModuleAddress,
//   };
// }

export async function deployViaFactory(
  bytecode: string,
  signer: SignerWithAddress
) {
  const { chainId } = await signer.provider.getNetwork();
  const factory = getSingletonFactoryInfo(
    Number(chainId)
  ) as SingletonFactoryInfo;

  const salt = ZeroHash;

  await signer.sendTransaction({
    to: factory.address,
    data: `${salt}${bytecode.slice(2)}`,
    value: 0,
  });

  return getCreate2Address(factory.address, salt, keccak256(bytecode));
}

export async function deployFactory(signer: SignerWithAddress) {
  const { chainId } = await signer.provider.getNetwork();
  const { address, signerAddress, transaction } = getSingletonFactoryInfo(
    Number(chainId)
  ) as SingletonFactoryInfo;

  // fund the presined transaction signer
  await signer.sendTransaction({
    to: signerAddress,
    value: parseEther("0.01"),
  });

  // shoot the presigned transaction
  await signer.provider.broadcastTransaction(transaction);

  return address;
}
