const Module = require('module')
const load = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'server-only') return {}
  return load.apply(this, arguments)
}
