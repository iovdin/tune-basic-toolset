const { spawnSync, execSync } = require('child_process');

//TODO look back do not escape escaped
const escape = (str) => str.replace(/'/g, "\\'")

module.exports = async function sh({ text, host }) {
  let result = "";
  try {
    let cmd = text
    let args = []
    if (host) {
      cmd = "ssh"
      args = [host, text]
    }
    if (!text) {
      return `'text' parameter containing shell command is required`;
    }
    // Increase maxBuffer to reduce ERR_CHILD_PROCESS_STDIO_MAXBUFFER risk on large outputs
    result = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024, shell: true });
    result = (result.stdout || "") + (result.stderr || "")
    return result
  } catch (e) {
    return e
    const stderr = e && typeof e.stderr !== "undefined" ? String(e.stderr || "") : "";
    const stdout = e && typeof e.stdout !== "undefined" ? String(e.stdout || "") : "";

    if (stderr || stdout) {
      // Process started and produced output
      result = stderr + stdout;
    } else {
      // Spawn/configuration errors or cases without stdio
      const parts = [];
      if (e && e.code) parts.push(`code=${e.code}`);
      if (e && typeof e.status === "number") parts.push(`exit=${e.status}`);
      if (e && e.signal) parts.push(`signal=${e.signal}`);
      if (e && e.errno) parts.push(`errno=${e.errno}`);
      if (e && e.path) parts.push(`path=${e.path}`);
      const meta = parts.length ? ` (${parts.join(", ")})` : "";

      if (e && e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
        result = `Command output exceeded maxBuffer${meta}.`;
      } else {
        result = `Failed to spawn/execute command${meta}: ${e && e.message ? e.message : String(e)}`;
      }
    }
  }
  return (result || "")
};
