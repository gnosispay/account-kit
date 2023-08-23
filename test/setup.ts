import dotenv from "dotenv";
import hre from "hardhat";
import { IERC20__factory } from "../typechain-types";
import { AccountSetupConfig } from "../src/types";

export async function fork(blockNumber: number): Promise<void> {
  // Load environment variables.
  dotenv.config();

  const { ALCHEMY_KEY } = process.env;
  // fork mainnet
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`,
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
  tokenAddress: string
) {
  const impersonator = await hre.ethers.getImpersonatedSigner(from);

  const token = IERC20__factory.connect(tokenAddress, impersonator);

  const receipt = await token.transfer(to, await token.balanceOf(from));

  await receipt.wait();
}

export function createAccountSetupConfig({
  // for allowance
  spender,
  token = DAI,
  amount = 1000000,
  period = 60 * 24, // in minutes, 1 day
  // for delay
  cooldown = 20, // in minutes, 20 minutes
}: {
  spender: string;
  token?: string;
  amount?: number | bigint;
  period?: number;
  cooldown?: number;
}): AccountSetupConfig {
  return {
    spender,
    token,
    amount,
    period,
    cooldown,
  };
}

export const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
export const DAI_WHALE = "0x075e72a5edf65f0a5f44699c7654c1a76941ddc8";
