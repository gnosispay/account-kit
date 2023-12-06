import { toUtf8Bytes, keccak256 } from "ethers";

// prod ->  BigInt(keccak256(toUtf8Bytes("gnosispay.com")));
// dev  ->  BigInt(keccak256(toBytes("dev.gnosispay.com")));
export const ACCOUNT_CREATION_NONCE = BigInt(
  keccak256(toUtf8Bytes("gnosispay.com"))
);

export const SPENDING_ROLE_KEY = keccak256(toUtf8Bytes("SPENDING_ROLE"));

export const SPENDING_ALLOWANCE_KEY = keccak256(
  toUtf8Bytes("SPENDING_ALLOWANCE")
);
