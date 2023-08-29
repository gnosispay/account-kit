import { Interface } from "ethers";

import deployments from "../../../deployments";
import { AccountSetupConfig, TransactionData } from "../../../types";

export default function populateSetAllowance(
  config: AccountSetupConfig
): TransactionData {
  const { abi, defaultAddress: address } = deployments.allowanceSingleton;

  const iface = new Interface(abi);
  return {
    to: address,
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
