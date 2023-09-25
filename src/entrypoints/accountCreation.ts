import { ZeroAddress } from "ethers";
import { IERC20__factory } from "../../typechain-types";
import { ACCOUNT_SALT_NONCE } from "../constants";
import { populateSafeCreation } from "../deployers/__safe";

import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";

import { OperationType, TransactionData, Transfer } from "../types";

export default function populateAccountCreation(
  eoa: string,
  seed: bigint = ACCOUNT_SALT_NONCE
): TransactionData {
  return populateSafeCreation(eoa, seed);
}

// can only used in a created and non configured safe
export async function populateTransfer(
  { safe, chainId, nonce }: { safe: string; chainId: number; nonce: number },
  transfer: Transfer,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const { iface } = deployments.safeMastercopy;

  const { to, value, data, operation } = {
    to: transfer.token,
    data: IERC20__factory.createInterface().encodeFunctionData("transfer", [
      transfer.to,
      transfer.amount,
    ]),
    value: 0,
    operation: OperationType.Call,
  };

  const { domain, types, message } = typedDataForSafeTransaction(
    safe,
    chainId,
    nonce,
    { to, value, data, operation }
  );

  const signature = await sign(domain, types, message);

  return {
    to: safe,
    data: iface.encodeFunctionData("execTransaction", [
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
