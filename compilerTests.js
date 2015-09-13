var assert = require("assert");
describe('formulaCompiler', function() {
  describe('#constructor()', function () {
    it('it should be there when you require it', function () {
      var c = require('./lib/formula-compiler');
      assert( typeof c !== undefined, "not there for me");
    });

    it('it should have a compile function', function () {
      var c = require('./lib/formula-compiler').compile;
      assert( typeof c !== undefined, "not there for me");
    });

  });
});
