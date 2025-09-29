
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

  console.log(params)

  if (!tool || tool.type !== "tool") {
    throw Error(`tool '${toolName}' not found`)
  }

  return {
    ...node,
    type: "text",
    read: async() => tool.exec.call(ctx, params, ctx)
  }
}

// Examples:
// parseCommandLine('command hello world bla bla')
// -> ["command", { text: "hello world bla bla" }]
//
// parseCommandLine('cmd hello=world num=8 text="bla \\"bla"')
// -> ["cmd", { hello: "world", num: 8, text: 'bla "bla' }]
//
// parseCommandLine('cmd')
// -> ["cmd", {}]

function parseCommandLine(input) {
  const s = String(input);
  let i = 0, len = s.length;

  function skipWS() { while (i < len && /\s/.test(s[i])) i++; }

  // 1) Parse leading alphanumeric command
  skipWS();
  const cmdStart = i;
  while (i < len && /[A-Za-z0-9]/.test(s[i])) i++;
  const command = s.slice(cmdStart, i);
  if (!command) return [null, {}];

  // 2) Parse the remainder as args
  skipWS();
  const r = s.slice(i);
  if (!r.trim()) return [command, {}];

  function parseArgs(str) {
    if (!/^\s*[A-Za-z0-9]+=/.test(str)) {
      return { text: str.trim() };
    }

    let j = 0;
    const L = str.length;
    const out = {};

    function skipW() { while (j < L && /\s/.test(str[j])) j++; }

    function parseKey() {
      const start = j;
      while (j < L && str[j] !== '=' && !/\s/.test(str[j])) j++;
      return str.slice(start, j);
    }

    function parseQuotedValue(q) {
      j++; // skip opening quote
      let val = '';
      while (j < L) {
        const ch = str[j++];
        if (ch === '\\') {
          if (j >= L) break;
          const esc = str[j++];
          if (esc === 'n') val += '\n';
          else if (esc === 't') val += '\t';
          else if (esc === 'r') val += '\r';
          else val += esc; // includes \" \\ \'
        } else if (ch === q) {
          return val;
        } else {
          val += ch;
        }
      }
      return val; // best-effort if unclosed
    }

    function parseUnquotedValue() {
      const start = j;
      while (j < L && !/\s/.test(str[j])) j++;
      return str.slice(start, j);
    }

    function coerce(v) {
      if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
      const low = v.toLowerCase();
      if (low === 'true') return true;
      if (low === 'false') return false;
      if (low === 'null') return null;
      return v;
    }

    while (j < L) {
      skipW();
      if (j >= L) break;

      const key = parseKey();
      if (!key) return { text: str.trim() };

      skipW();
      if (j < L && str[j] === '=') {
        j++; // skip '='
        skipW();
        let valueStr = '';
        if (j < L && (str[j] === '"' || str[j] === "'")) {
          valueStr = parseQuotedValue(str[j]);
        } else {
          valueStr = parseUnquotedValue();
        }
        out[key] = coerce(valueStr);
      } else {
        // If a non key=value token appears, treat the whole remainder as text
        return { text: str.trim() };
      }
    }

    return out;
  }

  return [command, parseArgs(r)];
}
