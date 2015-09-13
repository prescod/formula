var assert = require("assert");
describe('formulaCompiler', function() {
  describe('#constructor()', function () {
    var compiler = require('./lib/formula-compiler'),
        compile = compiler.compile;
    
    it('it should be there when you require it', function () {
      assert( typeof compiler !== undefined, "not there for me");
    });

    it('it should have a compile function', function () {
      assert( typeof compile !== undefined, "not there for me");
    });

    it('it should run simple comparision', function () {
      var f = compile('2=2'),
          requirements = f.requires.reduce(function(out, n) { out[n.toUpperCase()] = require('formula-' + n); return out; }, {});

      assert(f({}, requirements), '2 should be 2');
      
    });

    it('it should run README example', function() {
      var myFunction = compile('IF(TRUE, "Works!", "Broken")');
      var requirements = myFunction.requires.reduce(function(out, n) { out[n.toUpperCase()] = require('formula-' + n); return out; }, {});
     assert(myFunction({}, requirements) === "Works!", "Does not work");
    });
    
    it('it should do basic math', function () {
      var f = compile('1+1=4-2'),
          requirements = f.requires.reduce(function(out, n) { out[n.toUpperCase()] = require('formula-' + n); return out; }, {});

      assert(f({}, requirements), '1+1=4-2 should be true');
      
    });

    it('it should eat arrays', function () {
      var f = compile('{1,1,1;2,2}'),
          requirements = f.requires.reduce(function(out, n) { out[n.toUpperCase()] = require('formula-' + n); return out; }, {}),
          result = f({}, requirements);

      assert(result.length = 2, 'Should have two items.');
      assert(result[0].length = 3, 'First item should have three items.');
      assert(result[1].length = 3, 'Second item should have three items.');
    });
  });
});
