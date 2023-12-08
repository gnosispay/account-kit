import fs from "fs";
import path from "path";
import { cwd } from "process";
import { rimrafSync } from "rimraf";

function run() {
  rimrafSync(path.join(cwd(), "typechain-types", "@gnosis.pm"));
  rimrafSync(path.join(cwd(), "typechain-types", "factories", "@gnosis.pm"));
  rimrafSync(
    path.join(cwd(), "typechain-types", "factories", "contracts", "Spender.sol")
  );
  rimrafSync(
    path.join(
      cwd(),
      "typechain-types",
      "factories",
      "contracts",
      "Spender__factory.ts"
    )
  );
  rimrafSync(path.join(cwd(), "typechain-types", "contracts", "Spender.sol"));

  filterFile(path.join(cwd(), "typechain-types", "index.ts"), /gnosisPm/);
  filterFile(path.join(cwd(), "typechain-types", "index.ts"), /Spender.sol/);
  filterFile(
    path.join(cwd(), "typechain-types", "index.ts"),
    /@gnosis.pm\/zodiac/
  );
  filterFile(
    path.join(cwd(), "typechain-types", "index.ts"),
    /".\/contracts\/Spender";/
  );
  filterFile(
    path.join(cwd(), "typechain-types", "index.ts"),
    /".\/factories\/contracts\/Spender__factory"/
  );
  filterFile(
    path.join(cwd(), "typechain-types", "contracts", "index.ts"),
    /".\/Spender.sol"/
  );
  filterFile(
    path.join(cwd(), "typechain-types", "contracts", "index.ts"),
    /spenderSol/
  );
  filterFile(
    path.join(cwd(), "typechain-types", "factories", "index.ts"),
    /from ".\/@gnosis.pm"/
  );
  filterFile(
    path.join(cwd(), "typechain-types", "factories", "contracts", "index.ts"),
    /".\/Spender__factory"/
  );
  filterFile(
    path.join(cwd(), "typechain-types", "factories", "contracts", "index.ts"),
    /".\/Spender.sol"/
  );
}

function filterFile(filePath: string, regex: RegExp) {
  // Read the content of the input file
  const data = fs.readFileSync(filePath, "utf8");

  // Split the content into an array of lines
  const lines = data.split("\n");

  // Filter lines based on the provided regular expression
  const filteredLines = lines.filter((line) => !regex.test(line));

  // Join the filtered lines into a string
  const result = filteredLines.join("\n");

  // Write the filtered content to the output file
  fs.writeFileSync(filePath, result, "utf8");
}

run();
