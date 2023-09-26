import { AddressLike, BigNumberish, BytesLike, ZeroAddress } from "ethers";

import { ALLOWANCE_SPENDING_KEY } from "../constants";
import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";
import {
  predictDelayAddress,
  predictForwarderAddress,
  predictOwnerChannelAddress,
} from "../parts";

import { AllowanceConfig, OperationType, TransactionData } from "../types";

export async function populateLimitEnqueue(
  {
    safe,
    eoa,
    chainId,
    nonce,
  }: { safe: string; eoa: string; chainId: number; nonce: number },
  config: AllowanceConfig,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const channel = {
    address: predictOwnerChannelAddress({ eoa, safe }),
    iface: deployments.safeMastercopy.iface,
  };

  const { to, value = 0, data } = enqueueTransaction(safe, config);

  const { domain, types, message } = typedDataForSafeTransaction(
    channel.address,
    chainId,
    nonce,
    { to, value, data, operation: OperationType.Call }
  );

  const signature = await sign(domain, types, message);

  return {
    to: channel.address,
    data: channel.iface.encodeFunctionData("execTransaction", [
      to,
      value,
      data,
      OperationType.Call,
      0,
      0,
      0,
      ZeroAddress,
      ZeroAddress,
      signature,
    ]),
    value: 0,
  };
}

export function populateLimitDispatch(
  { safe }: { safe: string },
  config: AllowanceConfig
): TransactionData {
  return dispatchTransaction(safe, config);
}

function enqueueTransaction(
  safe: string,
  config: AllowanceConfig
): TransactionData {
  const delay = {
    address: predictDelayAddress(safe),
    iface: deployments.delayMastercopy.iface,
  };

  return {
    to: delay.address,
    data: delay.iface.encodeFunctionData(
      "execTransactionFromModule",
      setAllowanceArgs(safe, config)
    ),
    value: 0,
  };
}

function dispatchTransaction(
  safe: string,
  config: AllowanceConfig
): TransactionData {
  const delay = {
    address: predictDelayAddress(safe),
    iface: deployments.delayMastercopy.iface,
  };

  return {
    to: delay.address,
    data: delay.iface.encodeFunctionData(
      "executeNextTx",
      setAllowanceArgs(safe, config)
    ),
    value: 0,
  };
}

function setAllowanceArgs(
  safe: string,
  { balance, refill, period, timestamp }: AllowanceConfig
): [AddressLike, BigNumberish, BytesLike, BigNumberish] {
  const address = predictForwarderAddress({ safe });
  const iface = deployments.rolesMastercopy.iface;

  const { to, value, data, operation } = {
    to: address,
    value: 0,
    data: iface.encodeFunctionData("setAllowance", [
      ALLOWANCE_SPENDING_KEY,
      balance || 0,
      refill, // maxBalance
      refill, // refill
      period,
      timestamp || 0,
    ]),
    operation: OperationType.Call,
  };

  return [to, value, data, operation];
}
