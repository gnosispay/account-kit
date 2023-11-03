import { getAddress } from "ethers";

import { populateExecuteDispatch, populateExecuteEnqueue } from "./execute";
import { SPENDING_ALLOWANCE_KEY } from "../constants";
import deployments from "../deployments";
import { randomBytes32 } from "../eip712";
import { predictBouncerAddress } from "../parts";

import { TransactionRequest, AllowanceConfig, SignTypedData } from "../types";

export async function populateLimitEnqueue(
  {
    account,
    chainId,
    salt,
  }: { account: string; chainId: number; salt?: string },
  config: AllowanceConfig,
  sign: SignTypedData
): Promise<TransactionRequest> {
  account = getAddress(account);
  salt = salt || randomBytes32();

  const transaction = populateSetAllowance(account, config);
  return populateExecuteEnqueue({ account, chainId, salt }, transaction, sign);
}

export function populateLimitDispatch(
  account: string,
  config: AllowanceConfig
): TransactionRequest {
  account = getAddress(account);

  const transaction = populateSetAllowance(account, config);
  return populateExecuteDispatch(account, transaction);
}

function populateSetAllowance(
  account: string,
  { refill, period, timestamp = 0 }: AllowanceConfig
): TransactionRequest {
  const address = predictBouncerAddress(account);
  const iface = deployments.rolesMastercopy.iface;

  return {
    to: address,
    value: 0,
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
