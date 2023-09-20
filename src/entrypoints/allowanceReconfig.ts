import { ZeroAddress } from "ethers";
import { ALLOWANCE_SPENDING_KEY } from "../constants";
import { predictForwarderAddress } from "../deployers/forwarder";
import { predictStubAddress } from "../deployers/stub";

import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";

import {
  AllowanceConfig,
  OperationType,
  SafeTransactionData,
  TransactionData,
} from "../types";

export default async function populateAllowanceReconfig(
  {
    eoa,
    safe,
    chainId,
    nonce,
  }: { eoa: string; safe: string; chainId: number; nonce: number },
  config: AllowanceConfig,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const stub = predictStubAddress(eoa);
  const forwarder = predictForwarderAddress({
    eoa,
    safe,
  });

  const { to, value, data, operation } = populateInnerTransaction(
    forwarder,
    config
  );

  const { domain, types, message } = typedDataForSafeTransaction(
    stub,
    chainId,
    nonce,
    { to, value, data, operation }
  );

  const signature = await sign(domain, types, message);

  const { iface } = deployments.safeMastercopy;
  return {
    to: stub,
    data: iface.encodeFunctionData("execTransaction", [
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

function populateInnerTransaction(
  forwarder: string,
  { period, refill, balance, timestamp }: AllowanceConfig
): SafeTransactionData {
  const { iface } = deployments.rolesMastercopy;
  const maxBalance = refill;
  return {
    to: forwarder,
    data: iface.encodeFunctionData("setAllowance", [
      ALLOWANCE_SPENDING_KEY,
      balance || 0,
      maxBalance,
      refill,
      period,
      timestamp || 0,
    ]),
    value: 0,
    operation: OperationType.Call,
  };
}
