const { execSync } = require('child_process');

module.exports = async function sh({ text }) {
  let result = "";
  try {
    // Increase maxBuffer to reduce ERR_CHILD_PROCESS_STDIO_MAXBUFFER risk on large outputs
    result = execSync(text, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  } catch (e) {
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
  return (result || "").replaceAll("@", "\\@");
};