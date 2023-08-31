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
  { safe, chainId, nonce }: ExecutionConfig,
  transfer: Transfer,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const safeAddress = safe;
  const safeIface = deployments.safeMastercopy.iface;

  const { to, value, data, operation } = populateSafeTransaction(transfer);

  const { domain, types, message } = typedDataForSafeTransaction(
    safe,
    chainId,
    nonce,
    { to, value, data, operation }
  );

  const signature = await sign(domain, types, message);

  return {
    to: safeAddress,
    data: safeIface.encodeFunctionData("execTransaction", [
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
