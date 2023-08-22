import { DelayConfig, TransactionData } from "../../types";

import { DELAY_INTERFACE } from "./constants";
import predictDelayAddress from "./predictAddress";

export default function populateSetCooldown(
  safeAddress: string,
  config: DelayConfig
): TransactionData {
  const iface = DELAY_INTERFACE;
  const delayAddress = predictDelayAddress(safeAddress);
  return {
    to: delayAddress,
    data: iface.encodeFunctionData("setTxCooldown", [config.cooldown]),
    value: 0,
  };
}
