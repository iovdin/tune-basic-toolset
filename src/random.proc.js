// @{| random choice a b c d } choose 1 from the list
// @{| random a b c d } - default is choice
// @{| random "choice with whitespaces 1" "another choice"  } - default is choice, and choices are in "
// @{ file/name | random choice } choose 1 line from the input node
// @{| random choice @a @b @c } resolve and return one of the named nodes
// @{| random choice 2..30 } choose number from the range

// @{| random choices 3 a b c d } choice with replacement
// @{| random sample 3 a b c d } choice without replacement
// @{| random shuffle a b c d } shuffle and return
// @{| random uniform 1..10 } uniformly choose a number from the range (ints -> int, floats -> float)

// Utilities
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const randFloat = (min, max) => Math.random() * (max - min) + min
const isInt = (n) => Number.isInteger(n)

const shuffleArray = (arr) => {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const tokenize = (str) => {
  const out = []
  const re = /"([^"]*)"|(\S+)/g
  let m
  while ((m = re.exec(str))) {
    if (m[1] !== undefined) out.push(m[1])
    else out.push(m[2])
  }
  return out
}

const parseRange = (str) => {
  const m = String(str).trim().match(/^\s*(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)\s*$/)
  if (!m) return null
  const min = parseFloat(m[1])
  const max = parseFloat(m[2])
  const intRange = isInt(min) && isInt(max)
  return { min: Math.min(min, max), max: Math.max(min, max), isInt: intRange }
}

const toNumber = (s) => {
  if (s === null || s === undefined) return NaN
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

const methods = {
  // choice: choose a single element or a value from a range
  choice: (input) => {
    if (input.type === 'range') {
      return String(randInt(input.range.min, input.range.max))
    } else if (input.type === 'floatRange') {
      return String(randFloat(input.range.min, input.range.max))
    } else {
      const values = input.items
      if (!values.length) throw new Error('random: no values to choose from')
      return values[Math.floor(Math.random() * values.length)]
    }
  },

  // choices: n picks with replacement
  choices: (input, { count }) => {
    if (count <= 0) return ''
    const out = []
    if (input.type === 'range') {
      for (let i = 0; i < count; i++) out.push(String(randInt(input.range.min, input.range.max)))
    } else if (input.type === 'floatRange') {
      for (let i = 0; i < count; i++) out.push(String(randFloat(input.range.min, input.range.max)))
    } else {
      const values = input.items
      if (!values.length) throw new Error('random: no values to choose from')
      for (let i = 0; i < count; i++) out.push(values[Math.floor(Math.random() * values.length)])
    }
    return out.join("\n")
  },

  // sample: n picks without replacement (requires discrete set)
  sample: (input, { count }) => {
    if (count <= 0) return ''
    if (input.type === 'floatRange') {
      throw new Error('random sample: float ranges are not supported')
    }
    let values
    if (input.type === 'range') {
      const { min, max } = input.range
      // build discrete list
      values = []
      for (let i = min; i <= max; i++) values.push(String(i))
    } else {
      values = input.items.slice()
    }
    if (!values.length) throw new Error('random: no values to sample from')
    const n = Math.min(count, values.length)
    return shuffleArray(values).slice(0, n).join("\n")
  },

  // shuffle: shuffle all values (requires discrete set)
  shuffle: (input) => {
    if (input.type === 'floatRange') {
      throw new Error('random shuffle: float ranges are not supported')
    }
    let values
    if (input.type === 'range') {
      const { min, max } = input.range
      values = []
      for (let i = min; i <= max; i++) values.push(String(i))
    } else {
      values = input.items.slice()
    }
    if (!values.length) return ''
    return shuffleArray(values).join(' ')
  },

  // uniform: numeric uniform in a..b or two numbers a b
  uniform: (input) => {
    let range
    if (input.type === 'range' || input.type === 'floatRange') {
      range = input.range
    } else if (input.items.length === 2) {
      const a = toNumber(input.items[0])
      const b = toNumber(input.items[1])
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('random uniform: need a numeric range')
      range = { min: Math.min(a, b), max: Math.max(a, b), isInt: isInt(a) && isInt(b) }
    } else {
      throw new Error('random uniform: provide range like 1..10 or two numbers')
    }
    if (range.isInt) return String(randInt(range.min, range.max))
    return String(randFloat(range.min, range.max))
  }
}

module.exports = async function (node, args, ctx) {
  let params = (args || '').trim()
  const m = params.match(/^(choices|choice|sample|shuffle|uniform)?\s*(.*)$/)

  let method = 'choice'
  if (m && m[1]) {
    method = m[1]
    params = m[2]
  }

  // Tokenize respecting quotes
  let tokens = tokenize(params)

  // If nothing provided -> error early in read step

  // For choices/sample extract count
  let count = null
  if (method === 'choices' || method === 'sample') {
    if (tokens.length === 0) throw new Error(`random ${method}: count and values are required`)
    count = parseInt(tokens[0], 10)
    if (!Number.isFinite(count) || count < 0) throw new Error(`random ${method}: invalid count`)
    tokens = tokens.slice(1)
  }

  // @name arguments are node references, not files whose lines should be
  // expanded. A processor input node is used for the file/list form:
  //   @{ file/name | random choice }

  // For a list of node references, resolve and return the selected node. This
  // is deliberately done before constructing the text node: callers can keep
  // the selected node's type (image, tool, llm, etc.) rather than getting a
  // string containing its contents.
  if (method === 'choice' && tokens.length > 0 && tokens.every(tok => tok.startsWith('@'))) {
    const selected = tokens[Math.floor(Math.random() * tokens.length)]
    const resolved = await ctx.resolve(selected.slice(1))
    if (!resolved) throw new Error(`random: could not resolve ${selected}`)
    return resolved
  }

  // Determine if we have a single token that is a range
  let singleRange = null
  if (tokens.length === 1) {
    singleRange = parseRange(tokens[0])
  }

  let input
  if (singleRange) {
    input = singleRange.isInt ? { type: 'range', range: singleRange } : { type: 'floatRange', range: singleRange }
  } else {
    // Build items from literal values and integer ranges. @name tokens are
    // handled above as node references and are therefore not file shortcuts.
    const items = []
    for (const tok of tokens) {
      const r = parseRange(tok)
      if (r) {
        if (!r.isInt) throw new Error('random: float ranges cannot be mixed with discrete values')
        for (let i = r.min; i <= r.max; i++) items.push(String(i))
      } else {
        items.push(tok)
      }
    }
    input = { type: 'list', items }
  }

  return {
    type: 'text',
    read: async () => {
      // With the new file syntax the input node supplies the values. Read it
      // lazily so processors retain the normal node lifecycle.
      let currentInput = input
      if (tokens.length === 0 && node) {
        if (node.type !== 'text' || typeof node.read !== 'function') {
          throw new Error('random: input node must be readable text')
        }
        const content = await node.read()
        currentInput = {
          type: 'list',
          items: String(content).split(/\r?\n/).map(s => s.trim()).filter(Boolean)
        }
      }

      if (!currentInput || (currentInput.type === 'list' && currentInput.items.length === 0)) {
        throw new Error('random: no values provided')
      }
      const fn = methods[method]
      if (!fn) throw new Error(`random: unsupported method ${method}`)
      try {
        const result = (method === 'choices' || method === 'sample')
          ? fn(currentInput, { count })
          : fn(currentInput)
        return String(result)
      } catch (e) {
        return `Error: ${e.message}`
      }
    }
  }
}
