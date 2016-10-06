var test = require('tape')
var run = require('../lib/compiler').run
var functions = require('../lib/compiler').functions

test('run should pass basic tests', function(t) {

  t.plan(8)
  t.equal( run('2=2'), true )
  t.equal( run('2<>2'), false )
  t.equal( run('a=a', { a: 1 }), true )
  t.equal( run('a=b', { a: 1, b: 1 }), true )
  t.equal( run('a<>b', { a: 1, b: 1 }), false )
  t.equal( run('a!1<>b', { 'a!1': 1, b: 1 }), false )
  t.equal( run('Tran55Fee<>b', { 'Tran55Fee': 1, b: 1 }), false )
  t.equal( run('@Tran55Fee<>b', { '@Tran55Fee': 1, b: 1 }), false )

})

test('running functions should work', function(t) {

  t.plan(2)
  t.equal( run('NUMBERVALUE("2")'), 2 )
  t.equal( run('numbervalue("2,000,000.00")'), 2000000 )

})

test('run complex nesting should work', function(t) {
  t.plan(1)
  t.equal(run('2+2=((2-2+2)+(3-1))'), true)
})


test('functions should be there', function(t) {
  t.plan(1)
  t.equal(Object.keys(functions).length > 10, true)
})
