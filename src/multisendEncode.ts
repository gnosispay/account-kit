import { Interface } from "@ethersproject/abi";
import { hexDataLength } from "@ethersproject/bytes";
import { pack } from "@ethersproject/solidity";

import { OperationType, TransactionData, SafeTransactionData } from "./types";

const MULTI_SEND_ABI = ["function multiSend(bytes memory transactions)"];
const MULTI_SEND_CONTRACT_ADDRESS =
  "0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761";

export default function (transactions: TransactionData[]): SafeTransactionData {
  const remove0x = (s: string) => s.slice(2);
  const transactionsEncoded =
    "0x" + transactions.map(packOneTransaction).map(remove0x).join("");

  const multiSendContract = new Interface(MULTI_SEND_ABI);
  const data = multiSendContract.encodeFunctionData("multiSend", [
    transactionsEncoded,
  ]);

  return {
    operation: OperationType.DelegateCall,
    to: MULTI_SEND_CONTRACT_ADDRESS,
    value: BigInt(0),
    data,
  };
}

function packOneTransaction({ to, value, data }: TransactionData) {
  return pack(
    ["uint8", "address", "uint256", "uint256", "bytes"],
    [OperationType.Call, to, value, hexDataLength(data as string), data]
  );
}
