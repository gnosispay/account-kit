import { concat, getAddress } from "ethers";

import {
  populateDelayDispatch,
  populateDelayEnqueue,
  predictDelayAddress,
} from "../parts";

import { SignTypedData, TransactionData } from "../types";
import typedDataForModifierTransaction from "../eip712";
import deployments from "../deployments";
import { HASH_REGEX } from "../constants";

export async function populateExecuteEnqueue(
  {
    account,
    chainId,
    salt,
  }: { account: string; chainId: number; salt: string },
  transaction: TransactionData,
  sign: SignTypedData
): Promise<TransactionData> {
  account = getAddress(account);
  if (!HASH_REGEX.test(salt)) {
    throw new Error(`Salt is not a bytes32 string ${salt}`);
  }

  const { to, value = 0, data } = populateDelayEnqueue(account, transaction);

  const delay = {
    address: predictDelayAddress(account),
    iface: deployments.delayMastercopy.iface,
  };

  const { domain, primaryType, types, message } =
    typedDataForModifierTransaction(
      { modifier: delay.address, chainId, salt },
      data
    );

  const signature = await sign({ domain, primaryType, types, message });

  return { to, value, data: concat([data, salt, signature]) };
}

export function populateExecuteDispatch(
  account: string,
  transaction: TransactionData
): TransactionData {
  return populateDelayDispatch(account, transaction);
}
