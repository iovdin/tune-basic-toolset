const { relative, dirname } = require('path');

module.exports = async function readFile({ filename, linenum }, ctx) {
  const resolved = await ctx.resolve(filename);
  if (!resolved) {
    return "File not found";
  }
  const relFile = relative(process.cwd(), filename);
  const pathArr = [ relFile ];
  if (resolved.type !== 'text') {
    pathArr.push('text');
  }
  if (linenum) {
    pathArr.push('linenum');
  }
  if (pathArr.length > 1) {
    return`@{ ${pathArr.join(" | ")} }`;
  }
  return `@${relFile}`;
};