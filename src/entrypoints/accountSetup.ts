import { AbiCoder, ZeroAddress, getAddress } from "ethers";

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
  SafeTransactionData,
  SetupConfig,
  SignTypedData,
  TransactionData,
} from "../types";
import {
  RolesExecutionOptions,
  RolesOperator,
  RolesParameterType,
} from "../parts/roles";

const AddressTwo = "0x0000000000000000000000000000000000000002";

export default async function populateAccountSetup(
  {
    account,
    owner,
    chainId,
    nonce,
  }: { account: string; owner: string; chainId: number; nonce: number },
  config: SetupConfig,
  sign: SignTypedData
): Promise<TransactionData> {
  account = getAddress(account);
  owner = getAddress(owner);

  const { iface } = deployments.safeMastercopy;

  const { to, data, value, operation } = populateInitMultisend(
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

function populateInitMultisend(
  { account, owner }: { account: string; owner: string },
  {
    spender,
    receiver,
    token,
    allowance: { refill, period, timestamp },
    delay: { cooldown, expiration },
  }: SetupConfig
): SafeTransactionData {
  const abi = AbiCoder.defaultAbiCoder();

  const { iface } = deployments.safeMastercopy;

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
      data: iface.encodeFunctionData("swapOwner", [
        SENTINEL,
        owner,
        AddressTwo,
      ]),
    },
    // enable roles as module on safe
    {
      to: account,
      data: iface.encodeFunctionData("enableModule", [roles.address]),
    },
    // enable delay as module on safe
    {
      to: account,
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
      data: delay.iface.encodeFunctionData("setTxCooldown", [cooldown]),
    },
    // configure expiration on delay
    {
      to: delay.address,
      data: delay.iface.encodeFunctionData("setTxExpiration", [expiration]),
    },
    // enable owner on the delay as module
    {
      to: delay.address,
      data: delay.iface.encodeFunctionData("enableModule", [owner]),
    },
    /**
     * DEPLOY AND CONFIG ROLES MODIFIER
     */
    populateRolesCreation(account),
    {
      to: roles.address,
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
      data: roles.iface.encodeFunctionData("assignRoles", [
        spender,
        [SPENDING_ROLE_KEY],
        [true],
      ]),
    },
    {
      to: roles.address,
      data: roles.iface.encodeFunctionData("scopeTarget", [
        SPENDING_ROLE_KEY,
        token,
      ]),
    },
    {
      to: roles.address,
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
      data: roles.iface.encodeFunctionData("transferOwnership", [
        bouncerAddress,
      ]),
    },
    // Deploy Misc
    populateBouncerCreation(account),
  ]);
}
