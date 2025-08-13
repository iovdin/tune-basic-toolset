const { execSync } = require('child_process');
const util = require('util');

module.exports = async function powershell({ text }) {
  let result = "";
  try {
    result =  execSync(text, 
      { 
        encoding: "utf8",
        shell: "powershell.exe",
      });
  } catch (e) {
    result = e.stderr + e.stdout;
  }
  return (result || "").replaceAll("@", "\\@");
};
