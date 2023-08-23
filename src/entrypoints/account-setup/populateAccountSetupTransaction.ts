import { Interface } from "ethers/lib/utils.js";

import {
  AllowanceConfig,
  DelayConfig,
  SafeTransactionData,
  TransactionData,
} from "../../types";
import deployments from "../../deployments";
import multisendEncode from "../../multisend";

import { populateDelayDeploy, populateSetCooldown } from "./delay-mod";
import { populateAddDelegate, populateSetAllowance } from "./allowance-mod";
import predictModuleAddresses from "./predictModuleAddresses";

const AddressZero = "0x0000000000000000000000000000000000000000";

export default function populateAccountSetupTransaction(
  safeAddress: string,
  allowanceConfig: AllowanceConfig,
  delayConfig: DelayConfig,
  signature: string
): TransactionData {
  const safeInterface = new Interface(deployments.safe.abi);

  const { to, data, value, operation } = populateInnerTransaction(
    safeAddress,
    allowanceConfig,
    delayConfig
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
      AddressZero, // gasToken
      AddressZero, // gasRefund
      signature,
    ]),
    value: 0,
  };
}

export function populateInnerTransaction(
  safeAddress: string,
  allowanceConfig: AllowanceConfig,
  delayConfig: DelayConfig
): SafeTransactionData {
  const { allowanceModAddress, delayModAddress } =
    predictModuleAddresses(safeAddress);

  return multisendEncode([
    populateAddDelegate(allowanceConfig),
    populateSetAllowance(allowanceConfig),
    {
      to: safeAddress,
      data: encodeEnableModule(allowanceModAddress),
      value: 0,
    },
    populateDelayDeploy(safeAddress),
    populateSetCooldown(safeAddress, delayConfig),
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
