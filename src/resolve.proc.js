module.exports = async function resolve(node, args, ctx) {
  if (!node) {
    return
  }
  if (node.type !== "text") {
    throw Error(`can resolve only text nodes, got ${node.type}`)
  }
  const filename = await node.read()
  const result = await ctx.resolve(filename.trim())
  if (result) return result
  
  return {
    type: "text",
    read: async () => args || "Not found"
  }
}
