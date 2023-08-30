# Account Kit

Software development kit that facilitates the interaction with on-chain Gnosis Pay accounts

## Table of contents

- [Account Creation](#account-creation)
- [Account Setup](#account-setup)
- [Account Integrity](#account-integrity)
- [API Reference](#api-reference)
- [Contributors](#contributors)

## <a name="account-creation">Account Creation</a>

Creates a new 1/1 safe with `ownerAddress` as owner.

```js
import { populateAccountCreationTransanction } from "@gnosispay/account-kit";

const ownerAddress = "0x...";
const transaction = populateAccountCreationTransaction(ownerAddress);
await provider.sendTransaction(transaction);
```

## <a name="account-setup">Account Setup</a>

Upgrades a newly created 1/1 safe to a Gnosis Pay account.

```js
import {
  predictSafeAddress,
  populateAccountSetupTransaction,
  paramsToSignAccountSetup,
} from "@gnosispay/account-kit";


const owner: Signer = "0x...";
const safeAddress = predictSafeAddress(owner.address);

const config : AccountConfig = {
  //** for allowance mod **/
  spender: `0x<address>`
  token: `0x<address>`;
  amount: '<value allowed by spender>';
  period: '<replenish period in minutes>';
  //** for delay mod **/
  cooldown: '<execution delay for owner in seconds>'
};

// get the parameters to be used in signature function
const { domain, types, message } = paramsToSignAccountSetup(
  safeAddress,
  chainId,
  allowanceConfig,
  delayConfig
);

// get the signature
const signature = await owner._signTypedData(domain, types, message);

/*
 * get the encoded safe transaction, including the signature.
 * Can be submitted for execution by any account #AA
 */
const transaction = populateAccountSetupTransaction(
  safeAddress,
  allowanceConfig,
  delayConfig,
  signature
);

await provider.sendTransaction(transaction);
```

## <a name="account-integrity">Account Integrity</a>

TODO

## <a name="api-reference">API Reference</a>

TODO

## <a name="contributors">Contributors</a>

- Cristóvão Honorato ([cristovaoth](https://github.com/cristovaoth))
