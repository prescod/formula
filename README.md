# Formula Compiler

Compile a spreadsheet formula to JavaScript that accepts a context.

The context object must have a "get" function to access internal state.

This function works with workbook.fn or formula.js.

## USAGE

    var compiler = require('formula-compiler');
    var myFunction = compiler.compile('IF(TRUE, "Works!", "Broken")');
    console.log(myFunction());

The compiler supports 4 modes:

1.  Compile function (default)
2.  Code
3.  Code wrapped in function
4.  List of precedents
