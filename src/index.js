const { tools } = require('tune-fs')

// TODO js tool packages include
module.exports = (...opts) => 
  tools({ ...opts, path: __dirname })

