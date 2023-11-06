import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  getSingletonFactoryInfo,
  SingletonFactoryInfo,
} from "@safe-global/safe-singleton-factory";
import { getCreate2Address, keccak256, parseEther, ZeroHash } from "ethers";

export async function deployViaFactory(
  { bytecode, salt = ZeroHash }: { bytecode: string; salt?: string },
  signer: SignerWithAddress
) {
  const { chainId } = await signer.provider.getNetwork();
  const factory = getSingletonFactoryInfo(
    Number(chainId)
  ) as SingletonFactoryInfo;

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
