import dotenv from "dotenv";
import { JsonRpcProvider, Wallet } from "ethers";

dotenv.config();

const { WALLET_PRIVATE_KEY } = process.env;

const provider = new JsonRpcProvider("https://rpc.gnosischain.com");

const wallet = new Wallet(WALLET_PRIVATE_KEY!, provider);

export { wallet };
