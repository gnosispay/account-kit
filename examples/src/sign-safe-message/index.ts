import {
  predictAccountAddress,
  populateSignMessageEnqueue,
  populateSignMessageDispatch,
} from "@gnosispay/account-kit";
import dotenv from "dotenv";
import { privateKeyToAccount, type Account } from "viem/accounts";

import { walletClient } from "../../config/clients";
import { wallet } from "../../config/wallet";

dotenv.config();

const { WALLET_PRIVATE_KEY } = process.env as { WALLET_PRIVATE_KEY: string };

const MESSAGE = "Hello World";
const SIGNING_ACCOUNT: Account = privateKeyToAccount(
  WALLET_PRIVATE_KEY as `0x${string}`
);

const run = async (): Promise<void> => {
  const owner = wallet.address;
  const safeAddress = predictAccountAddress({ owner });

  const { to, value, data } = await populateSignMessageEnqueue(
    {
      account: safeAddress,
      chainId: 100,
    },
    MESSAGE,
    ({ domain, types, message }) => wallet.signTypedData(domain, types, message)
  );

  const txHash = await walletClient.sendTransaction({
    to: to as `0x${string}`,
    value: value as bigint,
    data: data as `0x${string}`,
    account: SIGNING_ACCOUNT,
  });

  console.log(`\n Successfully enqueued signature tx on Delay Module! 🚀 \n`);
  console.table({
    "Transaction URL": `https://gnosisscan.io/tx/${txHash}`,
  });

  console.log(
    "\n Waiting ~3 minutes to execute signature request on Delay module...\n"
  );

  setTimeout(
    async () => {
      const { to, value, data } = await populateSignMessageDispatch(
        {
          account: safeAddress,
        },
        MESSAGE
      );

      const executeTxHash = await walletClient.sendTransaction({
        to: to as `0x${string}`,
        value: value as bigint,
        data: data as `0x${string}`,
        account: SIGNING_ACCOUNT,
      });

      console.log(
        `\n Successfully executed signature request on Delay Module! 🚀 \n`
      );
      console.table({
        "Transaction URL": `https://gnosisscan.io/tx/${executeTxHash}`,
      });
    },
    3.5 * 60 * 1000
  );
};

run();
