import { hexDataLength } from "@ethersproject/bytes";
import { pack } from "@ethersproject/solidity";

import deployments from "./deployments";
import { OperationType, TransactionData, SafeTransactionData } from "./types";

export default function encode(
  transactions: TransactionData[]
): SafeTransactionData {
  const remove0x = (s: string) => s.slice(2);
  const transactionsEncoded =
    "0x" + transactions.map(packOneTransaction).map(remove0x).join("");

  const { address, iface } = deployments.multisend;

  return {
    operation: OperationType.DelegateCall,
    to: address,
    data: iface.encodeFunctionData("multiSend", [transactionsEncoded]),
    value: 0,
  };
}

function packOneTransaction({ to, value, data }: TransactionData) {
  return pack(
    ["uint8", "address", "uint256", "uint256", "bytes"],
    [OperationType.Call, to, value || 0, hexDataLength(data as string), data]
  );
}
