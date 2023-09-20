import { ACCOUNT_SALT_NONCE } from "../constants";
import { populateSafeCreation } from "../deployers/__safe";
import { TransactionData } from "../types";

export default function populateAccountCreation(
  eoa: string,
  seed: bigint = ACCOUNT_SALT_NONCE
): TransactionData {
  return populateSafeCreation(eoa, seed);
}
