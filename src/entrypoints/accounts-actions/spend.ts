import { concat, getAddress } from "ethers";

import { saltFromTimestamp } from "./execute";
import { SPENDING_ROLE_KEY } from "../../constants";
import deployments from "../../deployments";
import typedDataForModifierTransaction from "../../eip712";
import { predictRolesModAddress, predictSpenderModAddress } from "../../parts";

import {
  TransactionRequest,
  SignTypedDataCallback,
  Transfer,
} from "../../types";

type SpendParameters = {
  /**
   * The address of the account Safe
   */
  account: string;
  /**
   * The address of the spender Safe
   */
  spender: string;
  /*
   * ID associated with the current network.
   */
  chainId: number;
  /*
   * An optional bytes32 string that will be used for signature replay protection
   * (Should be omitted, and in that case, a random salt will be generated)
   */
  salt?: string;
};

export default async function populateSpend(
  { account, spender, chainId, salt }: SpendParameters,
  transfer: Transfer,
  sign: SignTypedDataCallback
): Promise<TransactionRequest> {
  account = getAddress(account);
  spender = getAddress(spender);
  salt = salt || saltFromTimestamp();

  const rolesMod = {
    address: predictRolesModAddress(account),
    iface: deployments.rolesModMastercopy.iface,
  };

  const spenderMod = {
    address: predictSpenderModAddress(spender),
    iface: deployments.spenderModMastercopy.iface,
  };

  const { to, value, data } = {
    to: spenderMod.address,
    value: 0,
    data: spenderMod.iface.encodeFunctionData("spend", [
      transfer.token,
      rolesMod.address,
      transfer.to,
      transfer.amount,
      SPENDING_ROLE_KEY,
    ]),
  };

  const { domain, primaryType, types, message } =
    typedDataForModifierTransaction(
      { modifier: spenderMod.address, chainId },
      { data, salt }
    );

  const signature = await sign({ domain, primaryType, types, message });

  return { to, value, data: concat([data, salt, signature]) };
}
