import { HexString } from "ethers/lib.commonjs/utils/data";
import deployments from "../../deployments";

const SENTINEL_ADDRESS = "0x0000000000000000000000000000000000000001";
const NUMBER_OF_SIGNERS_TO_FETCH = 100;

const delayMod = deployments.delayModMastercopy;

export function addAccountOwner(account: string) {
  return delayMod.iface.encodeFunctionData("enableModule", [account]);
}

type EthCallCallback = (
  encodedFunctionCall: `0x${string}`
) => Promise<{ data: HexString | undefined }>;

export async function getAccountOwners(doEthCall: EthCallCallback) {
  async function fetchAccountOwners(
    fromAddress: string
  ): Promise<`0x${string}`[]> {
    const encodedFunctionCall = delayMod.iface.encodeFunctionData(
      "getModulesPaginated",
      [fromAddress, NUMBER_OF_SIGNERS_TO_FETCH]
    ) as `0x${string}`;

    const ethResult = await doEthCall(encodedFunctionCall);

    if (!ethResult.data) {
      throw new Error("No data returned from eth call");
    }

    const [addresses] = delayMod.iface.decodeFunctionResult(
      "getModulesPaginated",
      ethResult.data
    );

    if (addresses.length === NUMBER_OF_SIGNERS_TO_FETCH) {
      const lastAddress = addresses[addresses.length - 1];
      const nextBatchAddresses = await fetchAccountOwners(lastAddress);
      return addresses.concat(...nextBatchAddresses);
    }

    return addresses;
  }

  return fetchAccountOwners(SENTINEL_ADDRESS);
}
