(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "formula-ast"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("formula-ast"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.formulaAst);
    global.formulaCompiler = mod.exports;
  }
})(this, function (exports, _formulaAst) {
  // Copyright 2015 Peter W Moresi
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.compile = compile;

  function wrapString(s) {
    if (s[0] == "'" && s[s.length - 1] === "'") {
      return s;
    }
    return "String(" + s + ".valueOf())";
  }

  var compiledNumber = 0;

  function compile(exp, mode, namespace, useContext) {
    if (mode === undefined) mode = 1;
    if (namespace === undefined) namespace = "requires.";

    var ast = exp,
        jsCode,
        functionCode,
        f,
        suppress = false,
        precedents = [],
        requires = [];

    // convert to AST when string provided
    if (typeof ast === "string") {
      ast = _formulaAst.parser.parse(exp);
    }

    function printItems(items) {
      return items.map(function (n) {
        return compiler(n);
      }).join(", ");
    }

    function pushRequires(require) {
      if (requires.indexOf(require) === -1) {
        requires.push(require);
      }
    }

    // define a compiler function to handle recurse the AST.
    function compiler(node) {

      var lhs = undefined,
          rhs = undefined;

      // The node is expected to be either an operator, function or a value.
      switch (node.type) {
        case "operator":
          switch (node.subtype) {
            case "prefix-plus":
              return "+" + compiler(node.operands[0]);
            case "prefix-minus":
              return "-" + compiler(node.operands[0]);
            case "infix-add":
              pushRequires("add");
              return namespace + "ADD(" + compiler(node.operands[0]) + "," + compiler(node.operands[1]) + ")";
            case "infix-subtract":
              pushRequires("subtract");
              return namespace + "SUBTRACT(" + compiler(node.operands[0]) + "," + compiler(node.operands[1]) + ")";
            case "infix-multiply":
              pushRequires("multiply");
              return namespace + "MULTIPLY(" + compiler(node.operands[0]) + "," + compiler(node.operands[1]) + ")";
            case "infix-divide":
              pushRequires("divide");
              return namespace + "DIVIDE(" + compiler(node.operands[0]) + "," + compiler(node.operands[1]) + ")";
            case "infix-power":
              pushRequires("power");
              return namespace + "POWER(" + compiler(node.operands[0]) + "," + compiler(node.operands[1]) + ")";
            case "infix-concat":
              lhs = compiler(node.operands[0]);
              rhs = compiler(node.operands[1]);
              pushRequires("concatenate");
              return namespace + "CONCATENATE(" + wrapString(lhs) + ", " + wrapString(rhs) + ")";
            case "infix-eq":
              pushRequires("eq");
              return namespace + "EQ(" + compiler(node.operands[0]) + "," + compiler(node.operands[1]) + ")";
            case "infix-ne":
              pushRequires("ne");
              return namespace + "NE(" + compiler(node.operands[0]) + "," + compiler(node.operands[1]) + ")";
            case "infix-gt":
              pushRequires("gt");
              return namespace + "GT(" + compiler(node.operands[0]) + "," + compiler(node.operands[1]) + ")";
            case "infix-gte":
              pushRequires("gte");
              return namespace + "GTE(" + compiler(node.operands[0]) + "," + compiler(node.operands[1]) + ")";
            case "infix-lt":
              pushRequires("lt");
              return namespace + "LT(" + compiler(node.operands[0]) + "," + compiler(node.operands[1]) + ")";
            case "infix-lte":
              pushRequires("lte");
              return namespace + "LTE(" + compiler(node.operands[0]) + "," + compiler(node.operands[1]) + ")";
          }
          throw TypeException("Unknown operator: " + node.subtype);
        case "group":
          return "(" + compiler(node.exp) + ")";
        case "function":
          switch (node.name.toUpperCase()) {
            case "IF":
              pushRequires("if");
              if (node.args.length > 3) {
                throw Error("IF sent too many arguments.");
              }
              if (node.args.length !== 3) {
                throw Error("IF expects 3 arguments");
              }
              return "((" + compiler(node.args[0]) + ") ?" + compiler(node.args[1]) + " : " + compiler(node.args[2]) + ")";

            case "NOT":
              pushRequires("not");
              if (node.args.length !== 1) {
                throw Error("NOT only accepts one argument");
              }
              return namespace + "NOT(' + compiler( node.args[0] ) + ')";
            case "AND":
              pushRequires("and");
              return namespace + "AND(" + printItems(node.args) + ")";
            case "OR":
              pushRequires("or");
              return namespace + "OR(" + printItems(node.args) + ")";
            case "ABS":
              pushRequires("abs");
              return "ABS(" + compiler(node) + ")";
            case "MIN":
              pushRequires("min");
              return "Math.min(" + printItems(node.args) + ")";
            case "MAX":
              pushRequires("max");
              return "Math.max(" + printItems(node.args) + ")";

            default:
              pushRequires(name);
              return namespace + node.name + "( " + printItems(node.args) + " )";

          }
        case "cell":
          if (typeof precedents !== "undefined" && !suppress) {
            precedents.push(node);
          }

          if (node.subtype === "remote") {
            return "context.get(\"" + node.worksheet + "\", \"" + node.addr + "\")";
          } else {
            return "context.get(\"" + node.addr + "\")";
          }
        case "range":

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

          return "context.range( " + lhs + ", " + rhs + " )";

        case "value":
          switch (node.subtype) {
            case "array":
              return "[" + printItems(node.items) + "]";
            case "string":
              return "'" + node.value.replace(/'/g, "''") + "'";
            case "variable":

              if (precedents && !suppress) {
                precedents.push(node);
              }

              if (node.subtype === "remote-named") {
                return "context.get(\"" + node.worksheet + "\", \"" + node.value + "\")";
              } else {
                return "context.get(\"" + node.value + "\")";
              }

            default:
              return node.value;
          }
      }
    }

    jsCode = compiler(ast);

    switch (mode) {
      case 1:
        var id = compiledNumber++;

        f = Function("context", "requires", "return " + jsCode + "\n//@ sourceURL=formula_function_" + id + ".js" + "// formula: " + exp);

        f.id = id;
        f.exp = exp;
        f.ast = ast;
        f.requires = requires;
        f.precedents = precedents;

        return f;
      case 2:
        return jsCode;
      case 3:

        return "// formula: " + exp + "\nfunction( context, requires) { \n  return " + jsCode + ";\n}";
      case 4:
        return precedents;
      case 5:
        return requires;

    }
  }
});
