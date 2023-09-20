# Account Kit

Software development kit that facilitates the interaction with on-chain Gnosis Pay accounts.

For each relevant account action, this SDK provides a function that generates transaction payloads. These payloads are ready to be transmitted, and require no further signing

## Table of contents

- [Account Creation](#account-creation)
- [Account Setup](#account-setup)
- [Token Transfer](#token-transfer)
- [Allowance Transfer](#allowance-transfer)
- [Allowance Reconfig](#allowance-reconfig)
- [Account Query](#account-query)
- [Contributors](#contributors)

## <a name="account-creation">Account Creation</a>

Creates a new 1/1 safe.

```js
import { populateAccountCreation } from "@gnosispay/account-kit";

const eoa = `0x<address>`; // the owner address
await provider.sendTransaction(populateAccountCreation(eoa));
```

## <a name="account-setup">Account Setup</a>

Upgrades a 1/1 safe to a Gnosis Pay account. The resulting transaction is relay ready.

```js
import { populateAccountSetup } from "@gnosispay/account-kit";

const eoa : Signer = {}; // the account owner
const safe = `0x<address>`;
const chainId = `<number>`;
const nonce = `<number>`; // current safe nonce

const config : AccountConfig = {
  // the gnosis signer
  spender: `0x<address>`,
   // the settlement safe
  receiver: `0x<address>`,
  // token used for payments
  token: `0x<address>`,
  // the allowance amount granted to spender
  allowance: `<bigint>`,
   // allowance refill period in seconds
  period: `<number>`,
  // delay, in seconds, before eoa can rug
  cooldown: `<number>`,
};

const transaction = await populateAccountSetup(
  { eoa, safe, chainId, nonce },
  config,
  (domain, types, message) => eoa.signTypedData(domain, types, message) // eip712 sig
);

await provider.sendTransaction(transaction);
```

## <a name="token-transfer">Token Transfer</a>

Signs a ERC20 token transfer from account. To be used on freshly created accounts (before setup). The resulting transaction is relay ready.

```js
import { populateTokenTransfer } from "@gnosispay/account-kit";

const eoa : Signer = {}; // the account owner
const safe = `0x<address>`;
const chainId = `<number>`;
const nonce = `<number>`; // current safe nonce

const token = `0x<address>`;
const to = `0x<address>`;
const amount = `<bigint>`;

const transaction = await populateAccountSetup(
  { safe, chainId, nonce },
  { token, to, amount },
  (domain, types, message) => owner.signTypedData(domain, types, message) // eip712 sig
);

await provider.sendTransaction(transaction);
```

## <a name="allowance-transfer">Allowance Transfer</a>

Generates an ERC20 token transfer via the RolesMod's AllowanceSpend Role. The generated transaction is unsigned, and can only be sent by the spender, which is the only account configured on that role.

```js
import { populateAllowanceTransfer } from "@gnosispay/account-kit";

const spender: Signer = {};
const safe = `0x<address>`;

const token = `0x<address>`;
const to = `0x<address>`;
const amount = "<number>";

const transaction = populateAllowanceTransfer(
  { safe },
  {
    token,
    to,
    amount,
  }
);

await spender.sendTransaction(transaction);
```

## <a name="allowance-reconfig">Allowance Reconfig</a>

Generates an adjustment to the RolesMod's available allowance. The generated transaction is unsigned, and can only be sent by the EOA, which is the only account configured to have access to the setAllowance function.

```js
import { populateAllowanceReconfig } from "@gnosispay/account-kit";

const eoa : Signer = {};
const safe = `0x<address>`;

const config: AllowanceConfig = {
  // Duration, in seconds, before a refill occurs
  period: `<number>`,
  /// Amount added to balance after each period elapses.
  refill: `<bigint>`,
  // [OPTIONAL] Initial allowance available for use.
  balance: `<bigint> | undefined`,
  // [OPTIONAL] Timestamp when the last refill occurred.
  timestamp: `<bigint> | undefined`,
};

const transaction = populateAllowanceReconfig(
  { eoa: eoa.address, safe },
  config
);

await spender.sendTransaction(transaction);
```

## <a name="account-query">Account Query</a>

Creates a multicall payload that collects all data required to assess if a given GnosisPay account passes integrity requirements.

```js
import {
  populateAccountQuery,
  evaluateAccountQuery,
} from "@gnosispay/account-kit";

const eoa = `0x<address>`;
const safe = `0x<address>`;
const spender = `0x<address>`;
const token = `0x<address>`;
const cooldown = `<number>`;

const { to, data } = populateAccountQuery({ safe }, { spender, token });
const functionResult = await provider.send("eth_call", [{ to, data }]);
const result = evaluateAccountQuery(
  { eoa, safe },
  { spender, cooldown },
  functionResult
);

/*
 * Returns
 *  {
 *    status: AccountIntegrityStatus
 *    allowance: bigint
 *  }
 *
 */
```

## <a name="contributors">Contributors</a>

- Cristóvão Honorato ([cristovaoth](https://github.com/cristovaoth))
