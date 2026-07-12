const { parseScript } = require('esprima');
const { generate } = require('escodegen');
const vm = require('node:vm');

module.exports = async function js({ text }, ctx) {
  let code = `(async () =>{\n${text}\n})()`
  const ast = parseScript(code, { range: true });

  const bodyAst = ast.body[ast.body.length - 1].expression.callee.body;
  const lastNode = bodyAst.body[bodyAst.body.length - 1];

  if (lastNode.type === 'ExpressionStatement') {
    bodyAst.body[bodyAst.body.length - 1] = {
      type: 'ReturnStatement',
      argument: lastNode.expression
    }
    code = generate(ast);
  }
  if (bodyAst.length === 0) {
    return null;
  }

  let logs = [];

  try {
    let result = vm.runInContext(code, vm.createContext({ 
      ctx: this,
      console: {
        log: (...args) => logs.push(args),
        error: (...args) => logs.push(args),
        warn: (...args) => logs.push(args),
        debug: (...args) => logs.push(args),
      }
    }))
    result = await result
    if (typeof(result) === "object") {
      result = JSON.stringify(result, null, "  ")
    } else {
      result = String(result)
    }
    logs = logs.map(log => log.join(" ")).join("\n")
    result = logs.trim() + "\n" +  (result || "").trim()
    return result.trim()
  } catch (e) {
    return e.stack
  }
}
