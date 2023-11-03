import { populateExecuteDispatch, populateExecuteEnqueue } from "./execute";
import { SPENDING_ALLOWANCE_KEY } from "../constants";
import deployments from "../deployments";
import { predictBouncerAddress } from "../parts";

import { AllowanceConfig, SignTypedData, TransactionData } from "../types";
import { getAddress } from "ethers";
import assert from "assert";

export async function populateLimitEnqueue(
  {
    account,
    chainId,
    salt,
  }: { account: string; owner: string; chainId: number; salt: string },
  config: AllowanceConfig,
  sign: SignTypedData
): Promise<TransactionData> {
  account = getAddress(account);

  const transaction = populateSetAllowance(account, config);
  return populateExecuteEnqueue({ account, chainId, salt }, transaction, sign);
}

export function populateLimitDispatch(
  account: string,
  config: AllowanceConfig
): TransactionData {
  account = getAddress(account);

  const transaction = populateSetAllowance(account, config);
  return populateExecuteDispatch(account, transaction);
}

function populateSetAllowance(
  account: string,
  { refill, period, timestamp = 0 }: AllowanceConfig
): TransactionData {
  assert(account == getAddress(account));

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
