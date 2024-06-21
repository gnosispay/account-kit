import {
  predictAccountAddress,
  populateAccountSetup,
} from "@gnosispay/account-kit";

import { SAFE_ABI } from "../../config/abi";
import { publicClient } from "../../config/clients";
import { SAFE_CONFIG } from "../../config/safe";
import { wallet } from "../../config/wallet";

async function run(): Promise<void> {
  const owner: string = wallet.address;

  const safeAddress: string = predictAccountAddress({ owner });

  const nonce = await publicClient.readContract({
    abi: SAFE_ABI,
    address: safeAddress as `0x${string}`,
    functionName: "nonce",
  });

  const safeSetupTx: any = await populateAccountSetup(
    {
      account: safeAddress,
      owner,
      chainId: 100,
      nonce: Number(nonce),
    },
    SAFE_CONFIG,
    async ({ domain, types, message }: any) => {
      const signature: string = await wallet.signTypedData(
        domain,
        types,
        message
      );

      return signature;
    }
  );

  const { hash: txHash }: { hash: string } =
    await wallet.sendTransaction(safeSetupTx);

  console.log(`\n Successfully completed Gnosis Pay Safe setup! 🚀 \n`);

  console.table({
    "Safe Address": `https://app.safe.global/home?safe=gno:${safeAddress}`,
    "Safe Owner": `https://gnosisscan.io/address/${owner}`,
    "Transaction URL": `https://gnosisscan.io/tx/${txHash}`,
  });
}

run();
