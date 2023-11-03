# Account Kit

Software development kit that facilitates the interaction with onchain Gnosis Pay accounts.

For each relevant account action, this SDK provides a function that populates transaction payloads. The generated payloads are relay ready, and require no further signing

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

const owner = `<address>`; // the owner of the account
await provider.sendTransaction(populateAccountCreation(owner));
```

## <a name="direct-transfer">Direct Transfer</a>

Signs a ERC20 token transfer out of the account. To be used on newly created 1/1 safes (before setup). The populated transaction is relay ready and requires no further signing.

```js
import { populateDirectTransfer } from "@gnosispay/account-kit";

const owner : Signer = {}; // the account owner
const account = `<address>`; // the main safe address
const chainId = `<number>`;
const nonce = `<number>`; // the account's onchain nonce value

const token = `<address>`; // contract address of the token being transferred
const to = `<address>`;
const amount = `<bigint>`;

const transaction = await populateDirectTransfer(
  { safe, chainId, nonce },
  { token, to, amount },
  // callback that wraps an eip-712 signature by owner
  ({ domain, primaryType, types, message }) => owner.signTypedData(...)
);

await relayer.sendTransaction(transaction);
```

## <a name="account-setup">Account Setup</a>

Upgrades a 1/1 safe to a Gnosis Pay account. The populated transaction is relay ready and requires no further signing.

```js
import { populateAccountSetup } from "@gnosispay/account-kit";

const owner: Signer = {}; // the account owner
const account = `<address>`; // the main safe address
const chainId = `<number>`;
const nonce = `<number>`; // the account's onchain nonce value

const config: SetupConfig = {
  // the gnosis signer
  spender: `<address>`,
  // the settlement safe
  receiver: `<address>`,
  // token used for payments
  token: `<address>`,
  // allowance settings
  allowance: {
    refill: `<bigint>`, // amount refilled per period
    period: `<number>`, // duration in seconds
  },
  // delay mod  settings
  delay: {
    cooldown: `<number>`, // in seconds
    expiration: `<number>`, // in seconds
  },
};

const transaction = await populateAccountSetup(
  { account, owner: owner.address, chainId, nonce },
  config,
  // callback that wraps an eip-712 signature !!owner signs!!
  ({ domain, primaryType, types, message }) => owner.signTypedData(...)
);

await provider.sendTransaction(transaction);
```

## <a name="execute">Execute</a>

Generates a payload that posts the provided transaction to the Delay Mod's queue. After cooldown the transaction can be dispatched for execution. This flow allows the owner to execute any arbitrary transactions on a cooldown. The generated transactions are relay ready.

```js
import {
  populateExecuteEnqueue,
  populateExecuteDispatch,
} from "@gnosispay/account-kit";

const account = `<address>`;
const chainId = `<number>`;
const owner : Signer = {};

const innerTransaction = { to: `<address>`, data: `0x<bytes>` };

const enqueueTx = await populateExecuteEnqueue(
  { account, chainId },
  innerTransaction,
  // callback that wraps an eip-712 signature !!owner signs!!
  ({ domain, primaryType, types, message }) => owner.signTypedData(...)
);
await relayer.sendTransaction(enqueueTx);

// ⏳ wait cooldown seconds ⏳

const dispatchTx = populateExecuteDispatch(account, innerTransaction);
await relayer.sendTransaction(dispatchTx);
```

## <a name="limit">Limit</a>

Generates a payload that posts the provided allowance change to the Delay Mod's queue. After cooldown the allowance change can be dispatched for execution. User has unilateral access and control to Allowance config. The populated transactions are relay ready.

```js
import {
  populateLimitEnqueue,
  populateLimitDispatch,
} from "@gnosispay/account-kit";

const account = `<address>`; // the main safe address
const chainId = `<number>`;
const owner : Signer = {}; // the account owner

const allowanceConfig : AllowanceConfig = {
  // Duration, in seconds, before a refill occurs
  period: `<number>`,
  /// Amount added to balance after each period elapses.
  refill: `<bigint>`,
};

const enqueueTx = await populateLimitEnqueue(
  { account, chainId },
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

Generates the spend payload to be submitted to the Roles Mod. Spender has permissionless access when staying within configured Allowance limits. The resulting transactions are relay ready.

```js
import { populateSpend } from "@gnosispay/account-kit";


const account = `<address>`; // the main safe address
const chainId = `<number>`;
const spender : Signer = {}; // system wide config, the gnosis signer

const transfer : Transfer= {
  token: `<address>`,
  to: `<address>`,
  amount: `<bigint>`,
};

const spendTx = await populateSpend(
  { account, chainId },
  transfer,
  // callback that wraps an eip-712 signature !!spender signs!!
  ({ domain, primaryType, types, message }) => spender.signTypedData(...)
);
await relayer.sendTransaction(spendTx);
```

## <a name="account-query">Account Query</a>

Creates a multicall payload that collects all data required to assess if a given GnosisPay account passes integrity requirements. It also queries and computes useful account information like accrued allowance and relevant nonces.

```js
import { accountQuery } from "@gnosispay/account-kit";

const account = `<address>`;
const cooldown = `<number>`; // system wide config, cooldown time in seconds

const {
  status,
  allowance: { balance, refill, period, maxRefill, nextRefill },
} = await accountQuery(
  { account, cooldown },
  // a function that receives that and performs eth_call, library agnostic
  ({ to, data }) => provider.send("eth_call", [{ to, data }])
);
```

## <a name="contributors">Contributors</a>

- Cristóvão Honorato ([cristovaoth](https://github.com/cristovaoth))
