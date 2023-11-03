import { concat, getAddress } from "ethers";

import deployments from "../deployments";
import typedDataForModifierTransaction, { randomBytes32 } from "../eip712";
import {
  populateDelayDispatch,
  populateDelayEnqueue,
  predictDelayAddress,
} from "../parts";

import { SignTypedData, TransactionRequest } from "../types";

export async function populateExecuteEnqueue(
  {
    account,
    chainId,
    salt,
  }: { account: string; chainId: number; salt?: string },
  transaction: TransactionRequest,
  sign: SignTypedData
): Promise<TransactionRequest> {
  account = getAddress(account);
  salt = salt || randomBytes32();

  const { to, value = 0, data } = populateDelayEnqueue(account, transaction);

  const delay = {
    address: predictDelayAddress(account),
    iface: deployments.delayMastercopy.iface,
  };

  const { domain, primaryType, types, message } =
    typedDataForModifierTransaction(
      { modifier: delay.address, chainId },
      { data, salt }
    );

  const signature = await sign({ domain, primaryType, types, message });

  return { to, value, data: concat([data, salt, signature]) };
}

export function populateExecuteDispatch(
  account: string,
  transaction: TransactionRequest
): TransactionRequest {
  account = getAddress(account);
  return populateDelayDispatch(account, transaction);
}
