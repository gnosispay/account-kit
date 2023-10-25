import { ZeroAddress } from "ethers";

import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";
import {
  populateDelayDispatch,
  populateDelayEnqueue,
  predictOwnerChannelAddress,
} from "../parts";

import { OperationType, SignTypedData, TransactionData } from "../types";

export async function populateExecuteEnqueue(
  {
    account,
    owner,
    chainId,
    nonce,
  }: { account: string; owner: string; chainId: number; nonce: number },
  transaction: TransactionData,
  sign: SignTypedData
): Promise<TransactionData> {
  const channel = {
    address: predictOwnerChannelAddress({ account, owner }),
    iface: deployments.safeMastercopy.iface,
  };

  const { to, value = 0, data } = populateDelayEnqueue(account, transaction);

  const { domain, primaryType, types, message } = typedDataForSafeTransaction(
    { safe: channel.address, chainId, nonce },
    { to, value, data, operation: OperationType.Call }
  );

  const signature = await sign({ domain, primaryType, types, message });

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

export function populateExecuteDispatch(
  account: string,
  transaction: TransactionData
): TransactionData {
  return populateDelayDispatch(account, transaction);
}
