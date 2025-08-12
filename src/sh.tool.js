const { execSync } = require('child_process');
const util = require('util');

module.exports = async function sh({ text }) {
  let result = "";
  try {
    result =  execSync(text, { encoding: "utf8" });
  } catch (e) {
    result = e.stderr + e.stdout;
  }
  return (result || "").replaceAll("@", "\\@");
};