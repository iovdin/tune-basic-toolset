module.exports = async function(node, args, ctx) {
  if (! node) {
    return node
  }
  return {
    ...node,
    type: "text",
    read : async () => ctx.read(node.fullname)
  }

}
