# Account Kit

Software development kit that facilitates the interaction with on-chain Gnosis Pay accounts.

For each relevant account action, this SDK provides a function that generates relay ready transaction payloads. These payloads are pre-signed and ready for transmission and execution, e.g. in Gelato.

## Table of contents

- [Account Creation](#account-creation)
- [Account Setup](#account-setup)
- [Token Transfer](#token-transfer)
- [Allowance Transfer](#allowance-transfer)
- [Account Query](#account-query)
- [Contributors](#contributors)

## <a name="account-creation">Account Creation</a>

Creates a new 1/1 safe.

```js
import { populateAccountCreation } from "@gnosispay/account-kit";

const ownerAddress = `0x<address>`;
await provider.sendTransaction(
  populateAccountCreationTransaction(ownerAddress)
);
```

## <a name="account-setup">Account Setup</a>

Sets up a fresh 1/1 safe, as a Gnosis Pay account.

```js
import { populateAccountSetup } from "@gnosispay/account-kit";

const owner : Signer = {};
const safe = `0x<address>`;
const chainId = `<number-network-id>`;
const nonce = `<number-safe-nonce>`;

const config : AccountConfig = {
  //** allowance mod **/
  spender: `0x<address>`,
  token: `0x<address>`,
  amount: `<granted to spender>`,
  period: `<replenish period in minutes>`,
  //** delay mod **/
  cooldown: `<execution delay in seconds>`,
};

const transaction = populateAccountSetup(
  { safe, chainId, nonce },
  config,
  (domain, types, message) => owner.signTypedData(domain, types, message) // eip712 sig
);

await provider.sendTransaction(transaction);
```

## <a name="token-transfer">Token Transfer</a>

Signs a ERC20 token transfer of tokens from the account. To be used on freshly created accounts (before setup). The resulting transaction is relay ready.

```js
import { populateTokenTransfer } from "@gnosispay/account-kit";

const owner : Signer = {};
const safe = `0x<address>`;
const chainId = `<network-id>`;
const nonce = 0;

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

Signs an ERC20 token transfer of tokens via AllowanceMod. The signer must be the configured spender, as per Gnosis Pay account setup. The resulting transaction is relay ready.

```js
import { populateTokenTransfer } from "@gnosispay/account-kit";

const spender: Signer = {};
const safe =  `0x<address>`;
const chainId = `<network-id>`
const nonce = `<number-allowance-nonce>`

const token = `0x<address>`
const to = `0x<address>`
const amount = '<number>'

const transaction = await populateAccountSetup(
  { safe, chainId, nonce },
  { spender: spender.address, token, to, amount },
  (message) => spender.signMessage(message) // temporarily using eip-191 for sign
);

await provider.sendTransaction(transaction);
```

## <a name="account-query">Account Query</a>

Creates a multicall payload that collects all data required to assess if a given GnosisPay account is integrous.

```js
import {
  populateAccountQuery,
  evaluateAccountQuery,
} from "@gnosispay/account-kit";

const safe = `0x<address>`;
const spender = `0x<address>`;
const token = `0x<address>`;
const cooldown = `<configured execution delay in seconds>`;

const functionData = populateAccountQuery(safe, { spender, token });

const functionResult = await provider.send("eth_call", functionData);

const result = evaluateAccountQuery(safe, { cooldown }, functionResult);

/*
 * Returns
 *  {
 *    status: AccountIntegrityStatus
 *    allowance: {
 *      unspent: current allowed amount
 *      nonce: allowance mod nonce
 *    }
 *  }
 *
 */
```

## <a name="contributors">Contributors</a>

- Cristóvão Honorato ([cristovaoth](https://github.com/cristovaoth))
