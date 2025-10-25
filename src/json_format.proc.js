const path = require('path');

module.exports = async function json_format(node, args, ctx) {
  if (!node) {
    return;
  }
  let response_format = { "type": "json_object" };
  if (args.trim()) {

    let schema = await ctx.resolve(args.trim());
    if (!schema) throw Error(`schema file not found ${args.trim()}`);
    schema = await schema.read();
    response_format = { 
      "type": "json_schema", 
      "json_schema": JSON.parse(schema),
    };
  }
  return {
    ...node,
    exec: async (payload, ctx) => node.exec({ ...payload, response_format }, ctx),
    hookMsg: (msg) => {
      if (msg.content) {
        msg.content = JSON.stringify(text2json(msg.content), null, "  ")
      }
      return msg
    }
  };
};

// text2json.js (CommonJS)
// Lightweight JSON extraction from LLM output.
//
// Exports: function text2json(text)
//
// Strategy:
// 1) Extract candidates from:
//    - Markdown code blocks (```json and others)
//    - Balanced { ... } or [ ... ] segments in text (even if incomplete)
//    - Whole text as fallback
// 2) For each candidate, sanitize JSON-ish into valid JSON:
//    - Strip comments (//, /* */) respecting strings
//    - Convert single-quoted strings to double-quoted
//    - Quote unquoted object keys
//    - Quote unquoted values with spaces or path-like tokens
//    - Remove trailing commas
//    - Auto-close unbalanced braces/brackets
// 3) Try JSON.parse. Collect all successful parses.
//    - If multiple parses succeed, return array of results
//    - If one succeeds, return it
//    - Else return null

function text2json(text) {
  if (typeof text !== 'string') return null;

  // Quick path
  const direct = tryParseJSON(text);
  if (direct.ok) return direct.value;

  const candidates = [
    ...extractMarkdownBlocks(text),
    ...findBalancedJsonSegments(text),
  ];

  // Add entire text as last resort
  candidates.push({ snippet: text, reason: 'entire_text_fallback', complete: false });

  const results = [];
  const seen = new Set();

  for (const c of prioritizeCandidates(candidates)) {
    const attempts = generateSanitizedAttempts(c.snippet);

    for (const attempt of attempts) {
      const parsed = tryParseJSON(attempt);
      if (parsed.ok) {
        const key = stableStringify(parsed.value);
        if (!seen.has(key)) {
          seen.add(key);
          results.push(parsed.value);
        }
      } else {
        // Try with auto-closing unbalanced braces/brackets and trailing comma cleanup
        const closed = autoCloseAndClean(attempt);
        const parsed2 = tryParseJSON(closed);
        if (parsed2.ok) {
          const key = stableStringify(parsed2.value);
          if (!seen.has(key)) {
            seen.add(key);
            results.push(parsed2.value);
          }
        }
      }
      if (results.length > 0) break; // Prefer first success per candidate
    }
    if (results.length > 0) break; // Prefer first successful candidate
  }

  if (results.length === 0) return null;
  if (results.length === 1) return results[0];
  return results;
}

// --------------------------- Candidate extraction ---------------------------

function extractMarkdownBlocks(text) {
  const results = [];

  // ```lang\n...``` blocks (handles unclosed too)
  const blockRe = /```([a-zA-Z0-9 _-]+)?\n([\s\S]*?)```/g;
  let match;
  while ((match = blockRe.exec(text)) !== null) {
    const lang = (match[1] || '').trim().toLowerCase();
    const content = match[2] || '';
    results.push({
      snippet: content,
      reason: `codeblock:${lang || 'unknown'}`,
      complete: true,
      lang,
    });
  }

  // Handle unclosed block at end: ```json\n...EOF
  const openRe = /```([a-zA-Z0-9 _-]+)?\n([\s\S]*)$/;
  const openMatch = text.match(openRe);
  if (openMatch && !/```/.test(openMatch[2])) {
    const lang = (openMatch[1] || '').trim().toLowerCase();
    const content = openMatch[2] || '';
    results.push({
      snippet: content,
      reason: `codeblock_unclosed:${lang || 'unknown'}`,
      complete: false,
      lang,
    });
  }

  return results;
}

function findBalancedJsonSegments(text) {
  const results = [];

  let stack = [];
  let start = -1;
  let inDouble = false;
  let inSingle = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = i + 1 < text.length ? text[i + 1] : '';

    if (inLineComment) {
      if (c === '\n') {
        inLineComment = false;
      }
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (!inSingle && !inDouble) {
      if (c === '/' && next === '/') {
        inLineComment = true;
        i++;
        continue;
      }
      if (c === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
    }

    if (inDouble) {
      if (!escape && c === '"') inDouble = false;
      escape = c === '\\' ? !escape : false;
      continue;
    }
    if (inSingle) {
      if (!escape && c === "'") inSingle = false;
      escape = c === '\\' ? !escape : false;
      continue;
    }

    if (c === '"') {
      inDouble = true;
      escape = false;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      escape = false;
      continue;
    }

    if (c === '{' || c === '[') {
      if (stack.length === 0) start = i;
      stack.push(c);
    } else if (c === '}' || c === ']') {
      if (stack.length > 0) {
        const last = stack[stack.length - 1];
        const expectedOpen = c === '}' ? '{' : '[';
        if (last === expectedOpen) stack.pop();
      }
      if (stack.length === 0 && start !== -1) {
        results.push({
          snippet: text.slice(start, i + 1),
          reason: 'balanced_segment',
          complete: true,
        });
        start = -1;
      }
    }
  }

  if (stack.length > 0 && start !== -1) {
    results.push({
      snippet: text.slice(start),
      reason: 'balanced_segment_incomplete',
      complete: false,
    });
  }

  return results;
}

function prioritizeCandidates(candidates) {
  // Prefer json-tagged code blocks, then any code blocks, then balanced segments, then fallback
  return candidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
}

function scoreCandidate(c) {
  let score = 0;
  if (c.reason.startsWith('codeblock')) score += 5;
  if (c.lang === 'json') score += 5;
  if (c.reason.includes('balanced_segment')) score += 3;
  if (c.complete) score += 2;
  return score;
}

// ----------------------------- Sanitization --------------------------------

function generateSanitizedAttempts(snippet) {
  const trimmed = snippet.trim().replace(/^\uFEFF/, '');
  const attempts = [];

  // Attempt 1: minimal cleanup (comments + trailing commas)
  {
    let s = stripComments(trimmed);
    s = removeTrailingCommas(s);
    attempts.push(s);
  }

  // Attempt 2: full jsonish fixing
  {
    let s = jsonishFix(trimmed);
    s = removeTrailingCommas(s);
    attempts.push(s);
  }

  // Attempt 3: full jsonish + autoclose
  {
    let s = jsonishFix(trimmed);
    s = autoCloseAndClean(s);
    attempts.push(s);
  }

  return attempts;
}

function stripComments(input) {
  let out = '';
  let inDouble = false;
  let inSingle = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escape = false;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const next = input[i + 1];

    if (inLineComment) {
      if (c === '\n') {
        inLineComment = false;
        out += c;
      }
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (!inSingle && !inDouble) {
      if (c === '/' && next === '/') {
        inLineComment = true;
        i++;
        continue;
      }
      if (c === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
    }

    out += c;

    if (inDouble) {
      if (!escape && c === '"') inDouble = false;
      escape = c === '\\' ? !escape : false;
    } else if (inSingle) {
      if (!escape && c === "'") inSingle = false;
      escape = c === '\\' ? !escape : false;
    } else {
      if (c === '"') {
        inDouble = true;
        escape = false;
      } else if (c === "'") {
        inSingle = true;
        escape = false;
      }
    }
  }
  return out;
}

function removeTrailingCommas(s) {
  // Remove trailing comma before } or ]
  return s.replace(/,(\s*[}\]])/g, '$1');
}

function jsonishFix(input) {
  // Full pass: convert single quotes, quote unquoted keys, quote unquoted values, strip comments.
  const noComments = stripComments(input);
  // Convert single-quoted strings to double-quoted strings
  const singlesFixed = convertSingleQuotedStrings(noComments);

  // One pass state machine to quote keys and values where needed
  const normalized = quoteKeysAndValues(singlesFixed);

  return normalized;
}

function convertSingleQuotedStrings(s) {
  let out = '';
  let inDouble = false;
  let inSingle = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (inDouble) {
      out += c;
      if (!escape && c === '"') inDouble = false;
      escape = c === '\\' ? !escape : false;
      continue;
    }
    if (inSingle) {
      if (!escape && c === "'") {
        inSingle = false;
        out += '"';
      } else if (!escape && c === '"') {
        out += '\\"';
      } else if (c === '\\') {
        // Keep escapes inside single quotes; next char is escaped
        out += '\\';
      } else {
        out += c;
      }
      escape = c === '\\' ? !escape : false;
      continue;
    }

    if (c === '"') {
      inDouble = true;
      out += c;
      escape = false;
    } else if (c === "'") {
      inSingle = true;
      out += '"';
      escape = false;
    } else {
      out += c;
    }
  }

  // If dangling single-quoted string (unlikely), close it
  if (inSingle) out += '"';
  return out;
}

function quoteKeysAndValues(s) {
  // State machine through objects/arrays to:
  // - Quote unquoted keys in objects
  // - Quote unquoted values with spaces or path-like tokens
  let out = '';
  const ctxStack = []; // 'object' | 'array'
  let inString = false;
  let escape = false;
  let expectingKey = false; // valid only when top ctx is object
  let expectingValue = false;
  let i = 0;

  function top() {
    return ctxStack.length ? ctxStack[ctxStack.length - 1] : null;
  }

  function skipWhitespace(idx) {
    while (idx < s.length && /\s/.test(s[idx])) idx++;
    return idx;
  }

  function readUntilColon(idx) {
    // Read raw key until first colon at this nesting level (ignores quotes)
    let buf = '';
    let inD = false, esc = false;
    for (; idx < s.length; idx++) {
      const ch = s[idx];
      if (inD) {
        buf += ch;
        if (!esc && ch === '"') inD = false;
        esc = ch === '\\' ? !esc : false;
        continue;
      }
      if (ch === '"') {
        inD = true;
        buf += ch;
        esc = false;
        continue;
      }
      if (ch === ':') {
        return { keyRaw: buf, nextIdx: idx + 1 };
      }
      // guard: if we hit { or [ or } or ] or comma/newline before colon, abort
      if (ch === '{' || ch === '[' || ch === '}' || ch === ']' || ch === ','
          || ch === '\n') {
        return null;
      }
      buf += ch;
    }
    return null;
  }

  function emitQuotedString(str) {
    return JSON.stringify(str);
  }

  function quoteKeyIfNeeded(idx) {
    // Assumes s[idx] at start of key position
    let j = skipWhitespace(idx);
    const ch = s[j];

    if (ch === '"') {
      // Already quoted
      // Copy through quoted string
      let buf = '';
      let inD = true, esc = false;
      for (; j < s.length; j++) {
        const c = s[j];
        buf += c;
        if (inD) {
          if (!esc && c === '"') { inD = false; j++; break; }
          esc = c === '\\' ? !esc : false;
        }
      }
      out += buf;
      // Expect colon next (copy it and move on)
      let k = skipWhitespace(j);
      if (s[k] === ':') {
        out += s.slice(j, k + 1);
        return k + 1;
      } else {
        // If colon missing, just return next
        return j;
      }
    } else if (ch === '}' || ch === undefined) {
      // Empty object or invalid
      out += s[idx];
      return idx + 1;
    } else {
      // Unquoted key: read until colon
      const res = readUntilColon(j);
      if (!res) {
        // Fallback: pass-through char and move on
        out += s[idx];
        return idx + 1;
      }
      const keyRaw = res.keyRaw;
      // Trim whitespace
      const key = keyRaw.trim();
      // If key already looks like "something", retain inner; else quote raw key text
      let quoted = '';
      if (key.startsWith('"') && key.endsWith('"')) {
        quoted = key;
      } else {
        // Strip any trailing commas/spaces in raw accumulation
        const cleaned = key.replace(/\s+$/g, '');
        quoted = emitQuotedString(unquoteIfQuoted(cleaned));
      }
      out += quoted + ':';
      return res.nextIdx;
    }
  }

  function unquoteIfQuoted(k) {
    const t = k.trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    return t;
  }

  function quoteValueIfNeeded(idx) {
    let j = skipWhitespace(idx);
    const ch = s[j];

    if (ch === '"') {
      // Already a string
      // copy until end of string
      let inD = true, esc = false;
      for (; j < s.length; j++) {
        const c = s[j];
        out += c;
        if (inD) {
          if (!esc && c === '"') { inD = false; j++; break; }
          esc = c === '\\' ? !esc : false;
        }
      }
      return j;
    }
    if (ch === '{' || ch === '[') {
      // Nested structure, let main loop handle
      out += ch;
      return j + 1;
    }
    if (ch === 't' && s.slice(j, j + 4) === 'true') { out += 'true'; return j + 4; }
    if (ch === 'f' && s.slice(j, j + 5) === 'false') { out += 'false'; return j + 5; }
    if (ch === 'n' && s.slice(j, j + 4) === 'null') { out += 'null'; return j + 4; }

    // Number?
    const numMatch = s.slice(j).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (numMatch) {
      out += numMatch[0];
      return j + numMatch[0].length;
    }

    // Bareword/path-like or with spaces: read until comma or } or ]
    // Respect basic string quoting inside by stopping at quotes (we'll leave them for main loop)
    let k = j;
    let buf = '';
    while (k < s.length) {
      const c = s[k];
      if (c === ',' || c === '}' || c === ']' || c === '\n') break;
      if (c === '"' || c === "'") break;
      buf += c;
      k++;
    }
    const val = buf.trim();
    if (val.length > 0) {
      out += emitQuotedString(val);
      return k;
    }

    // Fallback: output the character and advance
    out += s[j] || '';
    return j + 1;
  }

  while (i < s.length) {
    const c = s[i];

    if (inString) {
      out += c;
      if (!escape && c === '"') {
        inString = false;
      }
      escape = c === '\\' ? !escape : false;
      i++;
      continue;
    }

    if (c === '"') {
      inString = true;
      escape = false;
      out += c;
      i++;
      continue;
    }

    if (c === '{') {
      ctxStack.push('object');
      expectingKey = true;
      out += c;
      i++;
      continue;
    }
    if (c === '[') {
      ctxStack.push('array');
      expectingValue = true;
      out += c;
      i++;
      continue;
    }
    if (c === '}') {
      ctxStack.pop();
      expectingKey = (top() === 'object'); // next in outer object we expect key after comma
      out += c;
      i++;
      continue;
    }
    if (c === ']') {
      ctxStack.pop();
      expectingValue = (top() === 'array');
      out += c;
      i++;
      continue;
    }
    if (c === ':') {
      expectingKey = false;
      expectingValue = true;
      out += c;
      i++;
      continue;
    }
    if (c === ',') {
      if (top() === 'object') {
        expectingKey = true;
        expectingValue = false;
      } else if (top() === 'array') {
        expectingValue = true;
      }
      out += c;
      i++;
      continue;
    }

    if (top() === 'object' && expectingKey) {
      i = quoteKeyIfNeeded(i);
      // After quoteKeyIfNeeded, we are positioned after colon or advanced minimally
      // expectingValue should be true if colon was handled
      // Heuristic: if last char written was ':', set expectingValue
      if (out.length > 0 && out[out.length - 1] === ':') expectingValue = true;
      continue;
    }

    if ((top() === 'object' && expectingValue) || (top() === 'array' && expectingValue)) {
      i = quoteValueIfNeeded(i);
      // After value, we wait for comma or close
      expectingValue = false;
      continue;
    }

    // Default: copy char
    out += c;
    i++;
  }

  return out;
}

function autoCloseAndClean(s) {
  // Remove trailing commas before attempting to close
  s = removeTrailingCommas(s);

  // Auto-close brackets/braces
  const closers = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (!escape && c === '"') inString = false;
      escape = c === '\\' ? !escape : false;
      continue;
    }
    if (c === '"') {
      inString = true;
      escape = false;
      continue;
    }
    if (c === '{') closers.push('}');
    else if (c === '[') closers.push(']');
    else if (c === '}' || c === ']') {
      const last = closers[closers.length - 1];
      if ((c === '}' && last === '}') || (c === ']' && last === ']')) {
        closers.pop();
      } else {
        // Mismatch; ignore
      }
    }
  }

  // Remove trailing comma before closing we will append
  s = s.replace(/,\s*$/, '');

  return s + closers.reverse().join('');
}

// ------------------------------ Utilities ----------------------------------

function tryParseJSON(s) {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch {
    return { ok: false, value: null };
  }
}

function stableStringify(v) {
  // Basic stable stringify for dedupe
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const keys = Object.keys(v).sort();
    const obj = {};
    for (const k of keys) obj[k] = v[k];
    return JSON.stringify(obj, (_, val) =>
      val && typeof val === 'object' && !Array.isArray(val)
        ? Object.keys(val).sort().reduce((acc, kk) => (acc[kk] = val[kk], acc), {})
        : val
    );
  }
  return JSON.stringify(v);
}
