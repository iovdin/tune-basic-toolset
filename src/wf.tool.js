const fs = require('fs').promises;
const path = require('path');

module.exports = async function writeFile({ filename, text }, ctx) {
  await ctx.write(filename, text)
  return `written`;
};
