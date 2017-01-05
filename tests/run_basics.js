var test = require('tape')
var run = require('../lib/compiler').run
var functions = require('../lib/compiler').functions

test('basic tests', function(t) {

  t.plan(8)
  t.equal( run('2=2'), true )
  t.equal( run('2<>2'), false )
  t.equal( run('a=a', { a: 1 }), true )
  t.equal( run('a=b', { a: 1, b: 1 }), true )
  t.equal( run('a<>b', { a: 1, b: 1 }), false )
  t.equal( run('a!b1<>b', { 'a': { b1: 1 }, b: 1 }), false )
  t.equal( run('Tran55Fee<>b', { 'Tran55Fee': 1, b: 1 }), false )
  t.equal( run('@Tran55Fee<>b', { '@Tran55Fee': 1, b: 1 }), false )

})

test('functions should work', function(t) {

  t.plan(5)
  t.equal( run('NUMBERVALUE("2")'), 2 )
  t.equal( run('numbervalue("2,000,000.00")'), 2000000 )

  // all variations of IF should work
  t.equal( run('IF(6, 2)'), 2 )
  t.equal( run('If(6, 2)'), 2 )
  t.equal( run('if(6, 2)'), 2 )

})

test('complex nesting should work', function(t) {
  t.plan(1)
  t.equal(run('2+2=((2-2+2)+(3-1))'), true)
})


test('functions should be there', function(t) {
  t.plan(1)
  t.equal(Object.keys(functions).length > 10, true)
})

test('variable names can include underscore', function(t) {
  t.plan(1)
  t.equal( run('a_1=b_1', { a_1: 1, b_1: 1 }), true )
})

test('scope/sheet names should be supported', function(t) {
  t.plan(3)
  t.equal( run('abc!xyz', { abc: { xyz: 1 } }), 1 )
  t.equal( run('abc_def!xyz', { abc_def: { xyz: 1 } }), 1 )
  t.equal( run("'abc_def'!xyz", { abc_def: { xyz: 1 } }), 1 )
})
