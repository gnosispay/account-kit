import { ACCOUNT_SALT_NONCE } from "../constants";
import { predictSafeAddress as _predictSafeAddress } from "../deployers/__safe";

export default function predictSafeAddress(
  eoa: string,
  saltNonce: bigint = ACCOUNT_SALT_NONCE
): string {
  return _predictSafeAddress(eoa, saltNonce);
}
