const fs = require("fs");
const path = require("path");

async function main() {
  const Contract = await ethers.getContractFactory("DocumentSender");
  const contract = await Contract.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("DocumentSender deployed to:", address);

  // Write ABI + address for the frontend
  const artifact = await hre.artifacts.readArtifact("DocumentSender");
  const outDir = path.join(__dirname, "../frontend/src/contracts");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "DocumentSender.json"),
    JSON.stringify({ address, abi: artifact.abi }, null, 2)
  );
  console.log("Wrote frontend contract artifact to /frontend/src/contracts/DocumentSender.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
