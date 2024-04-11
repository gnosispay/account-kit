import { getAddress } from "ethers";
import { HexString } from "ethers/lib.commonjs/utils/data";
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

/**
 * This function generates a payload to initiate an addition of the account owner in
 * Delay Mod's queue. The populated transaction is relay ready, and does not
 * require additional signing.
 *
 * @param parameters - {@link EnqueueParameters}
 * @param newOwner - {@link `0x${string}`}
 * @param sign - {@link SignTypedDataCallback}
 * @returns The signed transaction payload {@link TransactionRequest}
 *
 * @example
 * import { populateAddOwnerEnqueue } from "@gnosispay/account-kit";
 *
 * const owner: Signer = {};
 * const enqueueTx = await populateAddOwnerEnqueue(
 *  { account: `0x<address>`, chainId: `<number>` },
 *  newOwner: `0x${string}`,
 *  // callback that wraps an eip-712 signature
 *  ({ domain, primaryType, types, message }) =>
 *    owner.signTypedData(domain, primaryType, types, message)
 * );
 * await relayer.sendTransaction(enqueueTx);
 */
export async function populateAddOwnerEnqueue(
  { account, chainId, salt }: EnqueueParameters,
  newOwner: `0x${string}`,
  sign: SignTypedDataCallback
): Promise<TransactionRequest> {
  account = getAddress(account);
  salt = salt || saltFromTimestamp();

  return populateExecuteEnqueue(
    { account, chainId, salt },
    createInnerTransaction(account, newOwner),
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
 * import { populateAddOwnerDispatch } from "@gnosispay/account-kit";
 *
 * const dispatchTx = await populateAddOwnerDispatch(
 *  { account: `0x<address>` },
 *  newOwner: `0x${string}`,
 * );
 * await relayer.sendTransaction(enqueueTx);
 */
export function populateAddOwnerDispatch(
  { account }: DispatchParameters,
  newOwner: `0x${string}`
): TransactionRequest {
  account = getAddress(account);

  return populateExecuteDispatch(
    { account },
    createInnerTransaction(account, newOwner)
  );
}

export function createInnerTransaction(
  account: string,
  newOwner: `0x${string}`
): TransactionRequest {
  const delayMod = {
    address: predictDelayModAddress(account),
    iface: deployments.delayModMastercopy.iface,
  };

  return {
    to: delayMod.address,
    data: delayMod.iface.encodeFunctionData("enableModule", [newOwner]),
    value: 0,
  };
}

type EthCallCallback = (
  encodedFunctionCall: `0x${string}`
) => Promise<{ data: HexString | undefined }>;

export async function getAccountOwners(
  doEthCall: EthCallCallback,
  from: `0x${string}` = SENTINEL_ADDRESS
): Promise<`0x${string}`[]> {
  const FETCH_COUNT = 100;

  const delayMod = {
    iface: deployments.delayModMastercopy.iface,
  };

  const calldata = delayMod.iface.encodeFunctionData("getModulesPaginated", [
    from,
    FETCH_COUNT,
  ]) as `0x${string}`;

  const ethResult = await doEthCall(calldata);

  if (!ethResult.data) {
    throw new Error("No data returned from eth call");
  }

  const [addresses] = delayMod.iface.decodeFunctionResult(
    "getModulesPaginated",
    ethResult.data
  );

  return [
    ...addresses,
    ...(addresses.length < FETCH_COUNT
      ? []
      : await getAccountOwners(doEthCall, addresses[addresses.length - 1])),
  ];
}

export function removeAccountOwner(
  account: string,
  {
    previousLastAccountOwner,
    accountToRemove,
  }: {
    previousLastAccountOwner: string;
    accountToRemove: string;
  }
) {
  const delayMod = {
    address: predictDelayModAddress(account),
    iface: deployments.delayModMastercopy.iface,
  };

  return delayMod.iface.encodeFunctionData("disableModule", [
    previousLastAccountOwner,
    accountToRemove,
  ]);
}
