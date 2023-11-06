# Account Kit

Software development kit that facilitates the interaction with onchain Gnosis Pay accounts.

For each relevant account action, this SDK provides a function that populates transaction payloads. The generated payloads are relay ready, and require no additional signing.

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
  owner: `0x<address>`, // the owner of the account
});
await relayer.sendTransaction(createTx);
```

## <a name="direct-transfer">Direct Transfer</a>

Signs a ERC20 token transfer out of the account. To be used on newly created 1/1 safes (before setup). The populated transaction is already prepared for relay and does not need any additional signing.

```js
import { populateDirectTransfer } from "@gnosispay/account-kit";

const owner : Signer = {};
const nonce = `<number>`; // See Account Setup section, nonce comment

const transaction = await populateDirectTransfer(
  { safe: `0x<address>`, chainId: `<number>`, nonce: nonce },
  { token: `0x<address>`, to: `0x<address>`, amount: `<bigint>` },
  // callback that wraps an eip-712 signature by owner
  ({ domain, primaryType, types, message }) => owner.signTypedData(...)
);

await relayer.sendTransaction(transaction);
```

## <a name="account-setup">Account Setup</a>

Upgrades a 1/1 safe to a Gnosis Pay account. The populated transaction is already prepared for relay and does not need any additional signing.

```js
import {
  createSetupConfig, populateAccountSetup,
} from "@gnosispay/account-kit";

const owner: Signer = {}; // the account owner
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

This function generates a payload that encapsulates a given transaction and submits it to the Delay Mod's queue. Once the cooldown period has elapsed, the transaction can be executed. The populated transactions are already prepared for relay and do not need any additional signing.

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

This function generates a payload to initiate an allowance change in the Delay Mod's queue. Once the cooldown period has elapsed, the allowance change can be executed. The user maintains unilateral control over the Allowance configuration. The populated transactions are already prepared for relay and do not need any additional signing.

```js
import {
  populateLimitEnqueue,
  populateLimitDispatch,
} from "@gnosispay/account-kit";

const owner : Signer = {}; // the account owner
const allowanceConfig : AllowanceConfig = {
  // Duration, in seconds, before a refill occurs
  period: `<number>`,
  /// Amount added to balance after each period elapses.
  refill: `<bigint>`,
};

const enqueueTx = await populateLimitEnqueue(
  { account: `0x<address>`, chainId: `<number>` },
  allowanceConfig,
  // callback that wraps an eip-712 signature !!owner signs!!
  ({ domain, primaryType, types, message }) => owner.signTypedData(...)
);
await relayer.sendTransaction(enqueueTx);

// ⏳ wait cooldown seconds ⏳

const dispatchTx = populateLimitDispatch(account, allowanceConfig);
await relayer.sendTransaction(dispatchTx);
```

## <a name="spend">Spend</a>

This function generates the spend payload to be submitted to the Roles Mod. The spender has permissionless access as long as they stay within the configured Allowance limits. The populated transaction is already prepared for relay and does not need any additional signing.

```js
import { populateSpend } from "@gnosispay/account-kit";

const spender : Signer = {}; // system wide config, the gnosis signer
const transfer : Transfer= {
  token: `0x<address>`,
  to: `0x<address>`,
  amount: `<bigint>`,
};

const spendTx = await populateSpend(
  { account: `0x<address>`, chainId: `<number>` },
  transfer,
  // callback that wraps an eip-712 signature !!spender signs!!
  ({ domain, primaryType, types, message }) => spender.signTypedData(...)
);
await relayer.sendTransaction(spendTx);
```

## <a name="account-query">Account Query</a>

Creates a multicall payload that collects all data required to assess if a given GnosisPay account passes integrity requirements. Calculates and returns the accrued allowance balance

```js
import { accountQuery } from "@gnosispay/account-kit";

const {
  status,
  allowance: { balance, refill, period, maxRefill, nextRefill },
} = await accountQuery(
  { account: `0x<address>`, cooldown: `<number>` },
  // a function that receives that and performs eth_call, library agnostic
  ({ to, data }) => provider.send("eth_call", [{ to, data }])
);
```

## <a name="contributors">Contributors</a>

- Cristóvão Honorato ([cristovaoth](https://github.com/cristovaoth))
