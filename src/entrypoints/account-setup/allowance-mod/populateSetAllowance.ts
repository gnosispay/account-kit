import { Interface } from "ethers/lib/utils";

import { AllowanceConfig, TransactionData } from "../../../types";
import {
  ALLOWANCE_SINGLETON_ABI,
  ALLOWANCE_SINGLETON_ADDRESS,
} from "./contants";

export default function populateSetAllowance(
  config: AllowanceConfig
): TransactionData {
  const iface = new Interface(ALLOWANCE_SINGLETON_ABI);
  return {
    to: ALLOWANCE_SINGLETON_ADDRESS,
    data: iface.encodeFunctionData("setAllowance", [
      config.spender,
      config.token,
      config.amount,
      config.period,
      0,
    ]),
    value: 0,
  };
}
