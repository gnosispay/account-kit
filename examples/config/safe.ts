import { parseEther } from "viem";

const RECEIVER_ADDRESS = "0x4822521e6135cd2599199c83ea35179229a172ee";
const SPENDER_ADDRESS = "0x896a695d5ccdd21f9e3bb18307a558befccb8428";
const DELAY_COOLDOWN = 3 * 60;
const DELAY_EXPIRATION = 30 * 60;
const DEFAULT_ALLOWANCE_REFILL = parseEther("350");
const DEFAULT_ALLOWANCE_PERIOD = 60 * 60 * 24;
const EURE_TOKEN_ADDRESS = "0xcB444e90D8198415266c6a2724b7900fb12FC56E";

interface SafeConfig {
  receiver: string;
  spender: string;
  token: string;
  allowance: {
    refill: bigint;
    period: number;
  };
  delay: {
    cooldown: number;
    expiration: number;
  };
}

export const SAFE_CONFIG: SafeConfig = {
  // The address that will receive the spent funds
  receiver: RECEIVER_ADDRESS,
  // The address that will transfer the spent funds
  spender: SPENDER_ADDRESS,
  // The token that is allowed to be spent
  token: EURE_TOKEN_ADDRESS,
  allowance: {
    refill: DEFAULT_ALLOWANCE_REFILL,
    period: DEFAULT_ALLOWANCE_PERIOD,
  },
  delay: {
    cooldown: DELAY_COOLDOWN,
    expiration: DELAY_EXPIRATION,
  },
};
