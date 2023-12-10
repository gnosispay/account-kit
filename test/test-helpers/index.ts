import dotenv from "dotenv";
import hre from "hardhat";

import deployAssets from "./assets";
import { SetupConfig } from "../../src";

export async function preFixture() {
  const [signer] = await hre.ethers.getSigners();
  await deployAssets(signer);
  dotenv.config();
}

export async function postFixture() {
  await forkReset();
}

const AddressTwo = "0x0000000000000000000000000000000000000002";
const AddressThree = "0x0000000000000000000000000000000000000003";
const AddressFour = "0x0000000000000000000000000000000000000004";

export function createSetupConfig({
  // for allowance
  spender = AddressTwo,
  receiver = AddressThree,
  token = AddressFour,
  allowance = 1000000,
  period = 60 * 60 * 24, // in seconds, 1 day
  cooldown = 60 * 3, // in seconds, 3 minutes
  expiration = 60 * 30, // in seconds, 30 minutes
  timestamp,
}: {
  spender?: string;
  receiver?: string;
  token?: string;
  allowance?: number | bigint;
  period?: number;
  timestamp?: number;
  cooldown?: number;
  expiration?: number;
}): SetupConfig {
  return {
    spender,
    receiver,
    token,
    allowance: {
      refill: allowance,
      period,
      timestamp,
    },
    delay: {
      cooldown,
      expiration,
    },
  };
}

// export async function fork(blockNumber: number): Promise<void> {
//   const { GATEWAY_API_KEY, GATEWAY_RPC_URL } = process.env;
//   // fork mainnet
//   await hre.network.provider.request({
//     method: "hardhat_reset",
//     params: [
//       {
//         forking: {
//           jsonRpcUrl: GATEWAY_RPC_URL,
//           httpHeaders: { Authorization: `Bearer ${GATEWAY_API_KEY}` },
//           blockNumber,
//         },
//       },
//     ],
//   });
// }

export async function forkReset(): Promise<void> {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [],
  });
}
