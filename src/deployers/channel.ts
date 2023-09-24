import { keccak256, toUtf8Bytes } from "ethers";
import { predictSafeAddress, populateSafeCreation } from "./__safe";

import { TransactionData } from "../types";

const ownerChannelSaltNonce = (eoa: string) =>
  BigInt(keccak256(toUtf8Bytes(`OWNER_CHANNEL_SALT_NONCE-${eoa}`)));

const spenderChannelSaltNonce = (eoa: string) =>
  BigInt(keccak256(toUtf8Bytes(`SPENDER_CHANNEL_SALT_NONCE-${eoa}`)));

export function predictOwnerChannelAddress({ eoa }: { eoa: string }): string {
  return predictSafeAddress(eoa, ownerChannelSaltNonce(eoa));
}

export function predictSpenderChannelAddress({
  eoa,
  spender,
}: {
  eoa: string;
  spender: string;
}): string {
  return predictSafeAddress(spender, spenderChannelSaltNonce(eoa));
}

export function populateOwnerChannelCreation({
  eoa,
}: {
  eoa: string;
}): TransactionData {
  return populateSafeCreation(eoa, ownerChannelSaltNonce(eoa));
}

export function populateSpenderChannelCreation({
  eoa,
  spender,
}: {
  eoa: string;
  spender: string;
}): TransactionData {
  return populateSafeCreation(spender, spenderChannelSaltNonce(eoa));
}
