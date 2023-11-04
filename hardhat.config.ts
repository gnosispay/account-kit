import "@nomicfoundation/hardhat-toolbox";

import dotenv from "dotenv";

// Load environment variables.
dotenv.config();

export default {
  paths: {
    artifacts: "build/artifacts",
    cache: "build/cache",
    deploy: "src/deploy",
    sources: "contracts",
  },
  solidity: "0.8.20",
};
