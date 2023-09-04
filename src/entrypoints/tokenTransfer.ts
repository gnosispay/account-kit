import { Interface, ZeroAddress } from "ethers";

import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";
import {
  ExecutionConfig,
  OperationType,
  SafeTransactionData,
  TransactionData,
  Transfer,
} from "../types";

export default async function populateTokenTransfer(
  { account, chainId, nonce }: ExecutionConfig,
  transfer: Transfer,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const safe = {
    address: account,
    iface: deployments.safeMastercopy.iface,
  };

  const { to, value, data, operation } = populateSafeTransaction(transfer);

  const { domain, types, message } = typedDataForSafeTransaction(
    account,
    chainId,
    nonce,
    { to, value, data, operation }
  );

  const signature = await sign(domain, types, message);

  return {
    to: safe.address,
    data: safe.iface.encodeFunctionData("execTransaction", [
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

function populateSafeTransaction({
  token,
  to,
  amount,
}: Transfer): SafeTransactionData {
  const iface = new Interface([
    "function transfer(address recipient, uint256 amount)",
  ]);
  return {
    to: token,
    data: iface.encodeFunctionData("transfer", [to, amount]),
    value: 0,
    operation: OperationType.Call,
  };
}
