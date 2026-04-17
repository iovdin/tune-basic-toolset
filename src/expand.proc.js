const TYPES = {
  llm: true,
  content: true,
  tools: true,
  schemas: true
}
module.exports = async function expand(node, args, ctx) {
  if (!node) return
  if (node.type !== "text") {
    throw Error(`expand supports 'text' nodes ${node.type} given`)
  }
  let history = await node.read()
  const roles = ctx.text2roles(history)
  const srcType = (roles.length === 0) ? "prompt" : "chat"

  // make it chat temporarily
  if (srcType === "prompt"){ 
    history = "user: " + history
  }

  // TODO if it is not a chat but prompt?
  const { messages, tools, llm } = await ctx.text2payload(history)
  // const schemas = JSON.stringify(tools.map(tool => tool.schema), null, "  ")
  let types = ["llm", "tools", "content"]
  if (args.trim()) {
    types = args.trim().split(/\s+/)
    types.forEach(type => {
      if (!TYPES[type]) {
        throw Error(`expand supports 'content|llm|tools|schemas' but got ${type}`) 
      }
    })
  }
  return types.reduce((nodes, type) => {
    if (type === "content") {
      nodes.push({
        ...node,
        read: async () =>  (srcType === "chat") ? ctx.msg2text(messages, true) : messages[0].content

      })
    } else if (type === "tools") {
      nodes = nodes.concat(tools)
    } else if (type === "llm") {
      nodes.push(llm)
    } else if (type === "schemas") {
      nodes.push({
        ...node,
        type: "text",
        name: "schemas",
        read: async () => schemas
      })
    }
    return nodes
  }, [])
}
