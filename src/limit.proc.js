const { parseArgs } = require('./utils.js')


const parseMaxTokens = (value) => {
  if (value == null || value === '') {
    return 10000
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 10000
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    const match = normalized.match(/^([+-]?\d+(?:\.\d+)?)\s*([kmb])?$/)
    if (!match) {
      return 10000
    }

    const num = Number(match[1])
    if (!Number.isFinite(num) || num <= 0) {
      return 10000
    }

    const multipliers = {
      k: 1e3,
      m: 1e6,
      b: 1e9,
    }
    const multiplier = multipliers[match[2]] || 1
    const parsed = Math.floor(num * multiplier)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10000
  }
  return 10000
}

module.exports = async function limit(node, args) {
  /*
   @{ sh | limit tokens=2000 hit=hard_err|soft_err|cut }
   @{ filename | limit tokens=2k }
   @{ filename | limit tokens=1.5K }
   @{| proc sh tree | limit }
  */

  if (!node) {
    return
  }

  const params = parseArgs(args)

  const maxTokens = parseMaxTokens(params.tokens)

  const handleContent = (content) => {
    if (!content || (content.length / 4) <= maxTokens) {
      return content
    }
    switch (params.hit) {
      case "cut":
        //TODO: binary
        return content.slice(0, maxTokens * 4) + `\n warning: the rest of the content is cut because it hit max token limit ${maxTokens} `
      case "soft_err":
        return `Content is too big to be shown, context limit ${maxTokens} tokens`
      default: // hard_err
        throw Error(`Content is too big to be shown, context limit ${maxTokens} tokens`)
    }
  }

  if (node.type === "text") {
    return {
      ...node,
      read: async () => handleContent(await node.read())
    }
  }

  if (node.type === "tool") {
    return {
      ...node,
      exec: async (params, ctx) => handleContent(await node.exec.call(ctx, params, ctx))
    }
  }

  throw Error(`limit processor can only handle 'text' and 'tool' nodes, got '${node.type}'`)
}
