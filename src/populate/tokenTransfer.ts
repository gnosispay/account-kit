import { Interface } from "ethers/lib/utils.js";

import { OperationType, SafeTransactionData, TransactionData } from "../types";

import deployments from "../deployments";
import { predictSafeAddress } from "./accountCreation";
import signSafeTransactionParams from "../signature";

const AddressZero = "0x0000000000000000000000000000000000000000";

export function populateTransferTokenTransaction(
  ownerAccount: string,
  transfer: { token: string; to: string; amount: number | bigint },
  signature: string
): TransactionData {
  const safeAddress = predictSafeAddress(ownerAccount);
  const safeInterface = new Interface(deployments.safe.abi);

  const { to, value, data, operation } = safeTransaction(transfer);

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

/*
 * This function constructs the parameters to be passed to
 * provider._signTypedData(domain, types, values)
 */
export function signTransferTokenParams(
  ownerAccount: string,
  chainId: number,
  { token, to, amount }: { token: string; to: string; amount: number | bigint },
  nonce: number | bigint
) {
  return signSafeTransactionParams(
    ownerAccount,
    chainId,
    safeTransaction({ token, to, amount }),
    nonce
  );
}

function safeTransaction({
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
