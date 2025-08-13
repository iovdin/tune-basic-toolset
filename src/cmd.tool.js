const { execSync } = require('child_process');
const util = require('util');

module.exports = async function cmd({ text }) {
  let result = "";
  try {
    result =  execSync(text, 
      { 
        encoding: "utf8",
        shell: "cmd.exe",
      });
  } catch (e) {
    result = e.stderr + e.stdout;
  }
  return (result || "").replaceAll("@", "\\@");
};
