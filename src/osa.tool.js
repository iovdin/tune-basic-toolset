const { execSync } = require('child_process');
const util = require('util');

module.exports = async function osa({ text }) {
  let result = "";
  try {
    result = execSync("osascript -", { input: text, encoding: "utf8" });
  } catch (e) {
    result = e.stderr + e.stdout;
  }
  return (result || "").replaceAll("@", "\\@");
};