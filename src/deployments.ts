import { ContractAddresses, KnownContracts } from "@gnosis.pm/zodiac";
import {
  getFallbackHandlerDeployment,
  getMultiSendDeployment,
  getProxyFactoryDeployment,
  getSafeSingletonDeployment,
} from "@safe-global/safe-deployments/";
import { getAllowanceModuleDeployment } from "@safe-global/safe-modules-deployments";
import {
  IAllowanceModule__factory,
  IDelayModule__factory,
  IModuleProxyFactory__factory,
  IMulticall__factory,
  IMultisend__factory,
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
  allowanceSingleton: {
    // 1 and 100 same address
    address: getAllowanceModuleDeployment()?.networkAddresses[1] as string,
    iface: IAllowanceModule__factory.createInterface(),
  },
  moduleProxyFactory: {
    // 1 and 100 same address
    address: ContractAddresses[1][KnownContracts.FACTORY],
    iface: IModuleProxyFactory__factory.createInterface(),
  },
  delayMastercopy: {
    // 1 and 100 same address
    address: ContractAddresses[1][KnownContracts.DELAY],
    iface: IDelayModule__factory.createInterface(),
  },
  multisend: {
    address: getMultiSendDeployment({ version: VERSION })
      ?.defaultAddress as string,
    iface: IMultisend__factory.createInterface(),
  },
  multicall: {
    address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    iface: IMulticall__factory.createInterface(),
  },
};

// this is the creation bytecode for v1.3.0
export const proxyCreationBytecode =
  "0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea2646970667358221220d1429297349653a4918076d650332de1a1068c5f3e07c5c82360c277770b955264736f6c63430007060033496e76616c69642073696e676c65746f6e20616464726573732070726f7669646564";
