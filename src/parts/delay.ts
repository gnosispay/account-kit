import { AbiCoder, ZeroHash } from "ethers";

import { _predictZodiacModAddress } from "./_zodiacMod";

import deployments from "../deployments";
import { OperationType, TransactionRequest } from "../types";

export function predictDelayAddress(safe: string): string {
  return _predictZodiacModAddress(
    deployments.delayMastercopy.address,
    encodeSetUp(safe)
  );
}

export function populateDelayCreation(safe: string): TransactionRequest {
  const { moduleProxyFactory } = deployments;

  return {
    to: moduleProxyFactory.address,
    value: 0,
    data: moduleProxyFactory.iface.encodeFunctionData("deployModule", [
      deployments.delayMastercopy.address,
      encodeSetUp(safe),
      ZeroHash,
    ]),
  };
}

export function populateDelayEnqueue(
  safe: string,
  { to, value, data }: TransactionRequest
): TransactionRequest {
  const delay = {
    address: predictDelayAddress(safe),
    iface: deployments.delayMastercopy.iface,
  };

  return {
    to: delay.address,
    value: 0,
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
  { to, value, data }: TransactionRequest
): TransactionRequest {
  const delay = {
    address: predictDelayAddress(safe),
    iface: deployments.delayMastercopy.iface,
  };

  return {
    to: delay.address,
    value: 0,
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
