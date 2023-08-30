import { ContractAbis, KnownContracts } from "@gnosis.pm/zodiac";
import {
  getMultiSendDeployment,
  getProxyFactoryDeployment,
  getSafeSingletonDeployment,
} from "@safe-global/safe-deployments";
import { getAllowanceModuleDeployment } from "@safe-global/safe-modules-deployments";
import { generateSolidity } from "abi-to-sol";
import fs from "fs";
import path from "path";

const VERSION = "v1.3.0";

generate("IAllowanceModule", getAllowanceModuleDeployment()?.abi);
// generate("IDelayModule", ContractAbis[KnownContracts.DELAY], "^0.8.0");
generate("IModuleProxyFactory", ContractAbis[KnownContracts.FACTORY]);
generate("IMultisend", getMultiSendDeployment({ version: VERSION })?.abi);
generate("ISafe", getSafeSingletonDeployment({ version: VERSION })?.abi);
generate(
  "ISafeProxyFactory",
  getProxyFactoryDeployment({ version: VERSION })?.abi
);

function generate(name: string, abi: any) {
  const code = generateSolidity({
    abi,
    name,
    prettifyOutput: true,
    outputSource: false,
    solidityVersion: "^0.8.4",
    license: "LGPL-3.0-only",
  });

  fs.writeFileSync(
    path.join(__dirname, "..", "contracts", "interfaces", `${name}.sol`),
    code,
    "utf8"
  );
}
