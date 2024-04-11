import { HexString } from "ethers/lib.commonjs/utils/data";
import deployments from "../../deployments";
import { predictDelayModAddress } from "../../parts";

export const SENTINEL_ADDRESS = "0x0000000000000000000000000000000000000001";

type EthCallCallback = (
  encodedFunctionCall: `0x${string}`
) => Promise<{ data: HexString | undefined }>;

export async function getAccountOwners(
  doEthCall: EthCallCallback,
  from: `0x${string}` = SENTINEL_ADDRESS
): Promise<`0x${string}`[]> {
  const FETCH_COUNT = 100;

  const delayMod = {
    iface: deployments.delayModMastercopy.iface,
  };

  const calldata = delayMod.iface.encodeFunctionData("getModulesPaginated", [
    from,
    FETCH_COUNT,
  ]) as `0x${string}`;

  const ethResult = await doEthCall(calldata);

  if (!ethResult.data) {
    throw new Error("No data returned from eth call");
  }

  const [addresses] = delayMod.iface.decodeFunctionResult(
    "getModulesPaginated",
    ethResult.data
  );

  return [
    ...addresses,
    ...(addresses.length < FETCH_COUNT
      ? []
      : await getAccountOwners(doEthCall, addresses[addresses.length - 1])),
  ];
}

export function removeAccountOwner(
  account: string,
  {
    previousLastAccountOwner,
    accountToRemove,
  }: {
    previousLastAccountOwner: string;
    accountToRemove: string;
  }
) {
  const delayMod = {
    address: predictDelayModAddress(account),
    iface: deployments.delayModMastercopy.iface,
  };

  return delayMod.iface.encodeFunctionData("disableModule", [
    previousLastAccountOwner,
    accountToRemove,
  ]);
}
