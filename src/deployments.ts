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
  safeProxyFactory: {
    address: getProxyFactoryDeployment({
      version: VERSION,
    })?.defaultAddress as string,
    iface: ISafeProxyFactory__factory.createInterface(),
  },
  safeMastercopy: {
    address: getSafeSingletonDeployment({
      version: VERSION,
    })?.defaultAddress as string,
    iface: ISafe__factory.createInterface(),
  },
  fallbackHandler: {
    address: getFallbackHandlerDeployment({
      version: VERSION,
    })?.defaultAddress as string,
  },
  moduleProxyFactory: {
    // 1 and 100 same address
    address: getAddress("0x000000000000addb49795b0f9ba5bc298cdda236"),
    iface: IModuleProxyFactory__factory.createInterface(),
  },
  delayMastercopy: {
    // 1 and 100 same address
    address: getAddress("0x177D7CDBcc7E9C408d3A66eB473658D63B18B554"),
    iface: IDelayModule__factory.createInterface(),
  },
  rolesMastercopy: {
    // 1 and 100 same address
    address: getAddress("0x26DA7F5a385BA7c96456Ea6273d715ebF90feba8"),
    iface: IRolesModifier__factory.createInterface(),
  },
  multisend: {
    address: getMultiSendDeployment({ version: VERSION })
      ?.defaultAddress as string,
    iface: IMultisend__factory.createInterface(),
  },
  multicall: {
    address: getAddress("0xcA11bde05977b3631167028862bE2a173976CA11"),
    iface: IMulticall__factory.createInterface(),
  },
  singletonFactory: {
    address: getSingletonFactoryInfo(1)?.address as string,
  },
};

// this is the creation bytecode for v1.3.0
export const proxyCreationBytecode =
  "0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea2646970667358221220d1429297349653a4918076d650332de1a1068c5f3e07c5c82360c277770b955264736f6c63430007060033496e76616c69642073696e676c65746f6e20616464726573732070726f7669646564";
