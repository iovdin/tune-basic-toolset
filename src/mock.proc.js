const { parseArgs } = require('./utils.js')

module.exports = async function mock(node, args, ctx) {
  const vars = parseArgs(args)
  if (node && node.type === "ctx")  {
    ctx = node;
  }
  
  return {
    ...ctx,
    resolve: async(name, args) => {
      if (vars[name]) {
        return {
          type: "text",
          name,
          read: async () => vars[name]
        }
      }
      return ctx.resolve(name, args)
    }
  }
}
