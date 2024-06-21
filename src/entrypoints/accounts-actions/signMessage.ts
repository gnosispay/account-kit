import { getAddress, hashMessage } from "ethers";

import {
  populateExecuteDispatch,
  populateExecuteEnqueue,
  saltFromTimestamp,
} from "./execute";
import deployments from "../../deployments";
import {
  TransactionRequest,
  SignTypedDataCallback,
  OperationType,
} from "../../types";

/**
 * Parameters for initiating message signing
 */
type EnqueueParameters = {
  /**
   * The address of the account.
   */
  account: string;
  /**
   * ID associated with the current network.
   */
  chainId: number;
  /**
   * An optional bytes32 string used for signature replay protection.
   * If omitted, a random salt will be generated.
   */
  salt?: string;
};

/**
 * Parameters for executing an allowance change previously posted to the Delay Mod.
 */
type DispatchParameters = {
  /**
   * The address of the account.
   */
  account: string;
};

/**
 * Generates a payload to initiate message signing in Delay Mod’s queue.
 *
 * @param parameters - EnqueueParameters
 * @param message - The message to sign.
 * @param sign - Callback function for signing typed data.
 * @returns The signed transaction payload.
 *
 * @example
 * const owner: Signer = {};
 * const enqueueTx = await populateSignMessageEnqueue(
 *   { account: `0x<address>`, chainId: `<number>` },
 *   "Hello World",
 *   // callback that wraps an eip-712 signature
 *   ({ domain, primaryType, types, message }) =>
 *     owner.signTypedData(domain, primaryType, types, message)
 * );
 * await relayer.sendTransaction(enqueueTx);
 */
export async function populateSignMessageEnqueue(
  { account, chainId, salt }: EnqueueParameters,
  message: string,
  sign: SignTypedDataCallback
): Promise<TransactionRequest> {
  account = getAddress(account);
  salt = salt || saltFromTimestamp();

  return populateExecuteEnqueue(
    { account, chainId, salt },
    createInnerTransaction(message),
    sign
  );
}

/**
 * Generates a payload to execute a message signing request previously posted to the Delay Mod.
 *
 * @param parameters - DispatchParameters
 * @param message - The message to sign.
 * @returns The signed transaction payload.
 *
 * @example
 * const dispatchTx = await populateSignMessageDispatch(
 *   { account: `0x<address>` },
 *   "Hello World",
 * );
 * await relayer.sendTransaction(dispatchTx);
 */
export function populateSignMessageDispatch(
  { account }: DispatchParameters,
  message: string
): TransactionRequest {
  account = getAddress(account);

  return populateExecuteDispatch({ account }, createInnerTransaction(message));
}

/**
 * Creates an inner transaction for signing a message.
 *
 * @param message - The message to sign.
 *
 * @returns The inner transaction object.
 */
export function createInnerTransaction(message: string): TransactionRequest {
  const data = deployments.signMessageLib.iface.encodeFunctionData(
    "signMessage",
    [hashMessage(message)]
  );

  return {
    to: deployments.signMessageLib.address,
    value: 0,
    data,
    operationType: OperationType.DelegateCall,
  };
}
