import assert from "assert";
import { Interface } from "ethers/lib/utils.js";
import { getAllowanceModuleDeployment } from "@safe-global/safe-modules-deployments";

import {
  AllowanceConfig,
  DelayConfig,
  SafeTransactionData,
  TransactionData,
} from "../types";

import deployments from "../deployments";
import multisendEncode from "../multisendEncode";
import signSafeTransactionParams from "../signature";

import {
  populateDelayDeploy,
  populateSetCooldown,
  predictDelayAddress,
} from "./delay-mod";
import { populateAddDelegate, populateSetAllowance } from "./allowance-mod";

const AddressZero = "0x0000000000000000000000000000000000000000";

export function populateAccountSetupTransaction(
  safeAddress: string,
  allowanceConfig: AllowanceConfig,
  delayConfig: DelayConfig,
  signature: string
): TransactionData {
  const safeInterface = new Interface(deployments.safe.abi);

  const { to, data, value, operation } = safeTransactionRequest(
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

export function signAccountSetupParams(
  safeAddress: string,
  chainId: number,
  allowanceConfig: AllowanceConfig,
  delayConfig: DelayConfig,
  nonce: number | bigint
) {
  return signSafeTransactionParams(
    safeAddress,
    chainId,
    safeTransactionRequest(safeAddress, allowanceConfig, delayConfig),
    nonce
  );
}

export function predictModuleAddresses(safeAddress: string) {
  const deployment = getAllowanceModuleDeployment();
  // same as mainnet and gc
  const allowanceSingletonAddress = deployment?.networkAddresses[1];
  assert(allowanceSingletonAddress);

  return {
    allowanceModAddress: allowanceSingletonAddress,
    delayModAddress: predictDelayAddress(safeAddress),
  };
}

function safeTransactionRequest(
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
