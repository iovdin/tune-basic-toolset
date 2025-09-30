module.exports = async function message({ filename, system, text, stop, save, ...args }, ctx) {
  if (typeof(save) === "undefined") {
    save = !!filename
  }
  return ctx.file2run({ stop, filename, system, user: text, save }, args, ctx)
}
