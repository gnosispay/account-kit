import { concat, dataLength, solidityPacked } from "ethers";

import deployments from "./deployments";

import {
  OperationType,
  TransactionRequest,
  SafeTransactionRequest,
} from "./types";

export default function encode(
  transactions: TransactionRequest[]
): SafeTransactionRequest {
  const packedTransactions = transactions.reduce(
    (prev, next) => concat([prev, packTransaction(next)]),
    "0x"
  );

  const { address, iface } = deployments.multisend;
  return {
    to: address,
    data: iface.encodeFunctionData("multiSend", [packedTransactions]),
    value: 0,
    operation: OperationType.DelegateCall,
  };
}

function packTransaction({ to, value, data }: TransactionRequest) {
  return solidityPacked(
    ["uint8", "address", "uint256", "uint256", "bytes"],
    [OperationType.Call, to, value, dataLength(data), data]
  );
}
