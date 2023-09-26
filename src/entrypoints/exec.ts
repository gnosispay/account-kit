import { ZeroAddress } from "ethers";

import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";
import {
  populateDelayDispatch,
  populateDelayEnqueue,
  predictOwnerChannelAddress,
} from "../parts";

import { OperationType, TransactionData } from "../types";

export async function populateExecEnqueue(
  {
    safe,
    eoa,
    chainId,
    nonce,
  }: { safe: string; eoa: string; chainId: number; nonce: number },
  transaction: TransactionData,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const channel = {
    address: predictOwnerChannelAddress({ eoa, safe }),
    iface: deployments.safeMastercopy.iface,
  };

  const { to, value = 0, data } = populateDelayEnqueue(safe, transaction);

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
  };
}

export function populateExecDispatch(
  { safe }: { safe: string },
  transaction: TransactionData
): TransactionData {
  return populateDelayDispatch(safe, transaction);
}
