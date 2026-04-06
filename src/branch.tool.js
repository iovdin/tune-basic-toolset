module.exports = async function branch({ text }, ctx) {
  // lets forbit recursive branch calling 
  const branch = ctx.stack.find(item => (item.type === "tool") && (item.name === "branch"))

  if (branch) {
    return "You're aready in the branch, do the user request"
  }

  ctx = ctx.clone()
  ctx.stack.push({
    name: "branch",
    type: "tool",
    exec: async (params, ctx) => branch(params, ctx) 
  })
  
  const chatNode = ctx.stack.findLast(item => item.mimetype === "text/chat")
  if (!chatNode) {
    return "Can not branch, it must be called by another chat"
  }
  let chatHistory = await chatNode.read()
  // we should remove latest tool_call: branch from the history
  // because it becomes user in this tool
  let roles = ctx.text2roles(chatHistory || "").toReversed()
  const index = roles.findIndex(item => item.role === "assistant")
  if (index >= 0) {
    roles = roles.slice(index + 1).toReversed()
    chatHistory = ctx.roles2text(roles, true)
  }

  return ctx.file2run({ 
    stop: "assistant", 
    text: chatHistory,
    user: text
  }, {}, ctx)
}
