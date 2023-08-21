import assert from "assert";
import { getAllowanceModuleDeployment } from "@safe-global/safe-modules-deployments";

function abi() {
  const deployment = getAllowanceModuleDeployment();
  assert(deployment?.abi);
  return deployment?.abi;
}

function address() {
  const deployment = getAllowanceModuleDeployment();
  // 1 or 100 is the same
  const moduleAddress = deployment?.networkAddresses[1];
  assert(moduleAddress);
  return moduleAddress;
}

export const ALLOWANCE_SINGLETON_ABI = abi();
export const ALLOWANCE_SINGLETON_ADDRESS = address();
