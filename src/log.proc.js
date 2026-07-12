const fs = require("fs")
const path = require("path")

module.exports = async (node, args, ctx)  => { 
  if (!node || node.type !== 'llm') {
    throw Error("llm required for 'log' processor")
  }

  const filename = args.trim() || "log.json"
  const ext = path.extname(filename)

  if (ext === ".chat" || ext === ".json") {
    return ({
      ...node,
      exec: async function(payload, ctx) {
        const res = await node.exec(payload, ctx)
        const body = JSON.parse(res.body)
        payload = {...res, body};
        const filename = args.trim() || "log.json"
        const content =  path.extname(filename) == ".chat" ? ctx.msg2text(payload.body.messages, true) : JSON.stringify(payload, null, "  ") 
        fs.writeFileSync(filename, content);
        return res
      }
    }) 
  } else if (ext === ".fetch") {
    return ({
      ...node,
      fetch: async function customFetch(url, payload) {
        const res = await fetch(url, payload);

        res.clone().text().then(text => fs.writeFileSync(filename, text));

        return res;
      }
    }) 
  } else {
    throw Error(`filename must be of .chat .json or .fetch extension`)
  }
}
