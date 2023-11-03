import dotenv from "dotenv";
import hre from "hardhat";
import { SetupConfig } from "../src/types";
import { IERC20__factory } from "../typechain-types";
import { parseUnits } from "ethers";

export async function fork(blockNumber: number): Promise<void> {
  // Load environment variables.
  dotenv.config();

  const { GATEWAY_API_KEY, GATEWAY_RPC_URL } = process.env;
  // fork mainnet
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: GATEWAY_RPC_URL,
          httpHeaders: { Authorization: `Bearer ${GATEWAY_API_KEY}` },
          blockNumber,
        },
      },
    ],
  });
}

export async function forkReset(): Promise<void> {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [],
  });
}

export async function moveERC20(
  from: string,
  to: string,
  tokenAddress: string,
  balance?: bigint | number
) {
  const [, , , , , , , , , john] = await hre.ethers.getSigners();

  await john.sendTransaction({
    to: from,
    value: parseUnits("1"),
  });

  const impersonator = await hre.ethers.getImpersonatedSigner(from);

  const token = IERC20__factory.connect(tokenAddress, impersonator);

  const receipt = await token.transfer(
    to,
    balance || (await token.balanceOf(from))
  );

  await receipt.wait();
}

export function createSetupConfig({
  // for allowance
  spender,
  receiver,
  token = GNO,
  allowance = 1000000,
  period = 60 * 60 * 24, // in seconds, 1 day
  cooldown = 60 * 3, // in seconds, 3 minutes
  expiration = 60 * 30, // in seconds, 30 minutes
  timestamp,
}: {
  spender: string;
  receiver: string;
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

export const GNO = "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb";
export const GNO_WHALE = "0x458cd345b4c05e8df39d0a07220feb4ec19f5e6f";
