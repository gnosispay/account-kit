import { createPublicClient, createWalletClient, http } from "viem";
import { gnosis } from "viem/chains";

const publicClient = createPublicClient({ chain: gnosis, transport: http() });

const walletClient = createWalletClient({ chain: gnosis, transport: http() });

export { publicClient, walletClient };
