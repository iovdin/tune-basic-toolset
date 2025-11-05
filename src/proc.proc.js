const { parseCommandLine } = require('./utils.js')

module.exports = async function proc(node, args, ctx) {
  /*
  @{| proc sh }
  @{ script.sh | proc sh }
  @{| proc sqlite SELECT * FROM table }
  @{| proc sqlite filename=db.sqlite text="SELECT * FROM table" }
  */

  const [ toolName, params ] = parseCommandLine(args)
  if (node && !params.text) {
    params.text = await node.read()
  }

  const tool = await ctx.resolve(toolName, { "type": "tool" })

  if (!tool || tool.type !== "tool") {
    throw Error(`tool '${toolName}' not found`)
  }

  return {
    ...node,
    type: "text",
    read: async() => tool.exec.call(ctx, params, ctx)
  }
}


