# Formula Compiler

![circleci](https://circleci.com/gh/FormulaPages/compiler.svg?style=shield&circle-token=:circle-token)

Compile spreadsheet formula syntax to a JavaScript function.

## USAGE

    var compiler = require('formula-compiler');
    var data = { SuccessText: "Works!" };
    var context = { get: function(key) { return data[key]; } };
    var myFunction = compiler.compile('IF(TRUE, SuccessText, "Broken")');
    var requirements = myFunction.requires.reduce(function(out, n) { out[n.toUpperCase()] = require('formula-' + n); return out; }, {});
    var result = myFunction(context, requirements)
    console.log(myFunction({ SucessText: 'Works!'}, requirements));
