function fmt(num) {
  if (num < 1000) {
    return num.toString(); // Return as-is for numbers under 1000
  }

  const suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  const tier = Math.log10(Math.abs(num)) / 3 | 0;

  if (tier === 0) return num.toString();

  const suffix = suffixes[tier];
  const scale = Math.pow(10, tier * 3);
  const scaled = num / scale;

  // Format to 1 decimal place if needed, otherwise whole number
  return scaled.toFixed(scaled < 10 && scaled >= 1 ? 1 : 0) + suffix;
}

module.exports = async function usage(node, args) {
  if (!node) return

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
      const { prompt_tokens, completion_tokens, cost } = usage || {};
      const { cached_tokens } = usage.prompt_tokens_details || {};  
      let content = (msg.content || "").trim()
      if (content) {
        content += '\n\n'
      }
      if (usage) {
          let cents = cost ? `${(cost * 100).toFixed(2)}¢` : ''
          msg.content = `${content}---\n↑${fmt(prompt_tokens)}/${fmt(cached_tokens)} ↓${fmt(completion_tokens)} ${cents}\n---` 
      }
      return msg
    }
    //msgs2msgs
  }
}
