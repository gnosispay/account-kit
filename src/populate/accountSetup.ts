import assert from "assert";
import { Interface } from "ethers/lib/utils.js";
import { getAllowanceModuleDeployment } from "@safe-global/safe-modules-deployments";

import deployments from "../deployments";
import multisendEncode, { OperationType } from "../multisendEncode";
import makeSignatureInput from "../makeSignatureInput";

import { PopulatedTransaction } from "./PopulatedTransaction";
import { predictSafeAddress } from "./accountCreation";
import { predictDelayAddress } from "./delay-mod";

const AddressZero = "0x0000000000000000000000000000000000000000";

export function populateAccountSetupTransaction(
  ownerAccount: string,
  chainId: number,
  signature: string
): PopulatedTransaction {
  const safeAddress = predictSafeAddress(ownerAccount);
  const safeInterface = new Interface(deployments.safe.abi);

  const { to, data, value, operation } = payload(safeAddress, chainId);

  return {
    chainId,
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
  };
}

export function signAccountSetupParams(
  ownerAccount: string,
  chainId: number,
  nonce: number
) {
  const safeAddress = predictSafeAddress(ownerAccount);

  const { to, data, value, operation } = payload(safeAddress, chainId);

  return makeSignatureInput(ownerAccount, chainId, {
    to,
    data,
    value,
    operation,
    nonce,
  });
}

export function predictModuleAddresses(ownerAccount: string, chainId: number) {
  return _predictModuleAddresses(predictSafeAddress(ownerAccount), chainId);
}

function payload(safeAddress: string, chainId: number) {
  const { allowanceAddress, delayAddress } = _predictModuleAddresses(
    safeAddress,
    chainId
  );

  return multisendEncode([
    {
      to: safeAddress,
      data: encodeEnableModule(allowanceAddress),
      value: BigInt(0),
      operation: OperationType.Call,
    },
    {
      to: safeAddress,
      data: encodeEnableModule(delayAddress),
      value: BigInt(0),
      operation: OperationType.Call,
    },
  ]);
}

function _predictModuleAddresses(safeAddress: string, chainId: number) {
  const deployment = getAllowanceModuleDeployment();
  const allowanceSingletonAddress = deployment?.networkAddresses[chainId];
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
