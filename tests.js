var assert = require("assert");
describe('formulaCompiler', function() {
  describe('#constructor()', function () {
    var compiler = require('./compiler').default

    function run(f, c) {
      // load requirements from libraries.
      //var requires = f.resolve();
      return f(c, requires );
    }

    it('it should be there when you require it', function () {
      assert( typeof compiler !== undefined, "not there for me");
    });


    it('it should generate code like...', function() {

      assert( compiler('2=2').code === "requires.EQ(2, 2)", "EQ" );
      assert( compiler('2<>2').code === "requires.NE(2, 2)", "NE" );
      assert( compiler('2>2').code === "requires.GT(2, 2)", "GT" );
      assert( compiler('2>=2').code === "requires.GTE(2, 2)", "GTE" );
      assert( compiler('2<2').code === "requires.LT(2, 2)", "LT" );
      assert( compiler('2<=2').code === "requires.LTE(2, 2)", "LTE" );
      assert( compiler('2^2').code === "requires.POWER(2, 2)", "POWER. " );
      assert( compiler('2+2').code === "requires.ADD(2, 2)", "ADD" );
      assert( compiler('2-2').code === "requires.SUBTRACT(2, 2)", "SUBTRACT" );
      assert( compiler('2*2').code === "requires.MULTIPLY(2, 2)", "MULTIPLY" );
      assert( compiler('2/2').code === "requires.DIVIDE(2, 2)", "DIVIDE" );
      assert( compiler('"2" & "2"').code === "requires.CONCATENATE('2', '2')", "CONCATENATE" );

    });

    it('it should run a simple comparision', function () {
      var f = compiler('2=2');
      assert(run(f), '2 should be 2');
    });

    it('it should run README example', function() {
      var data = { SuccessText: "Works!" };
      var context = { get: function(k) { return data[k]; } };
      var myFormula = compiler.compiler('IF(TRUE, SuccessText, "Broken")');
      var result = myFormula(context)

      assert(result === "Works!", "Does not work. Result: " + result);
    });

    it('it should do basic math', function () {
      var f = compiler('1+1=4-2');

      assert(run(f), '1+1=4-2 should be true');

    });

    it('it should eat arrays for breakfast', function () {
      var f = compiler('{1,1,1;2,2}'),
          result = run(f);

      assert(result.length = 2, 'Should have two items.');
      assert(result[0].length = 3, 'First item should have three items.');
      assert(result[1].length = 3, 'Second item should have three items.');
    });
  });
});
