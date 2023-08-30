import { Interface, ZeroAddress } from "ethers";

import deployments from "../../deployments";
import {
  OperationType,
  SafeTransactionData,
  TransactionData,
} from "../../types";
import { typedDataForSafeTransaction } from "../../eip712";

export default function populateTransferTokenTransaction(
  safeAddress: string,
  transfer: { token: string; to: string; amount: number | bigint },
  signature: string
): TransactionData {
  const safeInterface = deployments.safeMastercopy.iface;

  const { to, value, data, operation } = populateSafeTransaction(transfer);

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

export function signTokenTransfer(
  safeAddress: string,
  chainId: number,
  { token, to, amount }: { token: string; to: string; amount: number | bigint },
  nonce: number,
  sign: (domain: any, types: any, message: any) => Promise<string>
) {
  const { domain, types, message } = typedDataForSafeTransaction(
    safeAddress,
    chainId,
    populateSafeTransaction({ token, to, amount }),
    nonce
  );

  return sign(domain, types, message);
}

function populateSafeTransaction({
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
