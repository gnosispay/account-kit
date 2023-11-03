import { concat, getAddress } from "ethers";

import deployments from "../deployments";
import typedDataForModifierTransaction, { randomBytes32 } from "../eip712";
import { predictDelayAddress } from "../parts";

import { OperationType, SignTypedData, TransactionRequest } from "../types";

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

  const delay = {
    address: predictDelayAddress(account),
    iface: deployments.delayMastercopy.iface,
  };

  const { to, value, data } = {
    to: delay.address,
    value: 0,
    data: delay.iface.encodeFunctionData("execTransactionFromModule", [
      transaction.to,
      transaction.value || 0,
      transaction.data,
      OperationType.Call,
    ]),
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

  const delay = {
    address: predictDelayAddress(account),
    iface: deployments.delayMastercopy.iface,
  };

  return {
    to: delay.address,
    value: 0,
    data: delay.iface.encodeFunctionData("executeNextTx", [
      transaction.to,
      transaction.value || 0,
      transaction.data,
      OperationType.Call,
    ]),
  };
}
