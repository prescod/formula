# Formula Compiler

![circleci](https://circleci.com/gh/FormulaPages/compiler.svg?style=shield&circle-token=:circle-token)

Compile spreadsheet formula syntax to a JavaScript function.

## Install

    npm install formula-compiler

## Usage

First you must require the compiler.

    var compiler = require('formula-compiler');

Then you need a data object and a context that supports
a `get` function.

    var data = { SuccessText: "Works!" };
    var context = { get: function(key) { return data[key]; } };

Use the compiler to generate a function.

    var myFunction = compiler.compile('IF(TRUE, SuccessText, "Broken")');

Run the function passing back in the requirements.

    var result = myFunction(context, myFunction.requires)

## Properties

The function has properties with metadata.

You can gain access to the list of precedents:

    myFunction.precedents

The identifier:

    myFunciton.id

The abstract syntax tree:

    myFunction.ast

The list of required function names:

    myFunction.requirements

Or an array of the required functions (used to run it):

    myFunction.requires
