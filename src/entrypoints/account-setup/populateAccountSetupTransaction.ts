import { Interface, ZeroAddress } from "ethers";
import { populateAddDelegate, populateSetAllowance } from "./allowance-mod";
import { populateDelayDeploy, populateSetCooldown } from "./delay-mod";
import predictModuleAddresses from "./predictModuleAddresses";
import deployments from "../../deployments";
import multisendEncode from "../../multisend";

import {
  AccountSetupConfig,
  SafeTransactionData,
  TransactionData,
} from "../../types";

export default function populateAccountSetupTransaction(
  safeAddress: string,
  config: AccountSetupConfig,
  signature: string
): TransactionData {
  const safeInterface = deployments.safe.iface;

  const { to, data, value, operation } = populateInnerTransaction(
    safeAddress,
    config
  );

  return {
    to: safeAddress,
    data: safeInterface.encodeFunctionData("execTransaction", [
      to,
      value,
      data,
      operation,
      0, // safeTxGas
      0, // baseGas
      0, // gasPrice
      ZeroAddress, // gasToken
      ZeroAddress, // gasRefund
      signature,
    ]),
    value: 0,
  };
}

export function populateInnerTransaction(
  safeAddress: string,
  config: AccountSetupConfig
): SafeTransactionData {
  const { allowanceModAddress, delayModAddress } =
    predictModuleAddresses(safeAddress);

  return multisendEncode([
    populateAddDelegate(config),
    populateSetAllowance(config),
    {
      to: safeAddress,
      data: encodeEnableModule(allowanceModAddress),
      value: 0,
    },
    populateDelayDeploy(safeAddress),
    populateSetCooldown(safeAddress, config),
    {
      to: safeAddress,
      data: encodeEnableModule(delayModAddress),
      value: 0,
    },
  ]);
}

function encodeEnableModule(moduleAddress: string) {
  const iface = new Interface(["function enableModule(address module)"]);
  return iface.encodeFunctionData("enableModule", [moduleAddress]);
}
