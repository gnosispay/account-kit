import { AbiCoder, ZeroHash } from "ethers";

import { _predictZodiacModAddress } from "./_zodiacMod";

import deployments from "../deployments";
import { OperationType, TransactionData } from "../types";

export function predictDelayAddress(safe: string): string {
  return _predictZodiacModAddress(
    deployments.delayMastercopy.address,
    encodeSetUp(safe)
  );
}

export function populateDelayCreation(safe: string): TransactionData {
  const { moduleProxyFactory } = deployments;

  return {
    to: moduleProxyFactory.address,
    data: moduleProxyFactory.iface.encodeFunctionData("deployModule", [
      deployments.delayMastercopy.address,
      encodeSetUp(safe),
      ZeroHash,
    ]),
  };
}

export function populateDelayEnqueue(
  safe: string,
  { to, value, data }: TransactionData
): TransactionData {
  const delay = {
    address: predictDelayAddress(safe),
    iface: deployments.delayMastercopy.iface,
  };

  return {
    to: delay.address,
    data: delay.iface.encodeFunctionData("execTransactionFromModule", [
      to,
      value || 0,
      data,
      OperationType.Call,
    ]),
  };
}

export function populateDelayDispatch(
  safe: string,
  { to, value, data }: TransactionData
): TransactionData {
  const delay = {
    address: predictDelayAddress(safe),
    iface: deployments.delayMastercopy.iface,
  };

  return {
    to: delay.address,
    data: delay.iface.encodeFunctionData("executeNextTx", [
      to,
      value || 0,
      data,
      OperationType.Call,
    ]),
  };
}

function encodeSetUp(safe: string) {
  const initializer = AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "uint256", "uint256"],
    [safe, safe, safe, 0, 0]
  );

  return deployments.delayMastercopy.iface.encodeFunctionData("setUp", [
    initializer,
  ]);
}
