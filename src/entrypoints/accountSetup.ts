import { AbiCoder, ZeroAddress } from "ethers";

import { IERC20__factory } from "../../typechain-types";
import { ALLOWANCE_SPENDING_KEY, ROLE_SPENDING_KEY } from "../constants";

import { populateDelayCreation, predictDelayAddress } from "../deployers/delay";
import {
  populateForwarderCreation,
  predictForwarderAddress,
} from "../deployers/forwarder";
import { populateRolesCreation, predictRolesAddress } from "../deployers/roles";
import { populateStubCreation } from "../deployers/stub";
import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";
import multisendEncode from "../multisend";

import {
  AccountConfig,
  SafeTransactionData,
  TransactionData,
  RolesParameterType,
  RolesOperator,
  RolesExecutionOptions,
} from "../types";

export default async function populateAccountSetup(
  {
    eoa,
    safe,
    chainId,
    nonce,
  }: { eoa: string; safe: string; chainId: number; nonce: number },
  config: AccountConfig,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const iface = deployments.safeMastercopy.iface;

  const { to, data, value, operation } = populateSafeTransaction(
    { eoa, safe },
    config
  );

  const { domain, types, message } = typedDataForSafeTransaction(
    safe,
    chainId,
    nonce,
    { to, data, value, operation }
  );

  const signature = await sign(domain, types, message);

  return {
    to: safe,
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

function populateSafeTransaction(
  { eoa, safe: safeAddress }: { eoa: string; safe: string },
  { spender, receiver, token, allowance, period, cooldown }: AccountConfig
): SafeTransactionData {
  const abi = AbiCoder.defaultAbiCoder();

  const safe = {
    address: safeAddress,
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
  const forwarder = {
    address: predictForwarderAddress({ eoa, safe: safe.address }),
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
    populateDelayCreation(safe.address),
    // configure cooldown on delay
    {
      to: delay.address,
      data: delay.iface.encodeFunctionData("setTxCooldown", [cooldown]),
    },
    // enable owner on the delay as module
    {
      to: delay.address,
      data: delay.iface.encodeFunctionData("enableModule", [eoa]),
    },
    /**
     * DEPLOY AND CONFIG ROLES MODIFIER
     */
    populateRolesCreation(safe.address),
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
        spender,
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
        forwarder.address,
      ]),
    },
    /**
     * DEPLOY STUB
     */
    populateStubCreation(eoa),
    /**
     * DEPLOY FORWARDER
     */
    populateForwarderCreation({ eoa, safe: safe.address }),
  ]);
}
