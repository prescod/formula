# Formula Compiler

![circleci](https://circleci.com/gh/FormulaPages/formula-compiler.svg?style=shield&circle-token=:circle-token)

Compile formulas to JavaScript functions. See [docs](./Formulas.org) for formula syntax.

## Install

    npm install formula-compiler

## Usage

1. Require the compiler.

    var compiler = require('formula-compiler');

Then you need a data object and a context that supports
a `get` function.

    var data = { SuccessText: "Works!" };
    var context = { get: function(key) { return data[key]; } };

Use the compiler to generate a function.

    var myFunction = compiler.compile('IF(TRUE, SuccessText, "Broken")');

Run the function passing back in the requirements by calling resolve().

    var result = myFunction(context, myFunction.resolve())

## Properties

The function comes with metadata.

The identifier:

    myFunction.id

The abstract syntax tree:

    myFunction.ast

The list of required libraries:

    myFunction.requires

The list of precedents:

    myFunction.precedents
