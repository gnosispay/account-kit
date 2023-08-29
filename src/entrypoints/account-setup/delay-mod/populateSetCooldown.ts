import { DELAY_INTERFACE } from "./constants";
import predictDelayAddress from "./predictAddress";
import { AccountSetupConfig, TransactionData } from "../../../types";

export default function populateSetCooldown(
  safeAddress: string,
  config: AccountSetupConfig
): TransactionData {
  const iface = DELAY_INTERFACE;
  const delayAddress = predictDelayAddress(safeAddress);
  return {
    to: delayAddress,
    // Note cooldown comes in minutes, convert to seconds which is what the mod accepts
    data: iface.encodeFunctionData("setTxCooldown", [config.cooldown]),
    value: 0,
  };
}
