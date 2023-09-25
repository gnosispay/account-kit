import { toUtf8Bytes, keccak256 } from "ethers";

export const ACCOUNT_SALT_NONCE = BigInt(
  "5114647649581446628743670001764890754687493338792207058163325042301318925668"
);

export const STUB_SALT_NONCE = BigInt(
  keccak256(toUtf8Bytes("STUB_SALT_NONCE"))
);

export const ROLE_SPENDING_KEY = keccak256(toUtf8Bytes("ROLE_SPENDING"));

export const ALLOWANCE_SPENDING_KEY = keccak256(
  toUtf8Bytes("ALLOWANCE_SPENDING")
);