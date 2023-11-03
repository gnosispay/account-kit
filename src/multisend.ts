import { hexDataLength } from "@ethersproject/bytes";
import { pack } from "@ethersproject/solidity";

import deployments from "./deployments";
import {
  OperationType,
  TransactionRequest,
  SafeTransactionRequest,
} from "./types";

export default function encode(
  transactions: TransactionRequest[]
): SafeTransactionRequest {
  const remove0x = (s: string) => s.slice(2);
  const transactionsEncoded =
    "0x" + transactions.map(packOneTransaction).map(remove0x).join("");

  const { address, iface } = deployments.multisend;

  return {
    to: address,
    data: iface.encodeFunctionData("multiSend", [transactionsEncoded]),
    value: 0,
    operation: OperationType.DelegateCall,
  };
}

function packOneTransaction({ to, value, data }: TransactionRequest) {
  return pack(
    ["uint8", "address", "uint256", "uint256", "bytes"],
    [OperationType.Call, to, value || 0, hexDataLength(data as string), data]
  );
}
