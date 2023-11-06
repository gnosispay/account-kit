import ArtifactGnosisSafe from "@gnosis.pm/safe-contracts/build/artifacts/contracts/GnosisSafe.sol/GnosisSafe.json";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import deployments from "../../../src/deployments";
import { deployViaFactory } from "../factories/nickSingletonFactory";

export default async function (signer: SignerWithAddress) {
  const address = await deployViaFactory(
    { bytecode: ArtifactGnosisSafe.bytecode },
    signer
  );

  if (address !== deployments.safeMastercopy.address) {
    throw new Error("SafeMastercopy did not match live mainnet deployment");
  }
}
