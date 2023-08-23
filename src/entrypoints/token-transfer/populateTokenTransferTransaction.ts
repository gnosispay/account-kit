import { Interface } from "ethers/lib/utils.js";

import {
  OperationType,
  SafeTransactionData,
  TransactionData,
} from "../../types";
import deployments from "../../deployments";

const AddressZero = "0x0000000000000000000000000000000000000000";

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
      AddressZero,
      AddressZero,
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
