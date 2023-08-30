import { Interface, ZeroAddress } from "ethers";
import { populateAddDelegate, populateSetAllowance } from "./allowance-mod";
import {
  populateDelayDeploy,
  populateSetCooldown,
  predictDelayAddress,
} from "./delay-mod";
import { IDelayModule__factory } from "../../../typechain-types";
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
  const { iface } = deployments.safeMastercopy;

  const { to, data, value, operation } = populateInnerTransaction(
    safeAddress,
    config
  );

  return {
    to: safeAddress,
    data: iface.encodeFunctionData("execTransaction", [
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
  const allowanceAddress = deployments.allowanceSingleton.address;
  const delayAddress = predictDelayAddress(safeAddress);
  const delay = IDelayModule__factory.connect(delayAddress);

  return multisendEncode([
    populateAddDelegate(config),
    populateSetAllowance(config),
    populateDelayDeploy(safeAddress),
    populateSetCooldown(safeAddress, config),
    {
      to: delayAddress,
      data: delay.interface.encodeFunctionData("enableModule", [config.owner]),
    },
    {
      to: safeAddress,
      data: encodeEnableModule(allowanceAddress),
      value: 0,
    },
    {
      to: safeAddress,
      data: encodeEnableModule(delayAddress),
      value: 0,
    },
  ]);
}

function encodeEnableModule(moduleAddress: string) {
  const iface = new Interface(["function enableModule(address module)"]);
  return iface.encodeFunctionData("enableModule", [moduleAddress]);
}
