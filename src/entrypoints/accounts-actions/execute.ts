import { AbiCoder, concat, getAddress, zeroPadValue, toBeHex } from "ethers";

import deployments from "../../deployments";
import typedDataForModifierTransaction from "../../eip712";
import { predictDelayModAddress } from "../../parts";

import {
  OperationType,
  SignTypedDataCallback,
  TransactionRequest,
} from "../../types";

type EnqueueParameters = {
  /**
   * The address of the account Safe
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
 * Helper function to encode transaction data for the delay modifier
 */
function encodeDelayModTransaction(transaction: TransactionRequest): string {
  return deployments.delayModMastercopy.iface.encodeFunctionData(
    "execTransactionFromModule",
    [
      transaction.to,
      transaction.value || 0,
      transaction.data,
      transaction.operationType ?? OperationType.Call,
    ]
  );
}

/**
 * Encodes an ERC1271 signature for use with the delay modifier
 * This implements the SignatureChecker format required by the delay module.
 * Returns the complete final calldata ready to be sent to the delay module.
 *
 * Final structure: [execFromModuleCalldata] + [signature] + [salt] + [r] + [s] + [v]
 * Where:
 * - r = padded smart wallet address (32 bytes)
 * - s = signature offset (32 bytes)
 * - v = 0x00 (contract signature marker)
 *
 * @param signature - The ERC1271 signature to encode
 * @param smartWalletAddress - The smart contract wallet address that created the signature
 * @param salt - The salt used in the transaction
 * @param execFromModuleCalldata - The original execTransactionFromModule calldata
 * @returns The complete final calldata for the delay module transaction
 */
function encodeERC1271Signature(
  signature: string,
  smartWalletAddress: string,
  salt: string,
  execFromModuleCalldata: string
): string {
  // For ERC-1271 contract signatures in SignatureChecker:
  // Final structure: [execFromModuleCalldata] + [signature] + [salt] + [r] + [s] + [v]

  // r = padded smart wallet address (32 bytes)
  const r = zeroPadValue(getAddress(smartWalletAddress), 32);

  // s = signature offset - points to where signature starts in the final calldata
  // This is the length of the original execFromModuleCalldata in bytes
  const signatureOffset = (execFromModuleCalldata.length - 2) / 2;
  const s = zeroPadValue(toBeHex(signatureOffset), 32);

  // v = 0x00 (contract signature marker)
  const v = "0x00";

  // Complete final calldata: execFromModuleCalldata + signature + salt + r + s + v
  return concat([execFromModuleCalldata, signature, salt, r, s, v]);
}

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
  const { domain, primaryType, types, message } = generateTypedData(
    { account, chainId, salt },
    transaction
  );

  const signature = await sign({ domain, primaryType, types, message });

  return getTransactionRequest({
    account,
    transaction,
    message,
    signature,
  });
}

/**
 * Constructs the final transaction request for executing a queued transaction
 * on the Delay Modifier. This function combines the encoded transaction data
 * with the salt and signature to create a relay-ready transaction.
 *
 * Supports both EOA and ERC1271 signatures:
 * - If smartWalletAddress is provided: ERC1271 signature encoding
 * - If smartWalletAddress is not provided: EOA signature (default)
 *
 * @param parameters - Object containing account, transaction, message, and signature
 * @param parameters.account - The address of the account Safe (renamed to gpSafe for clarity)
 * @param parameters.transaction - The original transaction to be executed
 * @param parameters.message - The message object containing salt and data from typed data generation
 * @param parameters.signature - The EIP-712 signature
 * @param parameters.smartWalletAddress - Optional smart contract wallet address for ERC1271 signatures
 * @returns The complete transaction request ready for relay execution
 *
 * @example
 * // EOA signature (default)
 * import { getTransactionRequest } from "@gnosispay/account-kit";
 *
 * const txRequest = getTransactionRequest({
 *   account: "0x<gp_safe_address>",
 *   transaction: { to: "0x<address>", value: 0n, data: "0x<bytes>" },
 *   message: { salt: "0x<bytes32>", data: "0x<encoded_data>" },
 *   signature: "0x<eoa_signature>"
 * });
 *
 * @example
 * // ERC1271 signature
 * const txRequest = getTransactionRequest({
 *   account: "0x<gp_safe_address>",
 *   transaction: { to: "0x<address>", value: 0n, data: "0x<bytes>" },
 *   message: { salt: "0x<bytes32>", data: "0x<encoded_data>" },
 *   signature: "0x<erc1271_signature>",
 *   smartWalletAddress: "0x<smart_wallet_address>"
 * });
 */
export const getTransactionRequest = ({
  account: gpSafe,
  transaction,
  message,
  signature,
  smartWalletAddress,
}: {
  account: string;
  transaction: TransactionRequest;
  message: {
    salt: string;
    data: string;
  };
  signature: string;
  smartWalletAddress?: string;
}) => {
  const checkSumedAccount = getAddress(gpSafe);
  const delayModAddress = predictDelayModAddress(checkSumedAccount);
  const encodedData = encodeDelayModTransaction(transaction);

  if (!smartWalletAddress) {
    // EOA signature - original format
    return {
      to: delayModAddress,
      value: 0,
      data: concat([encodedData, message.salt, signature]),
    };
  } else {
    // ERC1271 signature - use SignatureChecker format
    // The encodeERC1271Signature function returns the complete final calldata
    // Structure: [execFromModuleCalldata] + [signature] + [salt] + [r] + [s] + [v]
    const finalCalldata = encodeERC1271Signature(
      signature,
      smartWalletAddress,
      message.salt,
      encodedData
    );

    return {
      to: delayModAddress,
      value: 0,
      data: finalCalldata,
    };
  }
};

/**
 * Generates EIP-712 typed data for a transaction that will be queued in the
 * Delay Modifier. This function prepares all the necessary components for
 * signature generation without executing the transaction.
 *
 * @param parameters - Object containing account, chainId, and optional salt
 * @param parameters.account - The address of the account Safe
 * @param parameters.chainId - ID associated with the current network
 * @param parameters.salt - Optional bytes32 string for signature replay protection (random if omitted)
 * @param transaction - The transaction to be queued for delayed execution
 * @returns Object containing domain, primaryType, types, and message for EIP-712 signing
 *
 * @example
 * import { generateTypedData } from "@gnosispay/account-kit";
 *
 * const typedData = generateTypedData(
 *   { account: "0x<address>", chainId: 1 },
 *   { to: "0x<address>", value: 0n, data: "0x<bytes>" }
 * );
 * // Send typedData to frontend for user signature
 */
export const generateTypedData = (
  { account, chainId, salt }: EnqueueParameters,
  transaction: TransactionRequest
) => {
  const checkSumedAccount = getAddress(account);
  salt = salt || saltFromTimestamp();

  const delayModAddress = predictDelayModAddress(checkSumedAccount);
  const encodedData = encodeDelayModTransaction(transaction);

  const { domain, primaryType, types, message } =
    typedDataForModifierTransaction(
      { modifier: delayModAddress, chainId },
      { data: encodedData, salt }
    );

  return { domain, primaryType, types, message };
};

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
  innerTransaction: TransactionRequest
): TransactionRequest {
  account = getAddress(account);

  const delayMod = {
    address: predictDelayModAddress(account),
    iface: deployments.delayModMastercopy.iface,
  };

  return {
    to: delayMod.address,
    value: 0,
    data: delayMod.iface.encodeFunctionData("executeNextTx", [
      innerTransaction.to,
      innerTransaction.value || 0,
      innerTransaction.data,
      innerTransaction.operationType ?? OperationType.Call,
    ]),
  };
}

/**
 * Generates a timestamp-based salt value encoded as bytes32 for use in
 * transaction replay protection. Uses the current timestamp in milliseconds.
 *
 * @returns A bytes32 encoded timestamp suitable for use as a salt parameter
 *
 * @example
 * import { saltFromTimestamp } from "@gnosispay/account-kit";
 *
 * const salt = saltFromTimestamp();
 * // Use salt in generateTypedData or other functions requiring replay protection
 */
export function saltFromTimestamp() {
  return AbiCoder.defaultAbiCoder().encode(["uint256"], [Date.now()]);
}
