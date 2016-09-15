'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.functions = undefined;
exports.compile = compile;
exports.run = run;

var _parser = require('./parser');

var _functionfoundry = require('functionfoundry');

var FF = _interopRequireWildcard(_functionfoundry);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

// Copyright 2015 Peter W Moresi

var compiledNumber = 0;

var functions = exports.functions = FF;

function compile(exp) {
  var ast = exp,
      jsCode,
      functionCode,
      f,
      suppress = false,
      precedents = [],
      requires = [],
      namespace = 'this.';

  // convert to AST when string provided
  if (typeof ast === 'string') {
    ast = _parser.parser.parse(exp);
  }

  function wrapString(s) {
    if (s[0] == "'" && s[s.length - 1] === "'") {
      return s;
    }
    return '\'' + s + '\'';
  }

  function printFuncs(items) {
    return items.map(function (n) {
      return 'function() { return (' + compiler(n) + ') }.bind(this)';
    }).join(', ');
  }

  function printItems(items) {
    return items.map(function (n) {
      return compiler(n);
    }).join(', ');
  }

  // define a compiler function to handle recurse the AST.
  function compiler(node) {

    var lhs = void 0,
        rhs = void 0;

    // The node is expected to be either an operator, function or a value.
    switch (node.type) {
      case 'operator':
        switch (node.subtype) {
          case 'prefix-plus':
            return namespace + "numbervalue(" + printItems(node.operands) + ")";
          case 'prefix-minus':
            return "-" + namespace + "numbervalue(" + printItems(node.operands) + ")";
          case 'infix-add':
            requires.push('add');
            return namespace + "add(" + printItems(node.operands) + ")";
          case 'infix-subtract':
            requires.push('subtract');
            return namespace + "subtract(" + printItems(node.operands) + ")";
          case 'infix-multiply':
            requires.push('multiply');
            return namespace + "multiply(" + printItems(node.operands) + ")";
          case 'infix-divide':
            requires.push('divide');
            return namespace + "divide(" + printItems(node.operands) + ")";
          case 'infix-power':
            requires.push('power');
            return namespace + 'power(' + printItems(node.operands) + ')';
          case 'infix-concat':
            requires.push('concatenate');
            return namespace + "concatenate(" + printItems(node.operands) + ")";
          case 'infix-eq':
            requires.push('eq');
            return namespace + "eq(" + printItems(node.operands) + ")";
          case 'infix-ne':
            requires.push('ne');
            return namespace + "ne(" + printItems(node.operands) + ")";
          case 'infix-gt':
            requires.push('gt');
            return namespace + "gt(" + printItems(node.operands) + ")";
          case 'infix-gte':
            requires.push('gte');
            return namespace + "gte(" + printItems(node.operands) + ")";
          case 'infix-lt':
            requires.push('lt');
            return namespace + "lt(" + printItems(node.operands) + ")";
          case 'infix-lte':
            requires.push('lte');
            return namespace + "lte(" + printItems(node.operands) + ")";
        }
        throw TypeException("Unknown operator: " + node.subtype);
      case 'group':
        return '(' + compiler(node.exp) + ')';
      case 'function':
        requires.push(node.name.toLowerCase() === 'if' ? 'branch' : node.name.toLowerCase());
        switch (node.name) {
          case 'if':
            return namespace + 'branch( ' + printFuncs(node.args) + ' )';
          case 'and':
          case 'or':
            return namespace + node.name.toLowerCase() + '( ' + printFuncs(node.args) + ' )';
          default:
            return namespace + node.name.toLowerCase() + '( ' + printItems(node.args) + ' )';
        }
      case 'cell':
        if (typeof precedents !== "undefined" && !suppress) {
          precedents.push(node);
        }

        return 'context.get(\"' + node.addr + '\")';

      case 'range':

        if (typeof precedents !== "undefined") {
          precedents.push(node);suppress = true;
        }
        lhs = compiler(node.topLeft);
        rhs = compiler(node.bottomRight);
        suppress = false;

        // anonymous functions are the perfect solution for dynamic ranges but was not immediately obvious to me
        if (node.topLeft.type === "function") {
          lhs = "function() { return (" + lhs + "); }";
        }

        if (node.bottomRight.type === "function") {
          rhs = "function() { return (" + rhs + "); }";
        }

        requires.push('ref');
        return 'this.ref( ' + lhs + ', ' + rhs + ' )';

      case 'value':
        switch (node.subtype) {
          case 'array':
            return '[' + printItems(node.items) + ']';
          case 'string':
            return "'" + node.value.replace(/'/g, "''") + "'";
          case 'variable':

            if (precedents && !suppress) {
              precedents.push(node);
            }

            return 'context.get(\"' + node.value + '\")';

          default:
            return node.value;
        }
    }
  }

  var id = compiledNumber++;

  var compiled = compiler(ast);

  f = new Function('context', '/* formula: ' + exp + ' */\nreturn (' + compiled + ');\n//# sourceURL=formulafoundry_' + id + '\n').bind(functions);

  f.id = id;
  f.exp = exp;
  f.ast = ast;
  f.code = compiled;
  f.precedents = precedents;
  f.requires = requires;

  return f;
}

function run(exp) {
  var locals = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
  var requires = arguments[2];

  var compiled = functions.isfunction(exp) ? exp : compile(exp);
  var r = requires;

  if (typeof requires === 'undefined') {
    r = compiled.requires.reduce(function (out, name) {
      out[name] = functions[name];
      return out;
    }, {});
  }

  // if object without get method
  if (locals.get !== 'function') {
    locals.get = function (propName) {
      return locals[propName];
    };
  }

  return compiled.bind(r)(locals);
}
