const path = require("path");

module.exports = async function fn(node) {
  if (!node) return node;
  const nameNode = {
    ...node,
    type: "text",
    read: async () => `@${node.ref || node.name}`
  }
  let mainNode = node;
  if (node.type === "text") { 
    mainNode ={
      ...node,
      read: async () => `\n--------BEGIN CONTENT ${node.ref || node.name}---------\n${await node.read()}\n--------END CONTENT ${node.name} ---------------\n`
    }
  }
  return [nameNode, mainNode]
}
