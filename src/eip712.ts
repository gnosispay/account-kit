import { ZeroAddress } from "ethers";
import { SafeTransactionRequest } from "./types";

export function typedDataForSafeTransaction(
  {
    safe,
    chainId,
    nonce,
  }: {
    safe: string;
    chainId: number;
    nonce: number;
  },
  { to, value, data, operation }: SafeTransactionRequest
) {
  const domain = { verifyingContract: safe, chainId };
  const primaryType = "SafeTx" as const;
  const types = {
    SafeTx: [
      { type: "address", name: "to" },
      { type: "uint256", name: "value" },
      { type: "bytes", name: "data" },
      { type: "uint8", name: "operation" },
      { type: "uint256", name: "safeTxGas" },
      { type: "uint256", name: "baseGas" },
      { type: "uint256", name: "gasPrice" },
      { type: "address", name: "gasToken" },
      { type: "address", name: "refundReceiver" },
      { type: "uint256", name: "nonce" },
    ],
  };
  const message = {
    to,
    value,
    data,
    operation,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: ZeroAddress,
    refundReceiver: ZeroAddress,
    nonce,
  };

  return { domain, primaryType, types, message };
}

export default function typedDataForModifierTransaction(
  {
    modifier,
    chainId,
  }: {
    modifier: string;
    chainId: number;
  },
  { data, salt }: { data: string; salt: string }
) {
  if (!BYTES32_REGEX.test(salt)) {
    throw new Error(`Salt is not a 32 bytes hex string ${salt}`);
  }

  const domain = { verifyingContract: modifier, chainId };
  const primaryType = "ModuleTx" as const;
  const types = {
    ModuleTx: [
      { type: "bytes", name: "data" },
      { type: "bytes32", name: "salt" },
    ],
  };
  const message = {
    data,
    salt,
  };

  return { domain, primaryType, types, message };
}

const BYTES32_REGEX = /^(0x)?[0-9a-fA-F]{64}$/;
