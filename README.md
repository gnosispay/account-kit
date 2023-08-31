# Account Kit

Software development kit that facilitates the interaction with on-chain Gnosis Pay accounts

## Table of contents

- [Account Creation](#account-creation)
- [Account Setup](#account-setup)
- [Token Transfer](#token-transfer)
- [Allowance Token Transfer](#allowance-token-transfer)
- [Account Integrity](#account-integrity)
- [API Reference](#api-reference)
- [Contributors](#contributors)

## <a name="account-creation">Account Creation</a>

Creates a new 1/1 safe with `ownerAddress` as owner.

```js
import { populateAccountCreationTransanction } from "@gnosispay/account-kit";

const ownerAddress = `0x<address>`;
const transaction = populateAccountCreationTransaction(ownerAddress);
await provider.sendTransaction(transaction);
```

## <a name="account-setup">Account Setup</a>

Upgrades a newly created 1/1 safe to a Gnosis Pay account.

```js
import {
  predictSafeAddress,
  populateAccountSetupTransaction,
} from "@gnosispay/account-kit";


const owner: Signer = {};
const safe = predictSafeAddress(owner.address);
const chainId = `<network-id>`
const nonce = `<safe-nonce-number>`

const config : AccountConfig = {
  //** allowance mod **/
  spender: `0x<address>`
  token: `0x<address>`;
  amount: '<value allowed by spender>';
  period: '<replenish period in minutes>';
  //** delay mod **/
  cooldown: '<execution delay for owner in seconds>'
};

/*
 * get the encoded safe transaction, including the signature.
 * Can be submitted for execution by any account #AA
 */
const transaction = populateAccountSetup(
  { safe, chainId, nonce },
  config,
  (domain, types, message) => owner.signTypedData(domain, types, message) // any eip712 works
);

await provider.sendTransaction(transaction);
```

## <a name="token-transfer">Token Transfer</a>

Signs a ERC20 token transfer to be executed from the safe. To be used after the account is created, but before full setup

```js
import { populateTokenTransfer } from "@gnosispay/account-kit";

const owner: Signer = {};
const safe =  `0x<address>`;
const chainId = `<network-id>`
const nonce = 0

const token = `0x<address>`
const to = `0x<address>`
const amount = '<number>'

const transaction = await populateAccountSetup(
  { safe, chainId, nonce },
  { token, to, amount },
  (domain, types, message) => owner.signTypedData(domain, types, message) // any eip712 works
);

await provider.sendTransaction(transaction);
```

## <a name="allowance-token-transfer">Allowance Token Transfer</a>

Signs a ERC20 token transfer to be executed via AllowanceMod. The signer must be the spender, for which an allowance was setup

```js
import { populateTokenTransfer } from "@gnosispay/account-kit";

const spender: Signer = {};
const safe =  `0x<address>`;
const chainId = `<network-id>`
const nonce = `<current-allowance-nonce>`

const token = `0x<address>`
const to = `0x<address>`
const amount = '<number>'

const transaction = await populateAccountSetup(
  { safe, chainId, nonce },
  { spender: spender.address, token, to, amount },
  // a bug in the current allowance mod, requires us to use eip-191
  // (domain, types, message) => spender.signTypedData(domain, types, message) // after bug fixed
  (message) => spender.signMessage(message) // after bug fixed
);

await provider.sendTransaction(transaction);
```

## <a name="account-integrity">Account Integrity</a>

Creates a multicall encoded payload that collects all data required to assess if the account is in integrity. The payload is to be sent via eth_call, and then later evaluated.

```js
import {
  populateAccountIntegrityQuery,
  evaluateAccountIntegrityResult,
} from "@gnosispay/account-kit";


const owner: Signer = {};
const safe =  `0x<address>`;
const chainId = `<network-id>`
const nonce = `<safe-nonce-number>`

const config : AccountConfig = {
  //** allowance mod **/
  spender: `0x<address>`
  token: `0x<address>`;
  amount: '<value allowed by spender>';
  period: '<replenish period in minutes>';
  //** delay mod **/
  cooldown: '<execution delay for owner in seconds>'
};

const functionData = populateAccountIntegrityQuery(safe, config);

const functionResult = await provider.send("eth_call", functionData);

const result = evaluateAccountIntegrityResult(
  functionResult, safe, config
);

// result.status -> the account status
// result.allowance.amount -> unspent allowance
// result.allowance.nonce -> current allowance nonce
```

## <a name="api-reference">API Reference</a>

TODO

## <a name="contributors">Contributors</a>

- Cristóvão Honorato ([cristovaoth](https://github.com/cristovaoth))
