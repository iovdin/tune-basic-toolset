const { relative, dirname } = require('path');

module.exports = async function readFile({ filename, linenum, autotext, inline }, ctx) {
  let resolved = await ctx.resolve(filename);
  if (!resolved) {
    return "File not found";
  }

  const trailDir = filename[filename.length - 1] === "/" ? "/" : ""

  if (inline) {
    if (linenum) {
      const ln = await ctx.resolve("linenum", { type: "processor"} )
      resolved = await ln.exec(resolved, "", ctx)
    }
    return resolved.read()
  }
  const relFile = relative(process.cwd(), filename) + trailDir;
  const pathArr = [ relFile ];
  if (resolved.type !== 'text' && ((typeof autotext === 'undefined') || autotext) && resolved.read) {
    pathArr.push('text');
  }
  if (linenum) {
    pathArr.push('linenum');
  }
  if (pathArr.length > 1) {
    return`@{ ${pathArr.join(" | ")} }`;
  }
  if (relFile.match(/\s+/)) {
    return `@{${relFile}}`;
  }
  return `@${relFile||"."}`;
};
