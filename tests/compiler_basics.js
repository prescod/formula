var test = require('tape')
var {compile} = require('../lib/compiler')

test('compiler should pass basic tests', function(t) {

  t.plan(15)

  t.equal(compile('2=2').code, "this.eq(2, 2)")
  t.equal(compile('-2').code, "-this.numbervalue(2)")
  t.equal(compile('2 = 2').code, "this.eq(2, 2)")
  t.equal(compile('2<>2').code, "this.ne(2, 2)")
  t.equal(compile('2 > 2').code, "this.gt(2, 2)")
  t.equal(compile('2>=2').code, "this.gte(2, 2)")
  t.equal(compile('2  < 2').code, "this.lt(2, 2)")
  t.equal(compile('2 <=   2').code, "this.lte(2, 2)")
  t.equal(compile('2+   2').code, "this.add(2, 2)")
  t.equal(compile('2   -2').code, "this.subtract(2, 2)")
  t.equal(compile('2     *2').code, "this.multiply(2, 2)")
  t.equal(compile('2/2').code, "this.divide(2, 2)")
  t.equal(compile('2^2').code, "this.power(2, 2)")
  t.equal(compile('"a" & "b"').code, "this.concatenate('a', 'b')")
  t.equal(compile('@foo1').code, 'context.get("@foo1")')

})

test('compiler complex nesting should work', function(t) {
  t.plan(1)

  t.equal(compile('2+2=((2-2+2)+(3-1))').code,
  "this.eq(this.add(2, 2), (this.add((this.add(this.subtract(2, 2), 2)), (this.subtract(3, 1)))))")

})
