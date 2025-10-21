module.exports = async function grep({filename, text, regex, regex_flags}, ctx) {
  if (!text && filename) {
    const n = await ctx.resolve(filename)
    if (!n) 
      return `${filename} not found`
    
    text = await n.read()
  }

  if (!text) {
    return "content is empty"
  }

  const r = new RegExp(regex, regex_flags)
  return text.split(/\r?\n/).filter(line => r.test(line)).join("\n").replaceAll("@", "\\@")
}
