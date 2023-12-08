# Account Kit

Software development kit that facilitates the interaction with on-chain Gnosis Pay accounts.

For each account action, this SDK provides a function that populates transaction payloads. The generated transactions are ready to be relayed, and do not require additional signing.

## Table of contents

- [Account Creation](#account-creation)
- [Direct Transfer](#direct-transfer)
- [Account Setup](#account-setup)
- [Execute](#execute)
- [Limit](#limit)
- [Spend](#spend)
- [Account Query](#account-query)
- [Contributors](#contributors)

## <a name="account-creation">Account Creation</a>

Creates a new 1/1 safe.

```js
import { populateAccountCreation } from "@gnosispay/account-kit";

const createTx = populateAccountCreation({
  owner: `0x<address>`,
});
await relayer.sendTransaction(createTx);
```

## <a name="direct-transfer">Direct Transfer</a>

Signs a ERC20 token transfer out of the account. To be used on newly created 1/1 safes (before setup). The populated transaction is relay ready, and does not require additional signing.

```js
import { populateDirectTransfer } from "@gnosispay/account-kit";

const owner : Signer = {};
const nonce = `<number>`; // see Account Setup section, nonce comment

const transaction = await populateDirectTransfer(
  { safe: `0x<address>`, chainId: `<number>`, nonce: nonce },
  { token: `0x<address>`, to: `0x<address>`, amount: `<bigint>` },
  // callback that wraps an eip-712 signature by owner
  ({ domain, primaryType, types, message }) => owner.signTypedData(...)
);

await relayer.sendTransaction(transaction);
```

## <a name="account-setup">Account Setup</a>

Upgrades a 1/1 safe to a Gnosis Pay account. The populated transaction is relay ready, and does not require additional signing.

```js
import {
  createSetupConfig, populateAccountSetup,
} from "@gnosispay/account-kit";

const owner: Signer = {};
/*
 * NOTE: on the nonce argument for "Account Setup":
 * Unlike limit, spend or execute, this operation is performed on a basic safe.
 * As a result, it depends on safe-core signatures and the safe-core nonce.
 * Must query the on-chain safe nonce value and use it to sign the transaction.
 *
 * In contrast, limit/spend/execute actions run on Zodiac Modifier signatures,
 * which use signer-proposed salts for replay protection and do not require
 * on-chain querying of the nonce.
 */
const nonce = `<number>`;

const config: SetupConfig = createSetupConfig({
  token: `0x<address>`, chainId: `<number>`
})

const transaction = await populateAccountSetup(
  {
    account: `0x<address>`,
    owner: owner.address,
    chainId: `<number>`,
    nonce: nonce
  },
  config,
  // callback that wraps an eip-712 signature !!owner signs!!
  ({ domain, primaryType, types, message }) => owner.signTypedData(...)
);

await relayer.sendTransaction(transaction);
```

## <a name="execute">Execute</a>

This function generates a payload to initiate a transaction execution in the Delay Mod's queue. After the cooldown period has passed, the transaction can be executed. The populated transactions are relay ready, and do not require additional signing.

```js
import {
  populateExecuteEnqueue,
  populateExecuteDispatch,
} from "@gnosispay/account-kit";

const owner : Signer = {};
const innerTransaction = {
  to: `0x<address>`,
  value: `<bigint>`,
  data: `0x<bytes>`
};

const enqueueTx = await populateExecuteEnqueue(
 { account: `0x<address>`, chainId: `<number>` },
  innerTransaction,
  // callback that wraps an eip-712 signature !!owner signs!!
  ({ domain, primaryType, types, message }) => owner.signTypedData(...)
);
await relayer.sendTransaction(enqueueTx);

// ⏳ wait cooldown seconds ⏳

const dispatchTx = populateExecuteDispatch(
  { account },
  innerTransaction
);
await relayer.sendTransaction(dispatchTx);
```

## <a name="limit">Limit</a>

This function generates a payload to initiate an allowance change in the Delay Mod's queue. After the cooldown period has passed, the allowance change can be executed. The owner maintains unilateral control over the Allowance configuration. The populated transactions are relay ready, and do not require additional signing.

```js
import {
  populateLimitEnqueue,
  populateLimitDispatch,
} from "@gnosispay/account-kit";

const owner : Signer = {};
const allowanceConfig : AllowanceConfig = {
  period: `<number>`, // duration, in seconds
  refill: `<bigint>`, // amount added to balance, per period
};

const enqueueTx = await populateLimitEnqueue(
  { account: `0x<address>`, chainId: `<number>` },
  allowanceConfig,
  // callback that wraps an eip-712 signature !!owner signs!!
  ({ domain, primaryType, types, message }) => owner.signTypedData(...)
);
await relayer.sendTransaction(enqueueTx);

// ⏳ wait cooldown seconds ⏳

const dispatchTx = populateLimitDispatch(
  { account: `0x<address>` },
  allowanceConfig
);
await relayer.sendTransaction(dispatchTx);
```

## <a name="spend">Spend</a>

This function generates the spend payload to be submitted when executing a payment. Through each account's Roles Mod, spender has unilateral spend access as long as they stay within the configured Allowance limits. The populated transaction is relay ready, and does not require additional signing.

```js
import { populateSpend } from "@gnosispay/account-kit";

const delegate: Signer = {}; // the spend delegate, configured in the Gnosis Pay Spender Safe
const transfer: Transfer = {
  token: `0x<address>`,
  to: `0x<address>`,
  amount: `<bigint>`,
};

const spendTx = await populateSpend(
  { account: `0x<address>`, spender: `0x<address>`, chainId: `<number>` },
  transfer,
  // callback that wraps an eip-712 signature !!spender signs!!
  ({ domain, primaryType, types, message }) => spender.signTypedData(...)
);
await relayer.sendTransaction(spendTx);
```

## <a name="account-query">Account Query</a>

This function generates a multicall payload that gathers all the necessary data to evaluate whether a given Gnosis Pay account meets the integrity requirements. It then returns an integrity status code along with the accrued Allowance balance.

```js
import { accountQuery } from "@gnosispay/account-kit";

const {
  status,
  allowance: { balance, refill, period, maxRefill, nextRefill },
} = await accountQuery(
  { account: `0x<address>`, cooldown: `<number>` },
  // a function that receives a tx and performs eth_call, library agnostic
  ({ to, data }) => provider.send("eth_call", [{ to, data }])
);
```

## <a name="contributors">Contributors</a>

- Cristóvão Honorato ([cristovaoth](https://github.com/cristovaoth))
