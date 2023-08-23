import { Interface } from "ethers/lib/utils";

import { AccountSetupConfig, TransactionData } from "../../../types";
import deployments from "../../../deployments";

export default function populateAddDelegate(
  config: AccountSetupConfig
): TransactionData {
  const { abi, defaultAddress: address } = deployments.allowanceSingleton;
  const iface = new Interface(abi);
  return {
    to: address,
    data: iface.encodeFunctionData("addDelegate", [config.spender]),
    value: 0,
  };
}
