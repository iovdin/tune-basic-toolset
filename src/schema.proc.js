module.exports = async function schema(node) {

  console.log("node", node)
  if (!node) return
  if (node.type !== 'tool') { 
    throw Error(`type tool is expected for 'schema' processor got ${node.type}`)
  }
  return {
    ...node,
    type: "text",
    read: async () => JSON.stringify(node.schema, null, "  ")
  }
}
