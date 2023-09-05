import dotenv from "dotenv";
import hre from "hardhat";
import { AccountConfig } from "../../src/types";
import { IERC20__factory } from "../../typechain-types";

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
  const impersonator = await hre.ethers.getImpersonatedSigner(from);

  const token = IERC20__factory.connect(tokenAddress, impersonator);

  const receipt = await token.transfer(
    to,
    balance || (await token.balanceOf(from))
  );

  await receipt.wait();
}

export function createAccountConfig({
  // for allowance
  owner,
  spender,
  token = GNO,
  amount = 1000000,
  period = 60 * 24, // in minutes, 1 day
  // for delay
  cooldown = 20, // in minutes, 20 minutes
}: {
  owner: string;
  spender: string;
  token?: string;
  amount?: number | bigint;
  period?: number;
  cooldown?: number;
}): AccountConfig {
  return {
    owner,
    spender,
    token,
    amount,
    period,
    cooldown,
  };
}

export const GNO = "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb";
export const GNO_WHALE = "0x458cd345b4c05e8df39d0a07220feb4ec19f5e6f";
