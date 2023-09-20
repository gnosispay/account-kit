import { ALLOWANCE_KEY } from "./predictModuleAddress";
import { predictForwarderAddress } from "./predictSingletonAddress";
import deployments from "../deployments";
import { AccountAddresses, AllowanceConfig, TransactionData } from "../types";

export default function populateAllowanceReconfig(
  { owner, safe }: AccountAddresses,
  { period, refill, balance, timestamp }: AllowanceConfig
): TransactionData {
  const { iface } = deployments.rolesMastercopy;

  const forwarder = predictForwarderAddress({
    owner,
    safe,
  });

  const maxBalance = refill;

  return {
    to: forwarder,
    data: iface.encodeFunctionData("setAllowance", [
      ALLOWANCE_KEY,
      balance || 0,
      maxBalance,
      refill,
      period,
      timestamp || 0,
    ]),
  };
}
