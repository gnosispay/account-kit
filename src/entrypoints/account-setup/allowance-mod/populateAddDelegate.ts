import deployments from "../../../deployments";
import { AccountSetupConfig, TransactionData } from "../../../types";

export default function populateAddDelegate(
  config: AccountSetupConfig
): TransactionData {
  const { iface, address } = deployments.allowanceSingleton;
  return {
    to: address,
    data: iface.encodeFunctionData("addDelegate", [config.spender]),
    value: 0,
  };
}
