function tokenize(input) {
  const tokens = []
  let i = 0

  while (i < input.length) {
    const ch = input[i]

    if (/\s/.test(ch)) {
      i += 1
      continue
    }

    const two = input.slice(i, i + 2)
    if (["&&", "||", "==", "!=", "=~", "!~"].includes(two)) {
      tokens.push({ type: two, value: two })
      i += 2
      continue
    }

    if (ch === '(' || ch === ')' || ch === '!') {
      tokens.push({ type: ch, value: ch })
      i += 1
      continue
    }

    if (ch === '"' || ch === "'") {
      const quote = ch
      let j = i + 1
      let value = ''
      while (j < input.length) {
        const c = input[j]
        if (c === '\\') {
          if (j + 1 >= input.length) throw Error('filter: Unterminated string')
          value += input[j + 1]
          j += 2
          continue
        }
        if (c === quote) break
        value += c
        j += 1
      }
      if (j >= input.length || input[j] !== quote) throw Error('filter: Unterminated string')
      tokens.push({ type: 'string', value })
      i = j + 1
      continue
    }

    if (ch === '/') {
      let j = i + 1
      let pattern = ''
      let escaped = false
      while (j < input.length) {
        const c = input[j]
        if (!escaped && c === '/') break
        if (!escaped && c === '\\') {
          escaped = true
          pattern += c
          j += 1
          continue
        }
        escaped = false
        pattern += c
        j += 1
      }
      if (j >= input.length || input[j] !== '/') throw Error('filter: Unterminated regex')
      j += 1
      let flags = ''
      while (j < input.length && /[a-z]/i.test(input[j])) {
        flags += input[j]
        j += 1
      }
      tokens.push({ type: 'regex', value: new RegExp(pattern, flags) })
      i = j
      continue
    }

    const numberMatch = input.slice(i).match(/^-?\d+(?:\.\d+)?/)
    if (numberMatch) {
      tokens.push({ type: 'number', value: Number(numberMatch[0]) })
      i += numberMatch[0].length
      continue
    }

    const identMatch = input.slice(i).match(/^[A-Za-z_$][A-Za-z0-9_$]*/)
    if (identMatch) {
      const value = identMatch[0]
      if (value === 'true' || value === 'false') {
        tokens.push({ type: 'boolean', value: value === 'true' })
      } else if (value === 'null') {
        tokens.push({ type: 'null', value: null })
      } else if (value === 'undefined') {
        tokens.push({ type: 'undefined', value: undefined })
      } else {
        tokens.push({ type: 'identifier', value })
      }
      i += value.length
      continue
    }

    throw Error(`filter: Unexpected token at position ${i}: ${input.slice(i, i + 16)}`)
  }

  return tokens
}

function parse(input) {
  const tokens = tokenize(input)
  let i = 0

  function peek() {
    return tokens[i]
  }

  function match(type) {
    if (peek() && peek().type === type) {
      i += 1
      return true
    }
    return false
  }

  function expect(type) {
    if (!peek() || peek().type !== type) {
      throw Error(`filter: Expected ${type}${peek() ? ` but got ${peek().type}` : ''}`)
    }
    return tokens[i++]
  }

  function parseExpression() {
    return parseOr()
  }

  function parseOr() {
    let node = parseAnd()
    while (match('||')) {
      node = { type: 'or', left: node, right: parseAnd() }
    }
    return node
  }

  function parseAnd() {
    let node = parseNot()
    while (match('&&')) {
      node = { type: 'and', left: node, right: parseNot() }
    }
    return node
  }

  function parseNot() {
    if (match('!')) {
      return { type: 'not', expr: parseNot() }
    }
    return parsePrimary()
  }

  function parsePrimary() {
    if (match('(')) {
      const expr = parseExpression()
      expect(')')
      return expr
    }

    const left = parseValue(true)
    const op = peek() && peek().type
    if (["==", "!=", "=~", "!~"].includes(op)) {
      i += 1
      const right = parseValue(false)
      return { type: 'binary', op, left, right }
    }
    return left
  }

  function parseValue(allowIdentifier) {
    const token = peek()
    if (!token) {
      throw Error('filter: Unexpected end of expression')
    }

    if (token.type === 'identifier') {
      i += 1
      if (!allowIdentifier) {
        throw Error('filter: Identifier is not allowed here')
      }
      return { type: 'identifier', name: token.value }
    }

    if (["string", "number", "boolean", "null", "undefined", "regex"].includes(token.type)) {
      i += 1
      return { type: 'literal', value: token.value }
    }

    throw Error(`filter: Unexpected token ${token.type}`)
  }

  const ast = parseExpression()
  if (i < tokens.length) {
    throw Error(`filter: Unexpected token ${tokens[i].type}`)
  }
  return ast
}

function evaluate(ast, scope) {
  if (!ast) return false

  switch (ast.type) {
    case 'or':
      return Boolean(evaluate(ast.left, scope) || evaluate(ast.right, scope))
    case 'and':
      return Boolean(evaluate(ast.left, scope) && evaluate(ast.right, scope))
    case 'not':
      return !Boolean(evaluate(ast.expr, scope))
    case 'identifier':
      return scope[ast.name]
    case 'literal':
      return ast.value
    case 'binary': {
      const left = evaluate(ast.left, scope)
      const right = evaluate(ast.right, scope)
      if (ast.op === '==') return left == right
      if (ast.op === '!=') return left != right
      if (ast.op === '=~') {
        if (!(right instanceof RegExp)) throw Error('filter: Right side of =~ must be regex')
        return right.test(String(left))
      }
      if (ast.op === '!~') {
        if (!(right instanceof RegExp)) throw Error('filter: Right side of !~ must be regex')
        return !right.test(String(left))
      }
      throw Error(`filter: Unsupported operator ${ast.op}`)
    }
    default:
      throw Error(`filter: Unknown AST node ${ast.type}`)
  }
}

async function filter(node, args, ctx) {
  // undefined node will raise error
  // node type: "ignore" will be filtered by tune
  // feels a bit like a hack, think for better solution
  if (!node) return
  const expr = (args || '').trim()
  if (!expr) {
    throw Error('filter requires condition')
  }
  const ast = parse(expr)
  return evaluate(ast, node) ? node : "ignore"
}

module.exports = filter
