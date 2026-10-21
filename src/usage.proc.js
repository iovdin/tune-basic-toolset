const { parseArgs, usageRender } = require('./utils.js');

module.exports = async function usage(node, args) {
  if (!node) return

  const template = (args || "").trim() || '↑%i:h/%c:h ↓%o:h[ %C:100.2¢]'

  if (node.type !== "llm") throw Error(`token usage is for 'llm' node type, got '${node.type}'`)

  return {
    ...node,
    // remove usage when sending payload to LLM
    exec: async (payload, ctx) => {
      const { messages } = payload 
      messages.forEach(msg => {
        if (msg.role === "assistant" && msg.content) {
          msg.content = msg.content.replace(/^---\n([\s\S]*?)\n---$/gm, "").trim()
        }
      })
      return node.exec({ 
        ...payload,
        messages
      })
    },
    // append usage during generation
    result2msg: (result, msg) => {
      msg = node.result2msg(result, msg)
      const { usage } = result
      if (!usage) return msg;
      let content = (msg.content || "").trim()
      if (content) content += '\n\n'
      msg.content = `${content}---\n${usageRender(template, usage)}\n---`
      return msg
    }
    //msgs2msgs
  }
}
