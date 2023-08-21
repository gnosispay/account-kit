import { Interface } from "ethers/lib/utils";

import { AllowanceConfig, TransactionData } from "../../types";
import {
  ALLOWANCE_SINGLETON_ABI,
  ALLOWANCE_SINGLETON_ADDRESS,
} from "./contants";

export default function populateAddDelegate(
  config: AllowanceConfig
): TransactionData {
  const iface = new Interface(ALLOWANCE_SINGLETON_ABI);
  return {
    to: ALLOWANCE_SINGLETON_ADDRESS,
    data: iface.encodeFunctionData("addDelegate", [config.spender]),
    value: 0,
  };
}
