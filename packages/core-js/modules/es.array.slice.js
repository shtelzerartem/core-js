var $ = require('../internals/export');
var slice = require('../internals/array-slice');

// `Array.prototype.slice` method
// https://tc39.es/ecma262/#sec-array.prototype.slice
$({ target: 'Array', proto: true, forced: [].slice !== slice }, {
  slice: slice
});
