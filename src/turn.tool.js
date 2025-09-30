module.exports = async function turn({ role, filename }, ctx) {
  if (filename) {
    await ctx.write(filename, `@@${role}`);
  }
  return `now it is turn of ${role} to reply`;
};
