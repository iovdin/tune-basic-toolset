const fs = require('fs').promises;

// Patch tool to apply custom diffs marked with <<<<<<< ORIGINAL and >>>>>>> UPDATED
// More tolerant to whitespace differences on each line and reports per-block success.
module.exports = async function patch({ text, filename }, ctx) {
  if (!text || !filename) {
    return "No patch text or filename provided";
  }

  // Match: <<<<<<< ORIGINAL ... ======= ... >>>>>>> UPDATED
  // Be tolerant to CRLF/LF and optional trailing text/spaces on the markers.
  const patchRegex = /<{6,}\s*ORIGINAL[^\n]*\r?\n([\s\S]*?)=+[^\n]*\r?\n([\s\S]*?)>{6,}\s*UPDATED[^\n]*(?:\r?\n|$)/g;

  const patches = [];
  let m;
  while ((m = patchRegex.exec(text)) !== null) {
    const oldPart = String(m[1]).replace(/^\s*\r?\n+|\r?\n+\s*$/g, "");
    const newPart = String(m[2]).replace(/^\s*\r?\n+|\r?\n+\s*$/g, "");
    patches.push({ oldPart, newPart });
  }

  if (patches.length === 0) {
    return "No valid patch segments found";
  }

  let fileContent = await ctx.read(filename);

  function buildPattern(oldStr) {
    // Escape special regex chars
    let escaped = oldStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Normalize line endings to \r?\n so CRLF/LF both match
    escaped = escaped.replace(/\r?\n/g, "\\r?\\n");
    // Tolerate indentation/space differences (spaces or tabs), zero-or-more
    // Keep newlines strict so structure must still match.
    escaped = escaped.replace(/[ \t]+/g, "[ \\t]*");
    return new RegExp(escaped, "g");
  }

  const totalSegments = patches.length;
  let appliedSegments = 0;
  let totalReplacements = 0;

  for (const { oldPart, newPart } of patches) {
    const re = buildPattern(oldPart);
    let matches = 0;
    fileContent = fileContent.replace(re, () => {
      matches += 1;
      return newPart;
    });
    if (matches > 0) {
      appliedSegments += 1;
      totalReplacements += matches;
    }
  }

  await ctx.write(filename, fileContent);

  if (appliedSegments === 0) {
    return `no matches applied (0/${totalSegments})`;
  }
  if (appliedSegments < totalSegments) {
    return `patched partially (${appliedSegments}/${totalSegments}), replacements: ${totalReplacements}`;
  }
  return `patched (${appliedSegments}/${totalSegments}), replacements: ${totalReplacements}`;
};