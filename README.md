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
await provider.sendTransaction(populateAccountCreation(eoa));
```

## <a name="direct-transfer">Direct Transfer</a>

Signs a ERC20 token transfer out of the account. To be used on newly created 1/1 safes (before setup). The populated transaction is relay ready and requires no further signing.

```js
import { populateDirectTransfer } from "@gnosispay/account-kit";

const owner: Signer = {}; // the account owner
const account = `<address>`; // the main safe address
const chainId = `<number>`;
const nonce = `<number>`; // current safe nonce, since fresh, expected 0

const token = `<address>`;
const to = `<address>`;
const amount = `<bigint>`;

const transaction = await populateDirectTransfer(
  { safe, chainId, nonce },
  { token, to, amount },
  // callback that wraps an eip-712 sig. Library agnostic
  (...args) => owner.signTypedData(...args) // (domain, types, message)

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
const nonce = `<number>`; // current safe nonce

const config: SetupConfig = {
  // the gnosis signer
  spender: `<address>`,
  // the settlement safe
  receiver: `<address>`,
  // token used for payments
  token: `<address>`,
  // allowance settings
  allowance: {
    refill: `<bigint>`, // amount per period
    period: `<number>`, // in seconds
  },
  // delay mod  settings
  delay: {
    cooldown: `<number>`, // in seconds
    expiration: `<number>`, // in seconds
  },
};

const transaction = await populateAccountSetup(
  { owner: owner.address, account, chainId, nonce },
  config,
  // callback that wraps an eip-712 sig. Library agnostic
  (...args) => owner.signTypedData(...args) // (domain, types, message)
);

await provider.sendTransaction(transaction);
```

## <a name="execute">Execute</a>

Generates a payload that posts the provided transaction to the Delay Mod's queue. After cooldown the transaction can be dispatched for execution. This flow allows the owner to execute any arbitrary transactions on a cooldown. The generated transactions are relay ready.

```js
import {
  populateExecEnqueue,
  populateExecDispatch,
} from "@gnosispay/account-kit";

//  Signer
const owner = {}; // the account owner
const account = `<address>`; // the main safe address
const chainId = `<number>`;
const nonce = `<number>`; // current safe nonce

const someTransaction = { to: `<address>`, data: `0x<bytes>` };

const enqueue = await populateExecEnqueue(
  { owner: owner.address, account, chainId, nonce },
  someTransaction,
  // callback that wraps an eip-712 sig. Library agnostic
  (...args) => owner.signTypedData(...args) // (domain, types, message)
);
await relayer.sendTransaction(enqueue);

// (...) WAIT {COOLDOWN} SECONDS (...)

const dispatch = populateExecDispatch(account, someTransaction);
await relayer.sendTransaction(dispatch);
```

## <a name="limit">Limit</a>

Generates a payload that posts the provided allowance change to the Delay Mod's queue. After cooldown the allowance change can be dispatched for execution. User has unilateral access and control to Allowance config. The populated transactions are relay ready.

```js
import {
  populateLimitEnqueue,
  populateLimitDispatch,
} from "@gnosispay/account-kit";

//
const owner : Signer = {}; // the account owner
const account = `<address>`; // the main safe address
const chainId = `<number>`;
const nonce = `<number>`; // current safe nonce

const config : AllowanceConfig = {
  // Duration, in seconds, before a refill occurs
  period: `<number>`,
  /// Amount added to balance after each period elapses.
  refill: `<bigint>`,
};

const enqueue = await populateLimitEnqueue(
  { owner: owner.address, account, chainId, nonce },
  config,
  // callback that wraps an eip-712 sig. Library agnostic
  (...args) => owner.signTypedData(...args) // (domain, types, message)
);
await relayer.sendTransaction(enqueue);

// (...) WAIT {COOLDOWN} SECONDS (...)

const dispatch = populateLimitDispatch(account, config);
await relayer.sendTransaction(dispatch);
```

## <a name="spend">Spend</a>

Generates the spend payload to be submitted to the Roles Mod. Spender has permissionless access when staying within configured Allowance limits. The resulting transactions are relay ready.

```js
import { populateSpend } from "@gnosispay/account-kit";

const spender : Signer = {}; // the gnosis signer
const account = `<address>`; // the main safe address
const chainId = `<number>`;
const nonce = `<number>`; // current safe nonce

const transfer : Transfer= {
  token: `<address>`,
  to: `<address>`,
  amount: `<bigint>`,
};

const enqueue = await populateSpend(
  { account, spender: spender.address, chainId, nonce },
  transfer,
  // callback that wraps an eip-712 sig. Library agnostic
  (...args) => spender.signTypedData(...args) // (domain, types, message)
);
await relayer.sendTransaction(enqueue);
```

## <a name="account-query">Account Query</a>

Creates a multicall payload that collects all data required to assess if a given GnosisPay account passes integrity requirements. It also queries and computes useful account information like accrued allowance and relevant nonces.

```js
import { accountQuery } from "@gnosispay/account-kit";

const owner = `<address>`;
const account = `<address>`;
const spender = `<address>`;
const cooldown = `<number>`;

const { status, allowance, nonces } = await accountQuery(
  { account, owner, spender, cooldown },
  // a function that receives that and performs eth_call, library agnostic
  ({ to, data }) => provider.send("eth_call", [{ to, data }])
);
/*
 * Returns
 *  {
 *    status: AccountIntegrityStatus
 *    allowance: { balance },
 *    nonces: { account, owner, spender }
 *  }
 *
 */
```

## <a name="contributors">Contributors</a>

- Cristóvão Honorato ([cristovaoth](https://github.com/cristovaoth))
