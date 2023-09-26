import { AbiCoder, ZeroAddress } from "ethers";

import { IERC20__factory } from "../../typechain-types";
import {
  ALLOWANCE_SPENDING_KEY,
  ROLE_SPENDING_KEY,
  SENTINEL,
} from "../constants";

import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";
import multisendEncode from "../multisend";
import {
  populateDelayCreation,
  populateForwarderCreation,
  populateOwnerChannelCreation,
  populateRolesCreation,
  populateSpenderChannelCreation,
  predictDelayAddress,
  predictForwarderAddress,
  predictOwnerChannelAddress,
  predictRolesAddress,
  predictSpenderChannelAddress,
} from "../parts";

import {
  AccountConfig,
  RolesExecutionOptions,
  RolesOperator,
  RolesParameterType,
  SafeTransactionData,
  TransactionData,
} from "../types";

const AddressTwo = "0x0000000000000000000000000000000000000002";

export default async function populateAccountSetup(
  {
    account,
    owner,
    chainId,
    nonce,
  }: { account: string; owner: string; chainId: number; nonce: number },
  config: AccountConfig,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const { iface } = deployments.safeMastercopy;

  const { to, data, value, operation } = populateInitMultisend(
    { account, owner },
    config
  );

  const { domain, types, message } = typedDataForSafeTransaction(
    { safe: account, chainId, nonce },
    { to, data, value, operation }
  );

  const signature = await sign(domain, types, message);

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
  { spender, receiver, token, allowance, period, cooldown }: AccountConfig
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

  const forwarderAddress = predictForwarderAddress(account);
  const ownerChannelAddress = predictOwnerChannelAddress({
    eoa: owner,
    safe: account,
  });
  const spenderChannelAddress = predictSpenderChannelAddress({
    spender,
    safe: account,
  });

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
     */
    populateDelayCreation(account),
    // configure cooldown on delay
    {
      to: delay.address,
      data: delay.iface.encodeFunctionData("setTxCooldown", [cooldown]),
    },
    // enable owner on the delay as module
    {
      to: delay.address,
      data: delay.iface.encodeFunctionData("enableModule", [
        ownerChannelAddress,
      ]),
    },
    /**
     * DEPLOY AND CONFIG ROLES MODIFIER
     */
    populateRolesCreation(account),
    {
      to: roles.address,
      data: roles.iface.encodeFunctionData("setAllowance", [
        ALLOWANCE_SPENDING_KEY,
        allowance, // balance
        allowance, // maxBalance
        allowance, // refill
        period,
        0,
      ]),
    },
    {
      to: roles.address,
      data: roles.iface.encodeFunctionData("assignRoles", [
        spenderChannelAddress,
        [ROLE_SPENDING_KEY],
        [true],
      ]),
    },
    {
      to: roles.address,
      data: roles.iface.encodeFunctionData("scopeTarget", [
        ROLE_SPENDING_KEY,
        token,
      ]),
    },
    {
      to: roles.address,
      data: roles.iface.encodeFunctionData("scopeFunction", [
        ROLE_SPENDING_KEY,
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
            compValue: ALLOWANCE_SPENDING_KEY,
          },
        ],
        RolesExecutionOptions.None,
      ]),
    },
    {
      to: roles.address,
      data: roles.iface.encodeFunctionData("transferOwnership", [
        forwarderAddress,
      ]),
    },
    // Deploy Misc
    populateForwarderCreation(account),
    populateOwnerChannelCreation({ eoa: owner, safe: account }),
    populateSpenderChannelCreation({ spender, safe: account }),
  ]);
}
