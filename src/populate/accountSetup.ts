import assert from "assert";
import { Interface } from "ethers/lib/utils.js";
import { getAllowanceModuleDeployment } from "@safe-global/safe-modules-deployments";

import {
  AllowanceConfig,
  SafeTransactionData,
  TransactionData,
} from "../types";

import deployments from "../deployments";
import multisendEncode from "../multisendEncode";
import makeSignatureInput from "../makeSignatureInput";

import { predictSafeAddress } from "./accountCreation";
import { predictDelayAddress } from "./delay-mod";

import populateAddDelegate from "./allowance-mod/populateAddDelegate";
import populateSetAllowance from "./allowance-mod/populateSetAllowance";

const AddressZero = "0x0000000000000000000000000000000000000000";

export function populateAccountSetupTransaction(
  ownerAccount: string,
  allowanceConfig: AllowanceConfig,
  signature: string
): TransactionData {
  const safeAddress = predictSafeAddress(ownerAccount);
  const safeInterface = new Interface(deployments.safe.abi);

  const { to, data, value, operation } = safeTransactionRequest(
    safeAddress,
    allowanceConfig
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
  ownerAccount: string,
  chainId: number,
  allowanceConfig: AllowanceConfig,
  nonce: number | bigint
) {
  const safeAddress = predictSafeAddress(ownerAccount);

  return makeSignatureInput(
    ownerAccount,
    chainId,
    safeTransactionRequest(safeAddress, allowanceConfig),
    nonce
  );
}

export function predictModuleAddresses(ownerAccount: string) {
  return _predictModuleAddresses(predictSafeAddress(ownerAccount));
}

function safeTransactionRequest(
  safeAddress: string,
  allowanceConfig: AllowanceConfig
): SafeTransactionData {
  const { allowanceAddress, delayAddress } =
    _predictModuleAddresses(safeAddress);

  return multisendEncode([
    populateAddDelegate(allowanceConfig),
    populateSetAllowance(allowanceConfig),
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

function _predictModuleAddresses(safeAddress: string) {
  const deployment = getAllowanceModuleDeployment();
  // same as mainnet and gc
  const allowanceSingletonAddress = deployment?.networkAddresses[1];
  assert(allowanceSingletonAddress);

  return {
    allowanceAddress: allowanceSingletonAddress,
    delayAddress: predictDelayAddress(safeAddress),
  };
}

function encodeEnableModule(moduleAddress: string) {
  const iface = new Interface(["function enableModule(address module)"]);
  return iface.encodeFunctionData("enableModule", [moduleAddress]);
}
