import { ZeroAddress, getAddress } from "ethers";

import { IERC20__factory } from "../../typechain-types";
import { ACCOUNT_CREATION_NONCE } from "../constants";
import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";
import { _populateSafeCreation, _predictSafeAddress } from "../parts";

import {
  TransactionRequest,
  OperationType,
  SignTypedData,
  Transfer,
} from "../types";

export function predictAccountAddress(
  owner: string,
  creationNonce: bigint = ACCOUNT_CREATION_NONCE
): string {
  return _predictSafeAddress(owner, creationNonce);
}

export default function populateAccountCreation(
  owner: string,
  creationNonce: bigint = ACCOUNT_CREATION_NONCE
): TransactionRequest {
  owner = getAddress(owner);

  return _populateSafeCreation(owner, creationNonce);
}

export async function populateDirectTransfer(
  {
    account,
    chainId,
    nonce,
  }: { account: string; chainId: number; nonce: number },
  transfer: Transfer,
  sign: SignTypedData
): Promise<TransactionRequest> {
  account = getAddress(account);

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
