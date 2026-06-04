import {
  getFallbackHandlerDeployment,
  getMultiSendDeployment,
  getProxyFactoryDeployment,
  getSafeSingletonDeployment,
  getSignMessageLibDeployment,
} from "@safe-global/safe-deployments/";

import { getSingletonFactoryInfo } from "@safe-global/safe-singleton-factory";
import { getAddress } from "ethers";
import {
  IDelayModifier__factory,
  IModuleProxyFactory__factory,
  IMulticall__factory,
  IMultisend__factory,
  IRolesModifier__factory,
  ISafe__factory,
  ISafeProxyFactory__factory,
  ISignMessageLib__factory,
  ISpenderModifier__factory,
} from "../typechain-types";

const VERSION = "v1.3.0";

export default {
  fallbackHandler: {
    address: getFallbackHandlerDeployment({
      version: VERSION,
    })?.defaultAddress as string,
  },
  moduleProxyFactory: {
    address: getAddress("0x000000000000addb49795b0f9ba5bc298cdda236"),
    iface: IModuleProxyFactory__factory.createInterface(),
  },
  multicall: {
    address: getAddress("0xcA11bde05977b3631167028862bE2a173976CA11"),
    iface: IMulticall__factory.createInterface(),
  },
  multisend: {
    address: getMultiSendDeployment({ version: VERSION })
      ?.defaultAddress as string,
    iface: IMultisend__factory.createInterface(),
  },
  safeMastercopy: {
    address: getSafeSingletonDeployment({
      version: VERSION,
    })?.defaultAddress as string,
    iface: ISafe__factory.createInterface(),
  },
  safeProxyFactory: {
    address: getProxyFactoryDeployment({
      version: VERSION,
    })?.defaultAddress as string,
    iface: ISafeProxyFactory__factory.createInterface(),
  },
  delayModMastercopy: {
    address: getAddress("0x22d903fd45F441F51bcad198D14eBa8a75EA1ef0"),
    iface: IDelayModifier__factory.createInterface(),
  },
  rolesModMastercopy: {
    address: getAddress("0x732B9E9f259fbA6f65A1a012DC89c20872ffBd2f"),
    iface: IRolesModifier__factory.createInterface(),
  },
  spenderModMastercopy: {
    address: getAddress("0x7a592bae57b8cd45688f9eb81ce4a622e7e37cb7"),
    iface: ISpenderModifier__factory.createInterface(),
  },
  signMessageLib: {
    address: getSignMessageLibDeployment({
      version: VERSION,
    })?.defaultAddress as string,
    iface: ISignMessageLib__factory.createInterface(),
  },
  singletonFactory: {
    address: getSingletonFactoryInfo(1)?.address as string,
  },
};
