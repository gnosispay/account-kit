import { Interface } from "@ethersproject/abi";
import { hexDataLength } from "@ethersproject/bytes";
import { pack } from "@ethersproject/solidity";

import { OperationType, TransactionData, SafeTransactionData } from "./types";
import deployments from "./deployments";

export default function encode(
  transactions: TransactionData[]
): SafeTransactionData {
  const remove0x = (s: string) => s.slice(2);
  const transactionsEncoded =
    "0x" + transactions.map(packOneTransaction).map(remove0x).join("");

  const iface = new Interface(deployments.multiSend.abi);
  const data = iface.encodeFunctionData("multiSend", [transactionsEncoded]);

  return {
    operation: OperationType.DelegateCall,
    to: deployments.multiSend.defaultAddress,
    value: 0,
    data,
  };
}

function packOneTransaction({ to, value, data }: TransactionData) {
  return pack(
    ["uint8", "address", "uint256", "uint256", "bytes"],
    [OperationType.Call, to, value, hexDataLength(data as string), data]
  );
}
