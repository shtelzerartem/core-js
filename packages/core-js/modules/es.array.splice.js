var $ = require('../internals/export');
var splice = require('../internals/array-splice');

// `Array.prototype.splice` method
// https://tc39.es/ecma262/#sec-array.prototype.splice
$({ target: 'Array', proto: true, forced: [].splice !== splice }, {
  splice: splice
});
