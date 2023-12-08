import {
  getMultiSendDeployment,
  getProxyFactoryDeployment,
  getSafeSingletonDeployment,
} from "@safe-global/safe-deployments";
import { generateSolidity } from "abi-to-sol";
import fs from "fs";
import path from "path";

import delayAbi from "./abi/delay.json";
import moduleProxyFactoryAbi from "./abi/moduleProxyFactory.json";
import rolesAbi from "./abi/roles.json";
import spenderAbi from "./abi/spender.json";

const VERSION = "v1.3.0";

generate("IDelayModifier", delayAbi);
generate("IModuleProxyFactory", moduleProxyFactoryAbi);
generate("IRolesModifier", rolesAbi);
generate("ISpenderModifier", spenderAbi);

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

  const fileName = path.join(
    __dirname,
    "..",
    "contracts",
    "interfaces",
    `${name}.sol`
  );

  fs.writeFileSync(fileName, code, "utf8");
}
