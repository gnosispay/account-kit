import { keccak256, toUtf8Bytes } from "ethers";
import { predictSafeAddress, populateSafeCreation } from "./__safe";

import { TransactionData } from "../types";

const ownerChannelSaltNonce = (safe: string) =>
  BigInt(keccak256(toUtf8Bytes(`OWNER_CHANNEL_SALT_NONCE-${safe}`)));

const spenderChannelSaltNonce = (safe: string) =>
  BigInt(keccak256(toUtf8Bytes(`SPENDER_CHANNEL_SALT_NONCE-${safe}`)));

export function predictOwnerChannelAddress({
  eoa,
  safe,
}: {
  eoa: string;
  safe: string;
}): string {
  return predictSafeAddress(eoa, ownerChannelSaltNonce(safe));
}

export function predictSpenderChannelAddress({
  safe,
  spender,
}: {
  safe: string;
  spender: string;
}): string {
  return predictSafeAddress(spender, spenderChannelSaltNonce(safe));
}

export function populateOwnerChannelCreation({
  eoa,
  safe,
}: {
  eoa: string;
  safe: string;
}): TransactionData {
  return populateSafeCreation(eoa, ownerChannelSaltNonce(safe));
}

export function populateSpenderChannelCreation({
  safe,
  spender,
}: {
  safe: string;
  spender: string;
}): TransactionData {
  return populateSafeCreation(spender, spenderChannelSaltNonce(safe));
}
