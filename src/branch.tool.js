module.exports = async function branch({ text }, ctx) {
  const chatNode = ctx.stack.findLast(item => item.mimetype === "text/chat")
  if (!chatNode) {
    return "Can not branch, it must be called by another chat"
  }
  const chatHistory = await chatNode.read()

  return ctx.file2run({ stop: "assistant", text: chatHistory, user: text }, {}, ctx)
}
