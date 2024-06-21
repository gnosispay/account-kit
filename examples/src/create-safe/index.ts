import {
  populateAccountCreation,
  predictAccountAddress,
} from "@gnosispay/account-kit";

import { wallet } from "../../config/wallet";

async function run(): Promise<void> {
  const owner: string = wallet.address;

  const safeCreationTx: any = populateAccountCreation({ owner });

  const { hash: txHash }: { hash: string } = await wallet.sendTransaction({
    ...safeCreationTx,
  });

  const safeAddress: string = predictAccountAddress({ owner });

  console.log(`\n Successfully completed Safe creation! 🚀 \n`);

  console.table({
    "Safe Owner": `https://gnosisscan.io/address/${owner}`,
    "Predicted Safe Address": `https://gnosisscan.io/address/${safeAddress}`,
    "Transaction URL": `https://gnosisscan.io/tx/${txHash}`,
  });
}

run();
