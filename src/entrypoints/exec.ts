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
    account,
    owner,
    chainId,
    nonce,
  }: { account: string; owner: string; chainId: number; nonce: number },
  transaction: TransactionData,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const channel = {
    address: predictOwnerChannelAddress({ eoa: owner, safe: account }),
    iface: deployments.safeMastercopy.iface,
  };

  const { to, value = 0, data } = populateDelayEnqueue(account, transaction);

  const { domain, types, message } = typedDataForSafeTransaction(
    { safe: channel.address, chainId, nonce },
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
  account: string,
  transaction: TransactionData
): TransactionData {
  return populateDelayDispatch(account, transaction);
}
