import { AbiCoder, ZeroAddress, getAddress, parseUnits } from "ethers";

import { IERC20__factory } from "../../typechain-types";
import {
  SENTINEL,
  SPENDING_ALLOWANCE_KEY,
  SPENDING_ROLE_KEY,
} from "../constants";

import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";
import multisendEncode from "../multisend";
import {
  populateBouncerCreation,
  populateDelayCreation,
  populateRolesCreation,
  predictBouncerAddress,
  predictDelayAddress,
  predictRolesAddress,
} from "../parts";

import {
  RolesExecutionOptions,
  RolesOperator,
  RolesParameterType,
} from "../parts/roles";
import {
  SafeTransactionRequest,
  SetupConfig,
  SignTypedDataCallback,
  TransactionRequest,
} from "../types";

const AddressTwo = "0x0000000000000000000000000000000000000002";

type AccountSetupParameters = {
  /**
   * The address of the account
   */
  account: string;
  /**
   * The address of the owner
   */
  owner: string;
  /*
   * ID associated with the current network.
   */
  chainId: number;
  /*
   * The current nonce value of the safe that is to be setup
   */
  nonce: number;
};

/**
 * Upgrades a 1/1 safe to a Gnosis Pay account. The populated transaction is
 * relay ready, and does not require additional signing.
 *
 * @param parameters - {@link AccountSetupParameters}
 * @param config - {@link SetupConfig}
 * @param sign - {@link SignTypedDataCallback}
 * @returns The signed transaction payload {@link TransactionRequest}
 *
 * @example
 * import { populateAccountSetup } from "@gnosispay/account-kit";
 *
 * const owner: Signer = {...}
 * const config = {
 *   spender: "0x<address>",
 *   receiver: "0x<address>",
 *   token: "0x<address>",
 *   allowance: {
 *     refill: parseEther("1000"),
 *     period: 60 * 60 * 24, // duration in seconds
 *     timestamp?: 12726372637 // optional, useful to align timezones
 *   },
 *   delay: {
 *     cooldown: 60 * 3, // 3 minutes in in seconds
 *     expiration: 60 * 60 * 24 * 7 // a week in seconds
 *   }
 * }
 * const transaction = await populateAccountSetup(
 *   { account, owner: owner.address, chainId, nonce },
 *   config,
 *   ({ domain, primaryType, types, message }) =>
 *   owner.signTypedData(domain, primaryType, types, message)
 * );
 * await relayer.sendTransaction(transaction);
 */
export default async function populateAccountSetup(
  { account, owner, chainId, nonce }: AccountSetupParameters,
  config: SetupConfig,
  sign: SignTypedDataCallback
): Promise<TransactionRequest> {
  account = getAddress(account);
  owner = getAddress(owner);

  const { iface } = deployments.safeMastercopy;

  const { to, data, value, operation } = populateSetupTransaction(
    { account, owner },
    config
  );

  const { domain, primaryType, types, message } = typedDataForSafeTransaction(
    { safe: account, chainId, nonce },
    { to, data, value, operation }
  );

  const signature = await sign({ domain, primaryType, types, message });

  return {
    to: account,
    value: 0,
    data: iface.encodeFunctionData("execTransaction", [
      to,
      value,
      data,
      operation,
      0, // safeTxGas
      0, // baseGas
      0, // gasPrice
      ZeroAddress, // gasToken
      ZeroAddress, // gasRefund
      signature,
    ]),
  };
}

// TODO: not yet the final value
const TEMPORARY_SPENDER = getAddress(
  "0xb32fd82d584a8d40ebe8e11dbfe6d6dfbeed344a"
);

// TODO: not yet the final valueSo yo
const TEMPORARY_RECEIVER = getAddress(
  "0xca24637dd035a086DA120EE5c07C085eAA1fa37e"
);

/**
 * Creates a config object for account setup. Defaults config values filled in
 */
export function createSetupConfig({
  token,
  chainId,
}: {
  token: string;
  chainId: number;
}): SetupConfig {
  if (
    chainId == 100 &&
    getAddress(token) ==
      getAddress("0xcb444e90d8198415266c6a2724b7900fb12fc56e")
  ) {
    return {
      spender: TEMPORARY_SPENDER,
      receiver: TEMPORARY_RECEIVER,
      token,
      allowance: {
        period: 60 * 60 * 24, // one day in seconds
        refill: parseUnits("1000", 18), // 1000 dollars in 18 decimals (EURe decimals)
      },
      delay: {
        cooldown: 60 * 3, // three minutes in seconds
        expiration: 60 * 60 * 24 * 7, // one week in seconds
      },
    };
  }

  throw new Error(`Unsupported tokend and chainId combination`);
}

function populateSetupTransaction(
  { account, owner }: { account: string; owner: string },
  {
    spender,
    receiver,
    token,
    allowance: { refill, period, timestamp },
    delay: { cooldown, expiration },
  }: SetupConfig
): SafeTransactionRequest {
  const abi = AbiCoder.defaultAbiCoder();
  const { iface } = deployments.safeMastercopy;

  spender = getAddress(spender);
  receiver = getAddress(receiver);
  token = getAddress(token);

  const delay = {
    address: predictDelayAddress(account),
    iface: deployments.delayMastercopy.iface,
  };
  const roles = {
    address: predictRolesAddress(account),
    iface: deployments.rolesMastercopy.iface,
  };

  const bouncerAddress = predictBouncerAddress(account);

  return multisendEncode([
    /**
     * CONFIG SAFE
     */
    // renounce ownership
    {
      to: account,
      value: 0,
      data: iface.encodeFunctionData("swapOwner", [
        SENTINEL,
        owner,
        AddressTwo,
      ]),
    },
    // enable roles as module on safe
    {
      to: account,
      value: 0,
      data: iface.encodeFunctionData("enableModule", [roles.address]),
    },
    // enable delay as module on safe
    {
      to: account,
      value: 0,
      data: iface.encodeFunctionData("enableModule", [delay.address]),
    },
    /**
     * DEPLOY AND CONFIG DELAY MODULE
     * note we deploy delay with 0, 0 as to be as stable as possible
     * with deployment address prediction. set afeter
     */
    populateDelayCreation(account),
    // configure cooldown on delay
    {
      to: delay.address,
      value: 0,
      data: delay.iface.encodeFunctionData("setTxCooldown", [cooldown]),
    },
    // configure expiration on delay
    {
      to: delay.address,
      value: 0,
      data: delay.iface.encodeFunctionData("setTxExpiration", [expiration]),
    },
    // enable owner on the delay as module
    {
      to: delay.address,
      value: 0,
      data: delay.iface.encodeFunctionData("enableModule", [owner]),
    },
    /**
     * DEPLOY AND CONFIG ROLES MODIFIER
     */
    populateRolesCreation(account),
    {
      to: roles.address,
      value: 0,
      data: roles.iface.encodeFunctionData("setAllowance", [
        SPENDING_ALLOWANCE_KEY,
        // balance
        refill,
        // maxBalance
        refill,
        // refill
        refill,
        // period,
        period,
        // timestamp
        timestamp || 0,
      ]),
    },
    {
      to: roles.address,
      value: 0,
      data: roles.iface.encodeFunctionData("assignRoles", [
        spender,
        [SPENDING_ROLE_KEY],
        [true],
      ]),
    },
    {
      to: roles.address,
      value: 0,
      data: roles.iface.encodeFunctionData("scopeTarget", [
        SPENDING_ROLE_KEY,
        token,
      ]),
    },
    {
      to: roles.address,
      value: 0,
      data: roles.iface.encodeFunctionData("scopeFunction", [
        SPENDING_ROLE_KEY,
        token,
        IERC20__factory.createInterface().getFunction("transfer").selector,
        [
          {
            parent: 0,
            paramType: RolesParameterType.Calldata,
            operator: RolesOperator.Matches,
            compValue: "0x",
          },
          {
            parent: 0,
            paramType: RolesParameterType.Static,
            operator: RolesOperator.EqualTo,
            compValue: abi.encode(["address"], [receiver]),
          },
          {
            parent: 0,
            paramType: RolesParameterType.Static,
            operator: RolesOperator.WithinAllowance,
            compValue: SPENDING_ALLOWANCE_KEY,
          },
        ],
        RolesExecutionOptions.None,
      ]),
    },
    {
      to: roles.address,
      value: 0,
      data: roles.iface.encodeFunctionData("transferOwnership", [
        bouncerAddress,
      ]),
    },
    // Deploy Misc
    populateBouncerCreation(account),
  ]);
}
