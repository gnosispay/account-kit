import ArtifactGnosisSafeProxyFactory from "@gnosis.pm/safe-contracts/build/artifacts/contracts/proxies/GnosisSafeProxyFactory.sol/GnosisSafeProxyFactory.json";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import deployments from "../../../src/deployments";
import { deployViaFactory } from "../factories/nickSingletonFactory";

export default async function (signer: SignerWithAddress) {
  const address = await deployViaFactory(
    { bytecode: ArtifactGnosisSafeProxyFactory.bytecode },
    signer
  );

  if (address !== deployments.safeProxyFactory.address) {
    throw new Error("SafeProxyFactory did not match live mainnet deployment");
  }
}
