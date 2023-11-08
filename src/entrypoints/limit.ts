import { getAddress } from "ethers";

import {
  populateExecuteDispatch,
  populateExecuteEnqueue,
  saltFromTimestamp,
} from "./execute";
import { SPENDING_ALLOWANCE_KEY } from "../constants";
import deployments from "../deployments";
import { predictBouncerAddress } from "../parts";

import {
  TransactionRequest,
  AllowanceConfig,
  SignTypedDataCallback,
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
 * This function generates a payload to initiate an allowance change in the
 * Delay Mod's queue. The populated transaction is relay ready, and does not
 * require additional signing.
 *
 * @param parameters - {@link EnqueueParameters}
 * @param config - {@link AllowanceConfig}
 * @param sign - {@link SignTypedDataCallback}
 * @returns The signed transaction payload {@link TransactionRequest}
 *
 * @example
 * import { populateLimitEnqueue } from "@gnosispay/account-kit";
 *
 * const owner: Signer = {};
 * const enqueueTx = await populateLimitEnqueue(
 *  { account: `0x<address>`, chainId: `<number>` },
 *  { period: `<number>`, refill: `<bigint>` },
 *  // callback that wraps an eip-712 signature
 *  ({ domain, primaryType, types, message }) =>
 *    owner.signTypedData(domain, primaryType, types, message)
 * );
 * await relayer.sendTransaction(enqueueTx);
 */
export async function populateLimitEnqueue(
  { account, chainId, salt }: EnqueueParameters,
  config: AllowanceConfig,
  sign: SignTypedDataCallback
): Promise<TransactionRequest> {
  account = getAddress(account);
  salt = salt || saltFromTimestamp();

  return populateExecuteEnqueue(
    { account, chainId, salt },
    populateLimitTransaction(account, config),
    sign
  );
}

/**
 * Generates a payload that executes an allowance change previously posted to
 * the Delay Mod. Only works after cooldown seconds and have passed, and before
 * expiration. The populated transaction is relay ready, and does not require
 * additional signing.
 *
 * @param parameters - {@link DispatchParameters}
 * @param transaction - {@link AllowanceConfig}
 * @returns The signed transaction payload {@link TransactionRequest}
 *
 * @example
 * import { populateLimitDispatch } from "@gnosispay/account-kit";
 *
 * const dispatchTx = await populateLimitDispatch(
 *  { account: `0x<address>` },
 *  { period: `<number>`, refill: `<bigint>` },
 * );
 * await relayer.sendTransaction(enqueueTx);
 */
export function populateLimitDispatch(
  { account }: DispatchParameters,
  config: AllowanceConfig
): TransactionRequest {
  account = getAddress(account);

  return populateExecuteDispatch(
    { account },
    populateLimitTransaction(account, config)
  );
}

export function populateLimitTransaction(
  account: string,
  { refill, period, timestamp = 0 }: AllowanceConfig
): TransactionRequest {
  const address = predictBouncerAddress(account);
  const iface = deployments.rolesMastercopy.iface;

  return {
    to: address,
    value: 0,
    data: iface.encodeFunctionData("setAllowance", [
      SPENDING_ALLOWANCE_KEY,
      refill, // balance
      refill, // maxBalance
      refill, // refill
      period, // period
      timestamp, // timestamp
    ]),
  };
}
