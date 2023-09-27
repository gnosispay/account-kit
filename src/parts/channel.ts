import { keccak256, toUtf8Bytes } from "ethers";
import { _predictSafeAddress, _populateSafeCreation } from "./_safe";

import { TransactionData } from "../types";

const ownerChannelSaltNonce = (safe: string) =>
  BigInt(keccak256(toUtf8Bytes(`OWNER_CHANNEL_SALT_NONCE-${safe}`)));

const spenderChannelSaltNonce = (safe: string) =>
  BigInt(keccak256(toUtf8Bytes(`SPENDER_CHANNEL_SALT_NONCE-${safe}`)));

export function predictOwnerChannelAddress({
  account,
  owner,
}: {
  account: string;
  owner: string;
}): string {
  return _predictSafeAddress(owner, ownerChannelSaltNonce(account));
}

export function predictSpenderChannelAddress({
  account,
  spender,
}: {
  account: string;
  spender: string;
}): string {
  return _predictSafeAddress(spender, spenderChannelSaltNonce(account));
}

export function populateOwnerChannelCreation({
  account,
  owner,
}: {
  account: string;
  owner: string;
}): TransactionData {
  return _populateSafeCreation(owner, ownerChannelSaltNonce(account));
}

export function populateSpenderChannelCreation({
  account,
  spender,
}: {
  account: string;
  spender: string;
}): TransactionData {
  return _populateSafeCreation(spender, spenderChannelSaltNonce(account));
}
