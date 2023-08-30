import { Interface, ZeroAddress } from "ethers";

import deployments from "../../deployments";
import { typedDataForSafeTransaction } from "../../eip712";
import {
  OperationType,
  SafeTransactionData,
  TransactionData,
} from "../../types";

export default async function populateTransferToken(
  safeAddress: string,
  chainId: bigint | number,
  transfer: { token: string; to: string; amount: bigint | number },
  nonce: bigint | number,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const safeInterface = deployments.safeMastercopy.iface;

  const { to, value, data, operation } = populateSafeTransaction(transfer);

  const { domain, types, message } = typedDataForSafeTransaction(
    safeAddress,
    chainId,
    { to, value, data, operation },
    nonce
  );

  const signature = await sign(domain, types, message);

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

function populateSafeTransaction({
  token,
  to,
  amount,
}: {
  token: string;
  to: string;
  amount: bigint | number;
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
