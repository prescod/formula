# FormulaFoundry

![circleci](https://circleci.com/gh/FunctionFoundry/formulafoundry.svg?style=shield&circle-token=:circle-token)

Formula language for Node.js and Browser. See [docs](./Formulas.org) for language syntax.

## Install

    npm install --save formulafoundry

## Usage

1. Require the compiler.

    var compiler = require('formulafoundry');

Then you need a data object and a context that supports
a `get` function.

    var data = { successText: "Works!", errorText: "Broken!" };
    var context = { get: function(key) { return data[key]; } };

Use the compiler to generate a function.

    var myFunction = compiler.compile('if(true, successText, errorText)');

Run the function passing back in the requirements by calling resolve().

    var result = myFunction(context, myFunction.resolve())

## Properties

The function includes properties:

The identifier:

    myFunction.id

The abstract syntax tree:

    myFunction.ast

The list of required functions:

    myFunction.requires

The list of precedents:

    myFunction.precedents
