import { Interface, ZeroAddress } from "ethers";

import deployments from "../../deployments";
import {
  OperationType,
  SafeTransactionData,
  TransactionData,
} from "../../types";

export default function populateTransferTokenTransaction(
  safeAddress: string,
  transfer: { token: string; to: string; amount: number | bigint },
  signature: string
): TransactionData {
  const safeInterface = new Interface(deployments.safe.abi);

  const { to, value, data, operation } = populateInnerTransaction(transfer);

  return {
    to: safeAddress,
    data: safeInterface.encodeFunctionData("execTransaction", [
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

export function populateInnerTransaction({
  token,
  to,
  amount,
}: {
  token: string;
  to: string;
  amount: number | bigint;
}): SafeTransactionData {
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
