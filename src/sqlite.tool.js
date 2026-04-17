const cp = require('node:child_process')

module.exports = async function sqlite({ filename, text, query, format = "table"}, ctx)  {
  // query is hidden parameter that sometimes LLMs put instead of text
  let result = ""
  try {
    result = cp.execSync(`sqlite3 -${format} ${filename}`, { encoding: "utf8", input: (text || query) })
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
  return (result || "");
}
