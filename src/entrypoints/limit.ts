import { ZeroAddress } from "ethers";

import { ALLOWANCE_SPENDING_KEY } from "../constants";
import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";
import {
  populateDelayDispatch,
  populateDelayEnqueue,
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

  const {
    to,
    value = 0,
    data,
  } = populateDelayEnqueue(safe, populateSetAllowance(safe, config));

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
  return populateDelayDispatch(safe, populateSetAllowance(safe, config));
}

function populateSetAllowance(
  safe: string,
  { balance, refill, period, timestamp }: AllowanceConfig
): TransactionData {
  const address = predictForwarderAddress({ safe });
  const iface = deployments.rolesMastercopy.iface;

  return {
    to: address,
    data: iface.encodeFunctionData("setAllowance", [
      ALLOWANCE_SPENDING_KEY,
      balance || 0,
      refill, // maxBalance
      refill, // refill
      period,
      timestamp || 0,
    ]),
  };
}
