import { ZeroAddress } from "ethers";

import { IERC20__factory } from "../../typechain-types";
import { ACCOUNT_SALT_NONCE } from "../constants";
import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";
import { _populateSafeCreation, _predictSafeAddress } from "../parts";

import {
  OperationType,
  SignTypedData,
  TransactionData,
  Transfer,
} from "../types";

export function predictAccountAddress(
  owner: string,
  saltNonce: bigint = ACCOUNT_SALT_NONCE
): string {
  return _predictSafeAddress(owner, saltNonce);
}

export default function populateAccountCreation(
  owner: string,
  seed: bigint = ACCOUNT_SALT_NONCE
): TransactionData {
  return _populateSafeCreation(owner, seed);
}

export async function populateDirectTransfer(
  {
    account,
    chainId,
    nonce,
  }: { account: string; chainId: number; nonce: number },
  transfer: Transfer,
  sign: SignTypedData
): Promise<TransactionData> {
  const { to, value, data, operation } = {
    to: transfer.token,
    data: IERC20__factory.createInterface().encodeFunctionData("transfer", [
      transfer.to,
      transfer.amount,
    ]),
    value: 0,
    operation: OperationType.Call,
  };

  const { domain, primaryType, types, message } = typedDataForSafeTransaction(
    { safe: account, chainId, nonce },
    { to, value, data, operation }
  );

  const signature = await sign({ domain, primaryType, types, message });

  const { iface } = deployments.safeMastercopy;
  return {
    to: account,
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
