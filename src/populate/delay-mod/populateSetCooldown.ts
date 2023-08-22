import { DelayConfig, TransactionData } from "../../types";

import { BYTES32_ZERO, DELAY_INTERFACE } from "./constants";
import predictDelayAddress from "./predictAddress";

export default function populateSetCooldown(
  safeAddress: string,
  saltNonce: string = BYTES32_ZERO,
  config: DelayConfig
): TransactionData {
  const iface = DELAY_INTERFACE;
  const delayAddress = predictDelayAddress(safeAddress, saltNonce);
  return {
    to: delayAddress,
    data: iface.encodeFunctionData("setCooldown", [config.cooldown]),
    value: 0,
  };
}
