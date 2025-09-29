const cp = require('node:child_process')

module.exports = async function sqlite({ filename, text, format = "table"}, ctx)  {
  let result = ""
  try {
    result = cp.execSync(`sqlite3 -${format} ${filename}`, { encoding: "utf8", input: text })
  } catch (e) {
    if (e.stderr) {
      result += e.stderr
    } 
    if (e.stdout) {
      result += e.stdout
    }
    if (!result) {
      result = e.stack
    }
  }
  return (result || "").replaceAll("@", "\\@");
}
