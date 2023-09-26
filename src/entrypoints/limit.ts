import { ZeroAddress } from "ethers";

import { ALLOWANCE_SPENDING_KEY } from "../constants";
import deployments from "../deployments";
import { predictForwarderAddress } from "../parts";

import { AllowanceConfig, OperationType, TransactionData } from "../types";
import { populateExecDispatch, populateExecEnqueue } from "./exec";

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
  const transaction = toSetAllowanceTransaction(safe, config);

  return populateExecEnqueue({ safe, eoa, chainId, nonce }, transaction, sign);
}

export function populateLimitDispatch(
  { safe }: { safe: string },
  config: AllowanceConfig
): TransactionData {
  const transaction = toSetAllowanceTransaction(safe, config);
  return populateExecDispatch({ safe }, transaction);
}

function toSetAllowanceTransaction(
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
