import { Interface } from "ethers";
import { DELAY_ABI, FACTORY_ABI } from "./abis";

export const MODULE_FACTORY_ADDRESS =
  "0x000000000000aDdB49795b0f9bA5BC298cDda236";
export const DELAY_MASTERCOPY_ADDRESS =
  "0xD62129BF40CD1694b3d9D9847367783a1A4d5cB4";

export const MODULE_FACTORY_INTERFACE = new Interface(FACTORY_ABI);

export const DELAY_INTERFACE = new Interface(DELAY_ABI);
