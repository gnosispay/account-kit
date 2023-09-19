import { AbiCoder, ZeroAddress, ZeroHash } from "ethers";
import { getSingletonFactoryInfo } from "@safe-global/safe-singleton-factory";

import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";
import multisendEncode from "../multisend";

import {
  ALLOWANCE_KEY,
  SPENDING_ROLE_KEY,
  encodeDelaySetUp,
  encodeRolesSetUp,
  predictDelayAddress,
  predictRolesAddress,
} from "./predictModuleAddress";

import {
  forwarderBytecode,
  predictForwarderAddress,
} from "./predictSingletonAddress";

import {
  AccountConfig,
  SafeTransactionData,
  ExecutionConfig,
  TransactionData,
  RolesParameterType,
  RolesOperator,
  RolesExecutionOptions,
} from "../types";

import { IERC20__factory } from "../../typechain-types";

export default async function populateAccountSetup(
  { account, chainId, nonce }: ExecutionConfig,
  config: AccountConfig,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const safe = {
    address: account,
    iface: deployments.safeMastercopy.iface,
  };

  const { to, data, value, operation } = populateSafeTransaction(
    safe.address,
    config
  );

  const { domain, types, message } = typedDataForSafeTransaction(
    safe.address,
    chainId,
    nonce,
    { to, data, value, operation }
  );

  const signature = await sign(domain, types, message);

  return {
    to: safe.address,
    data: safe.iface.encodeFunctionData("execTransaction", [
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

function populateSafeTransaction(
  account: string,
  { owner, spender, receiver, token, amount, period, cooldown }: AccountConfig
): SafeTransactionData {
  const abi = AbiCoder.defaultAbiCoder();

  const singletonFactory = {
    address: getSingletonFactoryInfo(1)?.address as string, // 1 or 100 same
  };
  const { moduleProxyFactory } = deployments;

  const safe = {
    address: account,
    iface: deployments.safeMastercopy.iface,
  };
  const delay = {
    address: predictDelayAddress(safe.address),
    iface: deployments.delayMastercopy.iface,
  };
  const roles = {
    address: predictRolesAddress(safe.address),
    iface: deployments.rolesMastercopy.iface,
  };
  const allowanceAdmin = {
    address: predictForwarderAddress({ owner, safe: account }),
  };

  return multisendEncode([
    /**
     * CONFIG SAFE
     */
    // add the gnosis signer, and set threshold to 2
    {
      to: safe.address,
      data: safe.iface.encodeFunctionData("addOwnerWithThreshold", [
        spender,
        2,
      ]),
    },
    // enable roles as module on safe
    {
      to: safe.address,
      data: safe.iface.encodeFunctionData("enableModule", [roles.address]),
    },
    // enable delay as module on safe
    {
      to: safe.address,
      data: safe.iface.encodeFunctionData("enableModule", [delay.address]),
    },
    /**
     * DEPLOY AND CONFIG DELAY MODULE
     */
    {
      to: moduleProxyFactory.address,
      data: moduleProxyFactory.iface.encodeFunctionData("deployModule", [
        deployments.delayMastercopy.address,
        encodeDelaySetUp(safe.address),
        ZeroHash,
      ]),
    },
    // configure cooldown on delay
    {
      to: delay.address,
      data: delay.iface.encodeFunctionData("setTxCooldown", [cooldown]),
    },
    // enable owner on the delay as module
    {
      to: delay.address,
      data: delay.iface.encodeFunctionData("enableModule", [owner]),
    },
    /**
     * DEPLOY AND CONFIG ROLES MODIFIER
     */
    {
      to: moduleProxyFactory.address,
      data: moduleProxyFactory.iface.encodeFunctionData("deployModule", [
        deployments.rolesMastercopy.address,
        encodeRolesSetUp(safe.address),
        ZeroHash,
      ]),
    },
    {
      to: roles.address,
      data: roles.iface.encodeFunctionData("setAllowance", [
        ALLOWANCE_KEY,
        amount, // balance
        amount, // maxBalance
        amount, // refill
        period,
        0,
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
            compValue: ALLOWANCE_KEY,
          },
        ],
        RolesExecutionOptions.None,
      ]),
    },
    {
      to: roles.address,
      data: roles.iface.encodeFunctionData("transferOwnership", [
        allowanceAdmin.address,
      ]),
    },
    /**
     * DEPLOY FORWARDER
     */
    {
      to: singletonFactory.address,
      data: `${ZeroHash}${forwarderBytecode({ owner, safe: account }).slice(
        2
      )}`,
    },
  ]);
}
