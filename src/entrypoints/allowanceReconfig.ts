import deployments from "../deployments";
import { AccountAddresses, AllowanceConfig, TransactionData } from "../types";
import { ALLOWANCE_KEY } from "./predictModuleAddress";
import { predictForwarderAddress } from "./predictSingletonAddress";

export default function populateAllowanceReconfig(
  { owner, safe }: AccountAddresses,
  { amount, period }: AllowanceConfig
): TransactionData {
  const { iface } = deployments.rolesMastercopy;

  const forwarder = predictForwarderAddress({
    owner,
    safe,
  });

  return {
    to: forwarder,
    data: iface.encodeFunctionData("setAllowance", [
      ALLOWANCE_KEY,
      amount,
      amount,
      amount,
      period,
      0,
    ]),
  };
}
