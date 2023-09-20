import { STUB_SALT_NONCE } from "../constants";
import { predictSafeAddress, populateSafeCreation } from "../deployers/__safe";

import { TransactionData } from "../types";

export function populateStubCreation(eoa: string): TransactionData {
  return populateSafeCreation(eoa, STUB_SALT_NONCE);
}

export function predictStubAddress(eoa: string): string {
  return predictSafeAddress(eoa, STUB_SALT_NONCE);
}
