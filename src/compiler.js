// Copyright 2015 Peter W Moresi

import {parser} from './parser'
import * as FF from 'functionfoundry'

var compiledNumber = 0;

export function compile(exp) {
  var ast = exp,
      jsCode,
      functionCode,
      f,
      suppress = false,
      precedents = [],
      requires = [],
      namespace='this.';

  // convert to AST when string provided
  if (typeof ast === 'string') {
    ast = parser.parse(exp);
  }

  function wrapString(s) {
    if (s[0] == "'" && s[s.length-1] === "'") {
      return s;
    }
    return '\'' + s + '\'';
  }

  function printItems(items) {
    return items.map(function(n){
      return compiler( n );
    }).join(', ')
  }

  // define a compiler function to handle recurse the AST.
  function compiler( node ) {

    let lhs, rhs;

    // The node is expected to be either an operator, function or a value.
    switch(node.type) {
      case 'operator':
        switch(node.subtype) {
          case 'prefix-plus':
            return '+' + compiler( node.operands[0] );
          case 'prefix-minus':
            return '-' + compiler( node.operands[0] );
          case 'infix-add':
            requires.push('add');
            return namespace + "ADD(" + compiler( node.operands[0] ) + ', ' +
                   compiler( node.operands[1]) + ")";
          case 'infix-subtract':
            requires.push('subtract');
            return (namespace + "SUBTRACT(" + compiler( node.operands[0] ) + ', ' +
                    compiler( node.operands[1]) + ")");
          case 'infix-multiply':
            requires.push('multiply');
            return (namespace + "MULTIPLY(" + compiler( node.operands[0] ) + ', ' +
                    compiler( node.operands[1]) + ")");
          case 'infix-divide':
            requires.push('divide');
            return (namespace + "DIVIDE(" + compiler( node.operands[0] ) + ', ' +
                    compiler( node.operands[1]) + ")");
          case 'infix-power':
            requires.push('power');
            return (namespace + 'POWER(' + compiler( node.operands[0] ) + ', '
                  + compiler( node.operands[1] ) + ')');
          case 'infix-concat':
            lhs = compiler( node.operands[0] );
            rhs = compiler( node.operands[1] );
            requires.push('concatenate');
            return namespace + "CONCATENATE(" + wrapString(lhs) + ', ' + wrapString(rhs) + ")";
          case 'infix-eq':
            requires.push('eq');
            return (namespace + "EQ(" + compiler( node.operands[0] ) + ', ' +
                    compiler( node.operands[1]) + ")");
          case 'infix-ne':
            requires.push('ne');
            return (namespace + "NE(" + compiler( node.operands[0] ) + ', ' +
                    compiler( node.operands[1]) + ")");
          case 'infix-gt':
            requires.push('gt');
            return (namespace + "GT(" + compiler( node.operands[0] ) + ', ' +
                    compiler( node.operands[1]) + ")");
          case 'infix-gte':
            requires.push('gte');
            return (namespace + "GTE(" + compiler( node.operands[0] ) + ', ' +
                    compiler( node.operands[1]) + ")");
          case 'infix-lt':
            requires.push('lt');
            return (namespace + "LT(" + compiler( node.operands[0] ) + ', ' +
                    compiler( node.operands[1]) + ")");
          case 'infix-lte':
            requires.push('lte');
            return (namespace + "LTE(" + compiler( node.operands[0] ) + ', ' +
                    compiler( node.operands[1]) + ")");
        }
        throw TypeException("Unknown operator: " + node.subtype);
      case 'group':
        return ('(' +  compiler( node.exp ) + ')');
      case 'function':
          requires.push(node.name.toUpperCase());
          return (namespace + node.name.toUpperCase() + '( ' + printItems(node.args) + ' )');
      case 'cell':
        if (typeof precedents !== "undefined" && !suppress) { precedents.push(node); }

        return 'context.get(\"' + node.addr + '\")';

      case 'range':

        if (typeof precedents !== "undefined") { precedents.push(node); suppress = true; }
        lhs = compiler(node.topLeft);
        rhs = compiler(node.bottomRight);
        suppress = false;

        // anonymous functions are the perfect solution for dynamic ranges but was not immediately obvious to me
        if ( node.topLeft.type === "function" ) {
          lhs = "function() { return (" + lhs + "); }"
        }

        if ( node.bottomRight.type === "function" ) {
          rhs = "function() { return (" + rhs + "); }"
        }

        return ('context.range( ' + lhs + ', ' + rhs + ' )' );

      case 'value':
        switch (node.subtype) {
          case 'array':
            return ('[' + printItems(node.items) + ']');
          case 'string':
            return "'" + node.value.replace(/'/g, "''") + "'";
          case 'variable':

            if (precedents && !suppress) { precedents.push(node); }

            return 'context.get(\"' + node.value + '\")';

          default:
            return node.value;
        }
    }
  }

  var id = compiledNumber++;

  var compiled = compiler(ast);

  f = new Function('context', `// ${exp}
  return (${compiled});
  //@ sourceURL=formula_function_${id}.js'
  `);

  f.id = id;
  f.exp = exp;
  f.ast = ast;
  f.code = compiled;
  f.precedents = precedents;
  f.requires = requires;

  return f

}

export function run(exp, locals={}, requires) {
  var compiled = compile(exp);
  var requirements = requires;
  //
  if (typeof requires === 'undefined') {
    requirements = compiled.requires.map(n => n.toUpperCase())
      .reduce( function(out, name) {
        out[name] = FF[name];
        return out;
      }, {} );
  }

  // if object without get method
  if (locals.get !== 'function') {
    locals.get = (propName) => locals[propName]
  }

  return compiled.bind(requirements)(locals)
}
