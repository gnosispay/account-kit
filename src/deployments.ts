import {
  getFallbackHandlerDeployment,
  getMultiSendDeployment,
  getProxyFactoryDeployment,
  getSafeSingletonDeployment,
} from "@safe-global/safe-deployments/";

import { getSingletonFactoryInfo } from "@safe-global/safe-singleton-factory";
import { getAddress } from "ethers";
import {
  IDelayModule__factory,
  IModuleProxyFactory__factory,
  IMulticall__factory,
  IMultisend__factory,
  IRolesModifier__factory,
  ISafeProxyFactory__factory,
  ISafe__factory,
} from "../typechain-types";

const VERSION = "v1.3.0";

export default {
  delayMastercopy: {
    address: getAddress("0x4A97E65188A950Dd4b0f21F9b5434dAeE0BBF9f5"),
    iface: IDelayModule__factory.createInterface(),
  },
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
  rolesMastercopy: {
    address: getAddress("0x26DA7F5a385BA7c96456Ea6273d715ebF90feba8"),
    iface: IRolesModifier__factory.createInterface(),
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

  singletonFactory: {
    address: getSingletonFactoryInfo(1)?.address as string,
  },
};
