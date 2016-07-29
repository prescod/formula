var test = require('tape')


test('compiler should eat array for breakfast', function(t) {
  var compile = require('../lib/compiler').compile
  t.plan(2)

  t.equal( compile('{2,2}').code, "[2, 2]")
  t.equal( compile('{2;2}').code, "[[2], [2]]")
});
