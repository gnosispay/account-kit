import { ZeroAddress } from "ethers";
import { ALLOWANCE_SPENDING_KEY } from "../constants";
import { predictForwarderAddress } from "../deployers/forwarder";

import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";

import {
  AllowanceConfig,
  OperationType,
  SafeTransactionData,
  TransactionData,
} from "../types";
import { predictOwnerChannelAddress } from "../deployers/channel";
import { predictDelayAddress } from "../deployers/delay";

export async function populateLimitEnqueue(
  {
    eoa,
    safe,
    chainId,
    nonce,
  }: { eoa: string; safe: string; chainId: number; nonce: number },
  config: AllowanceConfig,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const channel = {
    address: predictOwnerChannelAddress({ eoa }),
    iface: deployments.safeMastercopy.iface,
  };

  const { to, value, data, operation } = populateInnerTransaction(
    { safe },
    config
  );

  const { domain, types, message } = typedDataForSafeTransaction(
    channel.address,
    chainId,
    nonce,
    { to, value, data, operation }
  );

  const signature = await sign(domain, types, message);

  return {
    to: channel.address,
    data: channel.iface.encodeFunctionData("execTransaction", [
      to,
      value,
      data,
      operation,
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

export function populateLimitExecute(
  { safe }: { safe: string },
  { balance, refill, period, timestamp }: AllowanceConfig
): TransactionData {
  const delay = {
    address: predictDelayAddress(safe),
    iface: deployments.delayMastercopy.iface,
  };
  const forwarder = {
    address: predictForwarderAddress({ safe }),
    iface: deployments.rolesMastercopy.iface,
  };

  return {
    to: delay.address,
    data: delay.iface.encodeFunctionData("executeNextTx", [
      forwarder.address,
      0,
      forwarder.iface.encodeFunctionData("setAllowance", [
        ALLOWANCE_SPENDING_KEY,
        balance || 0,
        refill, // maxBalance
        refill, // refill
        period,
        timestamp || 0,
      ]),
      OperationType.Call,
    ]),
    value: 0,
  };
}

function populateInnerTransaction(
  { safe }: { safe: string },
  { balance, refill, period, timestamp }: AllowanceConfig
): SafeTransactionData {
  const delay = {
    address: predictDelayAddress(safe),
    iface: deployments.delayMastercopy.iface,
  };
  const forwarder = {
    address: predictForwarderAddress({ safe }),
    iface: deployments.rolesMastercopy.iface,
  };

  return {
    to: delay.address,
    data: delay.iface.encodeFunctionData("execTransactionFromModule", [
      forwarder.address,
      0,
      forwarder.iface.encodeFunctionData("setAllowance", [
        ALLOWANCE_SPENDING_KEY,
        balance || 0,
        refill, // maxBalance
        refill, // refill
        period,
        timestamp || 0,
      ]),
      OperationType.Call,
    ]),
    value: 0,
    operation: OperationType.Call,
  };
}
