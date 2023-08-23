import assert from "assert";
import { getAllowanceModuleDeployment } from "@safe-global/safe-modules-deployments";

import { predictDelayAddress } from "./delay-mod";

export default function predictModuleAddresses(safeAddress: string) {
  const deployment = getAllowanceModuleDeployment();
  // same as mainnet and gc
  const allowanceSingletonAddress = deployment?.networkAddresses[1];
  assert(allowanceSingletonAddress);

  return {
    allowanceModAddress: allowanceSingletonAddress,
    delayModAddress: predictDelayAddress(safeAddress),
  };
}
