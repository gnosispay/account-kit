import { ZeroAddress, getAddress } from "ethers";

import { IERC20__factory } from "../../../typechain-types";
import { ACCOUNT_CREATION_NONCE } from "../../constants";
import deployments from "../../deployments";
import { typedDataForSafeTransaction } from "../../eip712";
import { _populateSafeCreation } from "../../parts";

import {
  OperationType,
  SignTypedDataCallback,
  TransactionRequest,
  Transfer,
} from "../../types";

type AccountCreationParameters = {
  /**
   * The owner for the account. Will be the sole signer on the resulting safe
   */
  owner: string;
  /**
   * Optional parameter. The nonce used on safe proxy creation. To be left
   * blank as the default value is the expect value for Gnosis Pay accounts
   *
   */
  creationNonce?: bigint;
};

/**
 * Creates a new 1/1 safe
 *
 * @param parameters - {@link AccountCreationParameters}
 * @returns The signed transaction payload {@link TransactionRequest}
 *
 * @example
 * import { populateAccountCreation } from "@gnosispay/account-kit";
 *
 * const creationTx = populateAccountCreation({
 *    owner: "0x0000000000000000000000000000000000000001"
 * });
 *
 * await relayer.sendTransaction(creationTx);
 *
 * // It is also possible to provide a custom creationNonce
 * // (however should be left blank, the default is correct configuration)
 *
 * const creationTx = populateAccountCreation({
 *    owner: "0x0000000000000000000000000000000000000001",
 *    creationNonce: 987654321123456789n
 * });
 *
 * await relayer.sendTransaction(creationTx);
 *
 */
export default function populateAccountCreation({
  owner,
  creationNonce = ACCOUNT_CREATION_NONCE,
}: AccountCreationParameters): TransactionRequest {
  owner = getAddress(owner);

  return _populateSafeCreation({ owners: [owner], creationNonce });
}

export async function populateDirectTransfer(
  {
    account,
    chainId,
    nonce,
  }: { account: string; chainId: number; nonce: number },
  transfer: Transfer,
  sign: SignTypedDataCallback
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
