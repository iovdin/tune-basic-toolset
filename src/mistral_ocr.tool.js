const path = require('path');

const MIME_TYPES = {
  // Documents → document_url
  '.pdf':   { kind: 'document', mime: 'application/pdf' },
  '.docx':  { kind: 'document', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  '.pptx':  { kind: 'document', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  '.txt':   { kind: 'document', mime: 'text/plain' },
  '.epub':  { kind: 'document', mime: 'application/epub+zip' },
  '.xml':   { kind: 'document', mime: 'application/xml' },
  '.rtf':   { kind: 'document', mime: 'application/rtf' },
  '.odt':   { kind: 'document', mime: 'application/vnd.oasis.opendocument.text' },
  '.bib':   { kind: 'document', mime: 'application/x-bibtex' },
  '.fb2':   { kind: 'document', mime: 'application/x-fictionbook+xml' },
  '.ipynb': { kind: 'document', mime: 'application/x-ipynb+json' },
  '.tex':   { kind: 'document', mime: 'application/x-tex' },
  '.opml':  { kind: 'document', mime: 'text/x-opml' },
  '.1':     { kind: 'document', mime: 'application/x-troff-man' },
  '.man':   { kind: 'document', mime: 'application/x-troff-man' },
  // Images → image_url
  '.jpg':   { kind: 'image', mime: 'image/jpeg' },
  '.jpeg':  { kind: 'image', mime: 'image/jpeg' },
  '.png':   { kind: 'image', mime: 'image/png' },
  '.avif':  { kind: 'image', mime: 'image/avif' },
  '.tiff':  { kind: 'image', mime: 'image/tiff' },
  '.gif':   { kind: 'image', mime: 'image/gif' },
  '.heic':  { kind: 'image', mime: 'image/heic' },
  '.heif':  { kind: 'image', mime: 'image/heif' },
  '.bmp':   { kind: 'image', mime: 'image/bmp' },
  '.webp':  { kind: 'image', mime: 'image/webp' },
};

module.exports = async function mistralOcr({ filename }, ctx) {
  const apiKey = await ctx.read("MISTRAL_KEY");
  if (!apiKey) {
    throw new Error("MISTRAL_KEY is not set");
  }

  const ext = path.extname(filename).toLowerCase();
  const typeInfo = MIME_TYPES[ext];
  if (!typeInfo) {
    throw new Error(`Unsupported file extension: ${ext}`);
  }

  const buf = await ctx.read(filename);
  const base64 = buf.toString('base64');
  const dataUrl = `data:${typeInfo.mime};base64,${base64}`;

  const document = typeInfo.kind === 'image'
    ? { type: 'image_url',    image_url:    dataUrl }
    : { type: 'document_url', document_url: dataUrl };

  const response = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document,
      include_image_base64: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral OCR error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();

  return result.pages.map(page => page.markdown).join("\n\n");
};
