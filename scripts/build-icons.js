const fs = require("fs");
const path = require("path");

const svgPath = path.join(__dirname, "..", "assets", "icon.svg");
const outputDir = path.join(__dirname, "..", "assets", "generated");
const pngPath = path.join(outputDir, "icon.png");
const icoPath = path.join(outputDir, "icon.ico");

const ensureDir = () => {
  fs.mkdirSync(outputDir, { recursive: true });
};

const buildIcons = async () => {
  const sharp = require("sharp");
  const pngToIco = require("png-to-ico");

  ensureDir();

  await sharp(svgPath)
    .resize(256, 256)
    .png()
    .toFile(pngPath);

  const icoBuffer = await pngToIco(pngPath);
  fs.writeFileSync(icoPath, icoBuffer);

  console.log("Icons generated:", pngPath, icoPath);
};

buildIcons().catch((error) => {
  console.error("Failed to build icons:", error);
  process.exit(1);
});
