# Formula Compiler

![circleci](https://circleci.com/gh/FormulaPages/compiler.svg?style=shield&circle-token=:circle-token)

Compile a spreadsheet formula to JavaScript that accepts a context.

The context object must have a "get" function to access your workbook state.

## USAGE

    var compiler = require('formula-compiler');
    var myFunction = compiler.compile('IF(TRUE, "Works!", "Broken")');
    var requirements = myFunction.requires.reduce(function(out, n) { out[n.toUpperCase()] = require('formula-' + n); return out; }, {});
    console.log(myFunction({}, requirements));

The compiler supports 4 modes:

1. Compile function (default)
2. Code
3. Code wrapped in function
4. List of precedents
5. List of requirements (functions used by formula)
