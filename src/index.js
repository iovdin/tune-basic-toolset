const { tools } = require('tune-fs')
const man = require('tune-sdk/man')

module.exports = (opts = {}) => {
  man.addPackage(__dirname)
  return tools({ ...opts, path: __dirname })
}

