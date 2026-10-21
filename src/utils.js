function parseArgs(str) {
  if (!/^\s*[_$A-Za-z0-9]+=/.test(str)) {
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
  while (i < len && /[A-Za-z0-9_\-]/.test(s[i])) i++;
  const command = s.slice(cmdStart, i);
  if (!command) return [null, {}];

  // 2) Parse the remainder as args
  skipWS();
  const r = s.slice(i);
  if (!r.trim()) return [command, {}];


  return [command, parseArgs(r)];
}
// Cost values retain their source units. Only an explicit template multiplier
// (e.g. %C:100.2) converts units; parsing reverses that multiplier.
const usageFields = {
  i: { key: 'input', path: ['prompt_tokens'] },
  o: { key: 'output', path: ['completion_tokens'] },
  c: { key: 'cache', path: ['prompt_tokens_details', 'cached_tokens'] },
  t: { key: 'total', path: ['total_tokens'] },
  a: { key: 'audio', path: ['completion_tokens_details', 'audio_tokens'] },
  v: { key: 'video', path: ['completion_tokens_details', 'video_tokens'] },
  C: { key: 'cents', path: ['cost'] },
  T: { key: 'total_cost', path: ['total_cost'] },
  D: { key: 'daily_cost', path: ['daily_cost'] },
  M: { key: 'monthly_cost', path: ['monthly_cost'] },
};
const usageSuffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

// Grammar: %field, %field:h, %field:.precision, %field:multiplier.precision.
// Multipliers are positive integers; precision is 0..100.
// Escape literal percent/brackets using %%, \\[ and \\].
function usageTemplate(template) {
  if (typeof template !== 'string') throw new TypeError('Usage template must be a string');
  let index = 0;

  function section(optional) {
    const nodes = [];
    function literal(text) {
      const previous = nodes[nodes.length - 1];
      if (previous && previous.type === 'literal') previous.text += text;
      else nodes.push({ type: 'literal', text });
    }

    while (index < template.length) {
      const ch = template[index];
      if (ch === '\\' && /[\[\]\\]/.test(template[index + 1] || '')) {
        literal(template[index + 1]);
        index += 2;
      } else if (ch === '[') {
        index++;
        nodes.push({ type: 'optional', nodes: section(true) });
      } else if (ch === ']') {
        if (!optional) throw new SyntaxError(`Unexpected ] at ${index}`);
        index++;
        return nodes;
      } else if (ch === '%' && template[index + 1] === '%') {
        literal('%');
        index += 2;
      } else if (ch === '%') {
        const field = template[index + 1];
        if (!Object.prototype.hasOwnProperty.call(usageFields, field)) {
          throw new SyntaxError(`Unknown usage placeholder at ${index}`);
        }
        index += 2;
        const node = { type: 'field', field, compact: false, multiplier: 1 };
        if (template[index] === ':') {
          const format = /^:(h|([0-9]*)\.([0-9]+))/.exec(template.slice(index));
          if (!format) throw new SyntaxError(`Invalid usage format at ${index}`);
          index += format[0].length;
          if (format[1] === 'h') node.compact = true;
          else {
            node.multiplier = format[2] === '' ? 1 : Number(format[2]);
            node.precision = Number(format[3]);
            if (!Number.isSafeInteger(node.multiplier) || node.multiplier <= 0) {
              throw new RangeError('Usage multiplier must be a positive safe integer');
            }
            if (node.precision > 100) throw new RangeError('Usage precision must be 0..100');
          }
        }
        nodes.push(node);
      } else {
        literal(ch);
        index++;
      }
    }
    if (optional) throw new SyntaxError('Unclosed optional usage section');
    return nodes;
  }

  return section(false);
}

function usageValue(usage, field) {
  const { key, path } = usageFields[field];
  let value = usage;
  for (const part of path) value = value == null ? undefined : value[part];
  // Also accept the flat object returned by usageParse (including `cents`).
  if (value == null) value = usage[key];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`Usage field %${field} must be a finite number`);
  }
  return value;
}

function usageCompact(value) {
  if (Math.abs(value) < 1000) return String(value);
  const tier = Math.min(Math.floor(Math.log10(Math.abs(value)) / 3), usageSuffixes.length - 1);
  const scaled = value / Math.pow(10, tier * 3);
  return scaled.toFixed(Math.abs(scaled) < 10 ? 1 : 0) + usageSuffixes[tier];
}

/** Render an OpenRouter usage object (or flat parsed values) with a template.
 * Missing required fields render as empty strings. Optional sections are
 * omitted if any field anywhere inside them is missing, null or zero.
 */
function usageRender(template, usage = {}) {
  usage = usage || {};
  const nodes = usageTemplate(template);

  function present(nodes) {
    return nodes.every(node => {
      if (node.type === 'optional') return present(node.nodes);
      if (node.type !== 'field') return true;
      const value = usageValue(usage, node.field);
      return value !== null && value !== 0;
    });
  }

  function render(nodes) {
    return nodes.map(node => {
      if (node.type === 'literal') return node.text;
      if (node.type === 'optional') return present(node.nodes) ? render(node.nodes) : '';
      const value = usageValue(usage, node.field);
      if (value === null) return '';
      if (node.compact) return usageCompact(value);
      if (node.precision === undefined) return String(value);
      const scaled = value * node.multiplier;
      if (!Number.isFinite(scaled)) throw new RangeError('Scaled usage value is not finite');
      return scaled.toFixed(node.precision);
    }).join('');
  }

  return render(nodes);
}

/** Parse rendered text using its template. Returns flat values, or null if the
 * text does not match. Omitted fields are absent. Compact/rounded values are
 * necessarily lossy; multipliers are reversed. Repeated fields use the last
 * present occurrence. Adjacent numbers need literal separators to be unambiguous.
 */
function usageParse(template, text) {
  if (typeof text !== 'string') throw new TypeError('Rendered usage must be a string');
  const nodes = usageTemplate(template);
  const captures = [];
  const number = '[+-]?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?';
  const suffix = '(?:Qa|Qi|Sx|Sp|Oc|No|Dc|K|M|B|T)?';

  function pattern(nodes) {
    return nodes.map(node => {
      if (node.type === 'literal') return node.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (node.type === 'optional') return '(?:' + pattern(node.nodes) + ')?';
      captures.push(node);
      return '(' + number + (node.compact ? suffix : '') + ')?';
    }).join('');
  }

  // (?![\\s\\S]) is a strict end-of-input assertion, unlike $ before a newline.
  const match = new RegExp('^' + pattern(nodes) + '(?![\\s\\S])').exec(text);
  if (!match) return null;
  const values = {};
  for (let i = 0; i < captures.length; i++) {
    const raw = match[i + 1];
    if (raw === undefined) continue;
    const node = captures[i];
    let value;
    if (node.compact) {
      const parts = new RegExp('^(' + number + ')(' + suffix + ')$').exec(raw);
      const tier = usageSuffixes.indexOf(parts[2]);
      value = Number(parts[1]) * Math.pow(10, tier * 3);
    } else {
      value = Number(raw) / node.multiplier;
      // Undo display rounding at the precision implied by the multiplier.
      // toFixed also avoids exposing floating-point division artifacts.
      if (node.precision !== undefined) {
        const sourcePrecision = node.precision + Math.ceil(Math.log10(node.multiplier));
        value = Number(value.toFixed(Math.min(sourcePrecision, 100)));
      }
    }
    if (!Number.isFinite(value)) return null;
    values[usageFields[node.field].key] = value;
  }
  return values;
}

module.exports = { parseCommandLine, parseArgs, usageParse, usageRender }
