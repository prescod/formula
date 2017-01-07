# formula

![circleci](https://circleci.com/gh/WebsiteHQ/formula.svg?style=shield&circle-token=:circle-token)

Formula language for Node.js and Browser, modeled after spreadsheets.

## Install

    npm install --save formula

## Usage

1. Require the compiler.

    var compiler = require('formula');

Then you need a data object and a context that supports
a `get` function.

    var data = { successText: "Works!", errorText: "Broken!" };
    var context = { get: function(key) { return data[key]; } };

Use the compiler to generate a function.

    var myFunction = compiler.compile('if(true, successText, errorText)');

Run the function passing back in the requirements by calling resolve().

    var result = myFunction(context, myFunction.resolve())
    
Run the function passing back in the requirements by calling resolve().

    var result = myFunction(context, myFunction.resolve())

Add custom functions:

    compiler.functions.double = function (x){return 2*x}
    var myFunction = compiler.compile('if(true, double(3), double(4))');

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

## dist

The scripts in dist are package for the browser with browserify. They use the namespace of `formula`.
