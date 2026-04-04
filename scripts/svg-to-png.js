const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const svgPath = path.resolve(__dirname, "..", "icon.svg");
const outPath = path.resolve(__dirname, "..", "icon.png");
const size = 512;

const svgData = fs.readFileSync(svgPath, "utf-8");
const html = `<html><head><style>
* { margin: 0; padding: 0; }
html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
</style></head><body>${svgData}</body></html>`;

const tmpHtml = "/tmp/prism-icon-render.html";
fs.writeFileSync(tmpHtml, html);

execSync(
  `google-chrome-stable --headless=new --no-sandbox --disable-gpu ` +
  `--default-background-color=00000000 ` +
  `--screenshot="${outPath}" --window-size=${size},${size + 100} ` +
  `"file://${tmpHtml}"`,
  { stdio: "inherit" }
);

console.log("Done:", outPath);
