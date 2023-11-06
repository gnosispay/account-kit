import { concat, getAddress } from "ethers";

import deployments from "../deployments";
import typedDataForModifierTransaction, { randomBytes32 } from "../eip712";
import { predictDelayAddress } from "../parts";

import {
  OperationType,
  SignTypedDataCallback,
  TransactionRequest,
} from "../types";

type EnqueueParameters = {
  /**
   * The address of the account
   */
  account: string;
  /*
   * ID associated with the current network.
   */
  chainId: number;
  /*
   * An optional bytes32 string that will be used for signature replay protection
   * (Should be omitted, and in that case, a random salt will be generated)
   */
  salt?: string;
};

type DispatchParameters = {
  /**
   * The address of the account
   */
  account: string;
};

/**
 * Generates a payload that wraps a transaction, and posts it to the Delay Mod
 * queue. The populated transaction is relay ready, and does not require
 * additional signing.
 *
 * @param parameters - {@link EnqueueParameters}
 * @param transaction - {@link TransactionRequest}
 * @param sign - {@link SignTypedDataCallback}
 * @returns The signed transaction payload {@link TransactionRequest}
 *
 * @example
 * import { populateExecuteEnqueue } from "@gnosispay/account-kit";
 *
 * const owner: Signer = {};
 * const enqueueTx = await populateExecuteEnqueue(
 *  { account: `0x<address>`, chainId: `<number>` },
 *  { to: `0x<address>`, value: `<bigint>`, data: `0x<bytes>` },
 *  // callback that wraps an eip-712 signature
 *  ({ domain, primaryType, types, message }) =>
 *    owner.signTypedData(domain, primaryType, types, message)
 * );
 * await relayer.sendTransaction(enqueueTx);
 */
export async function populateExecuteEnqueue(
  { account, chainId, salt }: EnqueueParameters,
  transaction: TransactionRequest,
  sign: SignTypedDataCallback
): Promise<TransactionRequest> {
  account = getAddress(account);
  salt = salt || randomBytes32();

  const delay = {
    address: predictDelayAddress(account),
    iface: deployments.delayMastercopy.iface,
  };

  const { to, value, data } = {
    to: delay.address,
    value: 0,
    data: delay.iface.encodeFunctionData("execTransactionFromModule", [
      transaction.to,
      transaction.value || 0,
      transaction.data,
      OperationType.Call,
    ]),
  };

  const { domain, primaryType, types, message } =
    typedDataForModifierTransaction(
      { modifier: delay.address, chainId },
      { data, salt }
    );

  const signature = await sign({ domain, primaryType, types, message });

  return { to, value, data: concat([data, salt, signature]) };
}

/**
 * Generates a payload that executes a transaction previously posted to the
 * Delay Mod. Only works after cooldown seconds have passed, and before
 * expiration.  The populated transaction is relay ready,  and does not require
 * additional signing.
 *
 * @param parameters - {@link DispatchParameters}
 * @param transaction - {@link TransactionRequest}
 * @returns The signed transaction payload {@link TransactionRequest}
 *
 * @example
 * import { populateExecuteDispatch } from "@gnosispay/account-kit";
 *
 * const dispatchTx = await populateExecuteDispatch(
 *  { account: `0x<address>` },
 *  { to: `0x<address>`, value: `<bigint>`, data: `0x<bytes>` },
 * );
 * await relayer.sendTransaction(enqueueTx);
 */
export function populateExecuteDispatch(
  { account }: DispatchParameters,
  transaction: TransactionRequest
): TransactionRequest {
  account = getAddress(account);

  const delay = {
    address: predictDelayAddress(account),
    iface: deployments.delayMastercopy.iface,
  };

  return {
    to: delay.address,
    value: 0,
    data: delay.iface.encodeFunctionData("executeNextTx", [
      transaction.to,
      transaction.value || 0,
      transaction.data,
      OperationType.Call,
    ]),
  };
}
