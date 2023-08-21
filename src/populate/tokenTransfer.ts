import { Interface } from "ethers/lib/utils.js";

import { OperationType, TransactionData } from "../types";

import deployments from "../deployments";
import { predictSafeAddress } from "./accountCreation";
import makeSignatureInput from "../makeSignatureInput";

const AddressZero = "0x0000000000000000000000000000000000000000";

export function populateTransferTokenTransaction(
  ownerAccount: string,
  { token, to, amount }: { token: string; to: string; amount: number | bigint },
  signature: string
): TransactionData {
  const safeAddress = predictSafeAddress(ownerAccount);
  const safeInterface = new Interface(deployments.safe.abi);

  return {
    to: safeAddress,
    data: safeInterface.encodeFunctionData("execTransaction", [
      token,
      0,
      encodeERC20Transfer(to, amount),
      0,
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
  return makeSignatureInput(
    ownerAccount,
    chainId,
    {
      to: token,
      data: encodeERC20Transfer(to, amount),
      value: 0,
      operation: OperationType.Call,
    },
    nonce
  );
}

function encodeERC20Transfer(to: string, amount: number | bigint) {
  const iface = new Interface([
    "function transfer(address recipient, uint256 amount)",
  ]);
  return iface.encodeFunctionData("transfer", [to, amount]);
}
