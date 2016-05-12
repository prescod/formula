var test = require('tape')
var {compile} = require('../lib/compiler')

test('compiler should pass basic tests', function(t) {

  t.plan(13)

  t.equal(compile('2=2').code, "this.EQ(2, 2)")
  t.equal(compile('2 = 2').code, "this.EQ(2, 2)")
  t.equal(compile('2<>2').code, "this.NE(2, 2)")
  t.equal(compile('2 > 2').code, "this.GT(2, 2)")
  t.equal(compile('2>=2').code, "this.GTE(2, 2)")
  t.equal(compile('2  < 2').code, "this.LT(2, 2)")
  t.equal(compile('2 <=   2').code, "this.LTE(2, 2)")
  t.equal(compile('2+   2').code, "this.ADD(2, 2)")
  t.equal(compile('2   -2').code, "this.SUBTRACT(2, 2)")
  t.equal(compile('2     *2').code, "this.MULTIPLY(2, 2)")
  t.equal(compile('2/2').code, "this.DIVIDE(2, 2)")
  t.equal(compile('2^2').code, "this.POWER(2, 2)")
  t.equal(compile('"a" & "b"').code, "this.CONCATENATE('a', 'b')")

})

test('compiler complex nesting should work', function(t) {
  t.plan(1)

  t.equal(compile('2+2=((2-2+2)+(3-1))').code,
  "this.EQ(this.ADD(2, 2), (this.ADD((this.ADD(this.SUBTRACT(2, 2), 2)), (this.SUBTRACT(3, 1)))))")

})
