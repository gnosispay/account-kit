import { populateExecuteDispatch, populateExecuteEnqueue } from "./execute";
import { SPENDING_ALLOWANCE_KEY } from "../constants";
import deployments from "../deployments";
import { predictBouncerAddress } from "../parts";

import { AllowanceConfig, TransactionData } from "../types";

export async function populateLimitEnqueue(
  {
    account,
    owner,
    chainId,
    nonce,
  }: { account: string; owner: string; chainId: number; nonce: number },
  config: AllowanceConfig,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const transaction = populateSetAllowance(account, config);

  return populateExecuteEnqueue(
    { account, owner, chainId, nonce },
    transaction,
    sign
  );
}

export function populateLimitDispatch(
  account: string,
  config: AllowanceConfig
): TransactionData {
  const transaction = populateSetAllowance(account, config);
  return populateExecuteDispatch(account, transaction);
}

function populateSetAllowance(
  account: string,
  { refill, period, timestamp = 0 }: AllowanceConfig
): TransactionData {
  const address = predictBouncerAddress(account);
  const iface = deployments.rolesMastercopy.iface;

  return {
    to: address,
    data: iface.encodeFunctionData("setAllowance", [
      SPENDING_ALLOWANCE_KEY,
      refill, // balance
      refill, // maxBalance
      refill, // refill
      period, // period
      timestamp, // timestamp
    ]),
  };
}
