import { BytesLike } from "ethers";

export type Address = `0x${string}`;

export type SponsoredCallRequest = {
  chainId: number;
  target: string;
  data: BytesLike;
};

export const AddressZero = "0x0000000000000000000000000000000000000000";
