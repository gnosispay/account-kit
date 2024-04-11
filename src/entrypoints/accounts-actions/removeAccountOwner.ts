import { getAddress } from "ethers";
import {
  populateExecuteDispatch,
  populateExecuteEnqueue,
  saltFromTimestamp,
} from "./execute";
import deployments from "../../deployments";
import { predictDelayModAddress } from "../../parts";
import { SignTypedDataCallback, TransactionRequest } from "../../types";

export const SENTINEL_ADDRESS = "0x0000000000000000000000000000000000000001";

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

type RemovalConfig = {
  prevOwner: string;
  ownerToRemove: string;
};

/**
 * This function generates a payload to initiate an removal of existing account owner in
 * Delay Mod's queue. The populated transaction is relay ready, and does not
 * require additional signing.
 *
 * @param parameters - {@link EnqueueParameters}
 * @param newOwner - {@link `0x${string}`}
 * @param sign - {@link SignTypedDataCallback}
 * @returns The signed transaction payload {@link TransactionRequest}
 *
 * @example
 * import { populateRemoveOwnerEnqueue } from "@gnosispay/account-kit";
 *
 * const owner: Signer = {};
 * const enqueueTx = await populateRemoveOwnerEnqueue(
 *  { account: `0x<address>`, chainId: `<number>` },
 *  newOwner: `0x${string}`,
 *  // callback that wraps an eip-712 signature
 *  ({ domain, primaryType, types, message }) =>
 *    owner.signTypedData(domain, primaryType, types, message)
 * );
 * await relayer.sendTransaction(enqueueTx);
 */
export async function populateRemoveOwnerEnqueue(
  { account, chainId, salt }: EnqueueParameters,
  config: RemovalConfig,
  sign: SignTypedDataCallback
): Promise<TransactionRequest> {
  account = getAddress(account);
  salt = salt || saltFromTimestamp();

  return populateExecuteEnqueue(
    { account, chainId, salt },
    createInnerTransaction(account, config),
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
 * import { populateRemoveOwnerDispatch } from "@gnosispay/account-kit";
 *
 * const dispatchTx = await populateRemoveOwnerDispatch(
 *  { account: `0x<address>` },
 *  newOwner: `0x${string}`,
 * );
 * await relayer.sendTransaction(enqueueTx);
 */
export function populateRemoveOwnerDispatch(
  { account }: DispatchParameters,
  config: RemovalConfig
): TransactionRequest {
  account = getAddress(account);

  return populateExecuteDispatch(
    { account },
    createInnerTransaction(account, config)
  );
}

export function createInnerTransaction(
  account: string,
  { prevOwner, ownerToRemove }: RemovalConfig
) {
  const delayMod = {
    address: predictDelayModAddress(account),
    iface: deployments.delayModMastercopy.iface,
  };

  return {
    to: delayMod.address,
    data: delayMod.iface.encodeFunctionData("disableModule", [
      prevOwner,
      ownerToRemove,
    ]),
    value: 0,
  };
}
