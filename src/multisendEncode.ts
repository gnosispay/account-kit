import { Interface } from "@ethersproject/abi";
import { hexDataLength } from "@ethersproject/bytes";
import { pack } from "@ethersproject/solidity";
import { TransactionRequest } from "@ethersproject/providers";

export enum OperationType {
  Call = 0,
  DelegateCall = 1,
}

export interface MetaTransaction {
  to: string;
  value: bigint;
  data: string;
  operation: OperationType;
}

const MULTI_SEND_ABI = ["function multiSend(bytes memory transactions)"];
const MULTI_SEND_CONTRACT_ADDRESS =
  "0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761";

function packOneTx(tx: TransactionRequest) {
  return pack(
    ["uint8", "address", "uint256", "uint256", "bytes"],
    [
      OperationType.Call,
      tx.to,
      tx.value,
      hexDataLength(tx.data as string),
      tx.data,
    ]
  );
}

const remove0x = (hexString: string) => hexString.substr(2);

export default function (
  transactions: MetaTransaction[],
  multiSendContractAddress: string = MULTI_SEND_CONTRACT_ADDRESS
): MetaTransaction {
  const transactionsEncoded =
    "0x" + transactions.map(packOneTx).map(remove0x).join("");

  const multiSendContract = new Interface(MULTI_SEND_ABI);
  const data = multiSendContract.encodeFunctionData("multiSend", [
    transactionsEncoded,
  ]);

  return {
    operation: OperationType.DelegateCall,
    to: multiSendContractAddress || MULTI_SEND_CONTRACT_ADDRESS,
    value: BigInt(0),
    data,
  };
}
