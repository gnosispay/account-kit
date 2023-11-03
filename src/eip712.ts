import { ZeroAddress, keccak256, toUtf8Bytes } from "ethers";
import { SafeTransactionData } from "./types";

export function typedDataForSafeTransaction(
  {
    safe,
    chainId,
    nonce,
  }: {
    safe: string;
    chainId: bigint | number;
    nonce: bigint | number;
  },
  { to, value, data, operation }: SafeTransactionData
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
    chainId: bigint | number;
  },
  { data, salt }: { data: string; salt: string }
) {
  if (!BYTES32_REGEX.test(salt)) {
    throw new Error(`Salt is not a bytes32 string ${salt}`);
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

export function randomBytes32() {
  return keccak256(toUtf8Bytes(String(Date.now())));
}
