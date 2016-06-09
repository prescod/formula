(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
if (window) {
  window.FormulaFoundry = require('./lib/compiler')
}

},{"./lib/compiler":2}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.compile = compile;
exports.run = run;

var _parser = require('./parser');

var _functionfoundry = require('functionfoundry');

var FF = _interopRequireWildcard(_functionfoundry);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

// Copyright 2015 Peter W Moresi

var compiledNumber = 0;

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
            return namespace + "-numbervalue(" + printItems(node.operands) + ")";
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
        requires.push(node.name.toLowerCase());
        return namespace + node.name.toLowerCase() + '( ' + printItems(node.args) + ' )';
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

        return 'context.range( ' + lhs + ', ' + rhs + ' )';

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

  f = new Function('context', '// ' + exp + '\n  return (' + compiled + ');\n  //@ sourceURL=formula_function_' + id + '.js\'\n  ');

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

  var compiled = compile(exp);
  var requirements = requires;

  if (typeof requires === 'undefined') {
    requirements = compiled.requires.reduce(function (out, name) {
      out[name] = FF[name];
      return out;
    }, {});
  }

  // if object without get method
  if (locals.get !== 'function') {
    locals.get = function (propName) {
      return locals[propName];
    };
  }

  console.log(compiled.requires, requirements);

  return compiled.bind(requirements)(locals);
}

},{"./parser":3,"functionfoundry":5}],3:[function(require,module,exports){
(function (process){
/* parser generated by jison 0.4.17 */
/*
  Returns a Parser object of the following structure:

  Parser: {
    yy: {}
  }

  Parser.prototype: {
    yy: {},
    trace: function(),
    symbols_: {associative list: name ==> number},
    terminals_: {associative list: number ==> name},
    productions_: [...],
    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$),
    table: [...],
    defaultActions: {...},
    parseError: function(str, hash),
    parse: function(input),

    lexer: {
        EOF: 1,
        parseError: function(str, hash),
        setInput: function(input),
        input: function(),
        unput: function(str),
        more: function(),
        less: function(n),
        pastInput: function(),
        upcomingInput: function(),
        showPosition: function(),
        test_match: function(regex_match_array, rule_index),
        next: function(),
        lex: function(),
        begin: function(condition),
        popState: function(),
        _currentRules: function(),
        topState: function(),
        pushState: function(condition),

        options: {
            ranges: boolean           (optional: true ==> token location info will include a .range[] member)
            flex: boolean             (optional: true ==> flex-like lexing behaviour where the rules are tested exhaustively to find the longest match)
            backtrack_lexer: boolean  (optional: true ==> lexer regexes are tested in order and for each matching regex the action code is invoked; the lexer terminates the scan when a token is returned by the action code)
        },

        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
        rules: [...],
        conditions: {associative list: name ==> set},
    }
  }


  token location info (@$, _$, etc.): {
    first_line: n,
    last_line: n,
    first_column: n,
    last_column: n,
    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
  }


  the parseError function receives a 'hash' object with these members for lexer and parser errors: {
    text:        (matched text)
    token:       (the produced terminal token, if any)
    line:        (yylineno)
  }
  while parser (grammar) errors will also provide these members, i.e. parser errors deliver a superset of attributes: {
    loc:         (yylloc)
    expected:    (string describing the set of expected tokens)
    recoverable: (boolean: TRUE when the parser has a error recovery rule available for this particular error)
  }
*/
var parser = (function(){
var o=function(k,v,o,l){for(o=o||{},l=k.length;l--;o[k[l]]=v);return o},$V0=[1,4],$V1=[1,5],$V2=[1,6],$V3=[1,7],$V4=[1,8],$V5=[1,9],$V6=[1,12],$V7=[1,13],$V8=[1,14],$V9=[1,15],$Va=[1,16],$Vb=[1,17],$Vc=[1,25],$Vd=[1,19],$Ve=[1,20],$Vf=[1,21],$Vg=[1,22],$Vh=[1,23],$Vi=[1,24],$Vj=[1,26],$Vk=[1,27],$Vl=[1,28],$Vm=[1,29],$Vn=[1,30],$Vo=[1,31],$Vp=[5,6,7,8,9,10,11,12,13,14,15,16,17,19,20,33,34,37],$Vq=[5,6,7,8,12,13,14,15,16,17,19,33,34,37],$Vr=[1,60],$Vs=[1,61],$Vt=[19,33,34,37],$Vu=[5,6,7,8,9,10,12,13,14,15,16,17,19,33,34,37],$Vv=[5,6,12,13,14,15,16,19,33,34,37];
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"expressions":3,"e":4,"EOF":5,"=":6,"+":7,"-":8,"*":9,"/":10,"^":11,"<>":12,">":13,"<":14,">=":15,"<=":16,"&":17,"(":18,")":19,":":20,"CELL":21,"SHEET":22,"IDENT":23,"func":24,"array_literal":25,"TRUE":26,"FALSE":27,"STRING":28,"NUMBER":29,"%":30,"range":31,"param_list":32,",":33,";":34,"FUNC":35,"{":36,"}":37,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",6:"=",7:"+",8:"-",9:"*",10:"/",11:"^",12:"<>",13:">",14:"<",15:">=",16:"<=",17:"&",18:"(",19:")",20:":",21:"CELL",22:"SHEET",23:"IDENT",26:"TRUE",27:"FALSE",28:"STRING",29:"NUMBER",30:"%",33:",",34:";",35:"FUNC",36:"{",37:"}"},
productions_: [0,[3,2],[3,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,2],[4,3],[4,2],[4,3],[4,3],[4,1],[4,2],[4,1],[4,2],[4,1],[4,1],[4,1],[4,1],[4,1],[4,2],[4,1],[31,3],[32,1],[32,3],[32,3],[24,4],[24,3],[25,3]],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1: case 2:
 return $$[$0-1]; 
break;
case 3:
this.$ = { type: "operator", subtype: 'infix-add', operands:[$$[$0-2], $$[$0]]}; 
break;
case 4:
this.$ = { type: "operator", subtype: 'infix-subtract', operands:[$$[$0-2], $$[$0]]}; 
break;
case 5:
this.$ = { type: "operator", subtype: 'infix-multiply', operands:[$$[$0-2], $$[$0]]}; 
break;
case 6:
this.$ = { type: "operator", subtype: 'infix-divide', operands:[$$[$0-2], $$[$0]] }; 
break;
case 7:
this.$ = { type: "operator", subtype: 'infix-power', operands:[$$[$0-2], $$[$0]] }; 
break;
case 8:
this.$ = { type: "operator", subtype: 'infix-ne', operands:[$$[$0-2], $$[$0]] }; 
break;
case 9:
this.$ = { type: "operator", subtype: 'infix-eq', operands:[$$[$0-2], $$[$0]] }; 
break;
case 10:
this.$ = { type: "operator", subtype: 'infix-gt', operands:[$$[$0-2], $$[$0]] }; 
break;
case 11:
this.$ = { type: "operator", subtype: 'infix-lt', operands:[$$[$0-2], $$[$0]] }; 
break;
case 12:
this.$ = { type: "operator", subtype: 'infix-gte', operands:[$$[$0-2], $$[$0]] }; 
break;
case 13:
this.$ = { type: "operator", subtype: 'infix-lte', operands:[$$[$0-2], $$[$0]] }; 
break;
case 14:
this.$ = { type: "operator", subtype: 'prefix-plus', operands:[$$[$0]] }; 
break;
case 15:
this.$ = { type: "operator", subtype: 'infix-concat', operands:[$$[$0-2], $$[$0]] }; 
break;
case 16:
this.$ = { type: "operator", subtype: 'prefix-minus', operands:[$$[$0]] }; 
break;
case 17:
this.$ = { type: 'group', exp:$$[$0-1] }; 
break;
case 18:
this.$ = { type: 'range', subtype: 'local', topLeft:$$[$0-2], bottomRight:$$[$0] }; 
break;
case 19:
this.$ = { type: 'cell', subtype: 'local', addr:$$[$0] }; 
break;
case 20:
 this.$ = { type: 'cell', subtype: 'remote', worksheet: $$[$0-1], addr:$$[$0] }; 
break;
case 21:
 this.$ = { type: 'value', subtype: 'variable', value:$$[$0] }; 
break;
case 22:
 this.$ = { type: 'cell', subtype: 'remote-named', worksheet: $$[$0-1], addr:$$[$0] }; 
break;
case 23: case 24:
 this.$ = $$[$0]; 
break;
case 25:
this.$ = { type: 'value', subtype: 'boolean', value: true }; 
break;
case 26:
this.$ = { type: 'value', subtype: 'boolean', value: false }; 
break;
case 27:
this.$ = { type: 'value', subtype: 'string', value:String(yytext)}; 
break;
case 28:
this.$ = { type: 'value', subtype: 'number', value:$$[$0-1]/100 }; 
break;
case 29:
this.$ = { type: 'value', subtype: 'number', value:Number(yytext) }; 
break;
case 31:
 this.$ = [$$[$0]]; 
break;
case 32:
 this.$ = $$[$0-2].concat([$$[$0]]); 
break;
case 33:
 this.$ = ($$[$0][0].subtype !== 'array') ? [{ type: 'value', subtype: 'array', items:$$[$0-2] }, { type: 'value', subtype: 'array', items:$$[$0] }] : [{ type: 'value', subtype: 'array', items:$$[$0-2] }].concat($$[$0]); 
break;
case 34:
 this.$ = { type: 'function', name: $$[$0-3], args:$$[$0-1] }; 
break;
case 35:
 this.$ = { type: 'function', name: $$[$0-2], args:[] }; 
break;
case 36:
 this.$ = { type: 'value', subtype: 'array', items:$$[$0-1] }; 
break;
}
},
table: [{3:1,4:2,6:[1,3],7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{1:[3]},{5:[1,18],6:$Vc,7:$Vd,8:$Ve,9:$Vf,10:$Vg,11:$Vh,12:$Vi,13:$Vj,14:$Vk,15:$Vl,16:$Vm,17:$Vn,20:$Vo},{4:32,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:33,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:34,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:35,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},o($Vp,[2,19]),{21:[1,36],23:[1,37]},o($Vp,[2,21]),o($Vp,[2,23]),o($Vp,[2,24]),o($Vp,[2,25]),o($Vp,[2,26]),o($Vp,[2,27]),o($Vp,[2,29],{30:[1,38]}),{18:[1,39]},{4:41,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,32:40,35:$Va,36:$Vb},{1:[2,1]},{4:42,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:43,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:44,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:45,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:46,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:47,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:48,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:49,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:50,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:51,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:52,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:53,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:54,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{5:[1,55],6:$Vc,7:$Vd,8:$Ve,9:$Vf,10:$Vg,11:$Vh,12:$Vi,13:$Vj,14:$Vk,15:$Vl,16:$Vm,17:$Vn,20:$Vo},o($Vq,[2,14],{9:$Vf,10:$Vg,11:$Vh,20:$Vo}),o($Vp,[2,16]),{6:$Vc,7:$Vd,8:$Ve,9:$Vf,10:$Vg,11:$Vh,12:$Vi,13:$Vj,14:$Vk,15:$Vl,16:$Vm,17:$Vn,19:[1,56],20:$Vo},o($Vp,[2,20]),o($Vp,[2,22]),o($Vp,[2,28]),{4:41,7:$V0,8:$V1,18:$V2,19:[1,58],21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,32:57,35:$Va,36:$Vb},{33:$Vr,34:$Vs,37:[1,59]},o($Vt,[2,31],{6:$Vc,7:$Vd,8:$Ve,9:$Vf,10:$Vg,11:$Vh,12:$Vi,13:$Vj,14:$Vk,15:$Vl,16:$Vm,17:$Vn,20:$Vo}),o($Vq,[2,3],{9:$Vf,10:$Vg,11:$Vh,20:$Vo}),o($Vq,[2,4],{9:$Vf,10:$Vg,11:$Vh,20:$Vo}),o($Vu,[2,5],{11:$Vh,20:$Vo}),o($Vu,[2,6],{11:$Vh,20:$Vo}),o([5,6,7,8,9,10,11,12,13,14,15,16,17,19,33,34,37],[2,7],{20:$Vo}),o($Vv,[2,8],{7:$Vd,8:$Ve,9:$Vf,10:$Vg,11:$Vh,17:$Vn,20:$Vo}),o($Vv,[2,9],{7:$Vd,8:$Ve,9:$Vf,10:$Vg,11:$Vh,17:$Vn,20:$Vo}),o($Vv,[2,10],{7:$Vd,8:$Ve,9:$Vf,10:$Vg,11:$Vh,17:$Vn,20:$Vo}),o($Vv,[2,11],{7:$Vd,8:$Ve,9:$Vf,10:$Vg,11:$Vh,17:$Vn,20:$Vo}),o($Vv,[2,12],{7:$Vd,8:$Ve,9:$Vf,10:$Vg,11:$Vh,17:$Vn,20:$Vo}),o($Vv,[2,13],{7:$Vd,8:$Ve,9:$Vf,10:$Vg,11:$Vh,17:$Vn,20:$Vo}),o([5,6,12,13,14,15,16,17,19,33,34,37],[2,15],{7:$Vd,8:$Ve,9:$Vf,10:$Vg,11:$Vh,20:$Vo}),o($Vp,[2,18]),{1:[2,2]},o($Vp,[2,17]),{19:[1,62],33:$Vr,34:$Vs},o($Vp,[2,35]),o($Vp,[2,36]),{4:63,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,35:$Va,36:$Vb},{4:41,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:$V5,24:10,25:11,26:$V6,27:$V7,28:$V8,29:$V9,32:64,35:$Va,36:$Vb},o($Vp,[2,34]),o($Vt,[2,32],{6:$Vc,7:$Vd,8:$Ve,9:$Vf,10:$Vg,11:$Vh,12:$Vi,13:$Vj,14:$Vk,15:$Vl,16:$Vm,17:$Vn,20:$Vo}),o([19,37],[2,33],{33:$Vr,34:$Vs})],
defaultActions: {18:[2,1],55:[2,2]},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        function _parseError (msg, hash) {
            this.message = msg;
            this.hash = hash;
        }
        _parseError.prototype = Error;

        throw new _parseError(str, hash);
    }
},
parse: function parse(input) {
    var self = this, stack = [0], tstack = [], vstack = [null], lstack = [], table = this.table, yytext = '', yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    var args = lstack.slice.call(arguments, 1);
    var lexer = Object.create(this.lexer);
    var sharedState = { yy: {} };
    for (var k in this.yy) {
        if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
            sharedState.yy[k] = this.yy[k];
        }
    }
    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;
    if (typeof lexer.yylloc == 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);
    var ranges = lexer.options && lexer.options.ranges;
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    } else {
        this.parseError = Object.getPrototypeOf(this).parseError;
    }
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    _token_stack:
        var lex = function () {
            var token;
            token = lexer.lex() || EOF;
            if (typeof token !== 'number') {
                token = self.symbols_[token] || token;
            }
            return token;
        };
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == 'undefined') {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
                    if (typeof action === 'undefined' || !action.length || !action[0]) {
                var errStr = '';
                expected = [];
                for (p in table[state]) {
                    if (this.terminals_[p] && p > TERROR) {
                        expected.push('\'' + this.terminals_[p] + '\'');
                    }
                }
                if (lexer.showPosition) {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ', got \'' + (this.terminals_[symbol] || symbol) + '\'';
                } else {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' + (symbol == EOF ? 'end of input' : '\'' + (this.terminals_[symbol] || symbol) + '\'');
                }
                this.parseError(errStr, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected
                });
            }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(lexer.yytext);
            lstack.push(lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = lexer.yyleng;
                yytext = lexer.yytext;
                yylineno = lexer.yylineno;
                yyloc = lexer.yylloc;
                if (recovering > 0) {
                    recovering--;
                }
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {
                first_line: lstack[lstack.length - (len || 1)].first_line,
                last_line: lstack[lstack.length - 1].last_line,
                first_column: lstack[lstack.length - (len || 1)].first_column,
                last_column: lstack[lstack.length - 1].last_column
            };
            if (ranges) {
                yyval._$.range = [
                    lstack[lstack.length - (len || 1)].range[0],
                    lstack[lstack.length - 1].range[1]
                ];
            }
            r = this.performAction.apply(yyval, [
                yytext,
                yyleng,
                yylineno,
                sharedState.yy,
                action[1],
                vstack,
                lstack
            ].concat(args));
            if (typeof r !== 'undefined') {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}};
/* generated by jison-lex 0.3.4 */
var lexer = (function(){
var lexer = ({

EOF:1,

parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },

// resets the lexer, sets new input
setInput:function (input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
        };
        if (this.options.ranges) {
            this.yylloc.range = [0,0];
        }
        this.offset = 0;
        return this;
    },

// consumes and returns one char from the input
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) {
            this.yylloc.range[1]++;
        }

        this._input = this._input.slice(1);
        return ch;
    },

// unshifts one char (or a string) into the input
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - 1);
        this.matched = this.matched.substr(0, this.matched.length - 1);

        if (lines.length - 1) {
            this.yylineno -= lines.length - 1;
        }
        var r = this.yylloc.range;

        this.yylloc = {
            first_line: this.yylloc.first_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.first_column,
            last_column: lines ?
                (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                 + oldLines[oldLines.length - lines.length].length - lines[0].length :
              this.yylloc.first_column - len
        };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        this.yyleng = this.yytext.length;
        return this;
    },

// When called from action, caches matched text and appends it on next action
more:function () {
        this._more = true;
        return this;
    },

// When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
reject:function () {
        if (this.options.backtrack_lexer) {
            this._backtrack = true;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });

        }
        return this;
    },

// retain first n characters of the match
less:function (n) {
        this.unput(this.match.slice(n));
    },

// displays already matched input, i.e. for error messages
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },

// displays upcoming input, i.e. for error messages
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
    },

// displays the character position where the lexing error occurred, i.e. for error messages
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c + "^";
    },

// test the lexed token: return FALSE when not a match, otherwise return token
test_match:function (match, indexed_rule) {
        var token,
            lines,
            backup;

        if (this.options.backtrack_lexer) {
            // save context
            backup = {
                yylineno: this.yylineno,
                yylloc: {
                    first_line: this.yylloc.first_line,
                    last_line: this.last_line,
                    first_column: this.yylloc.first_column,
                    last_column: this.yylloc.last_column
                },
                yytext: this.yytext,
                match: this.match,
                matches: this.matches,
                matched: this.matched,
                yyleng: this.yyleng,
                offset: this.offset,
                _more: this._more,
                _input: this._input,
                yy: this.yy,
                conditionStack: this.conditionStack.slice(0),
                done: this.done
            };
            if (this.options.ranges) {
                backup.yylloc.range = this.yylloc.range.slice(0);
            }
        }

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset += this.yyleng];
        }
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
        if (this.done && this._input) {
            this.done = false;
        }
        if (token) {
            return token;
        } else if (this._backtrack) {
            // recover context
            for (var k in backup) {
                this[k] = backup[k];
            }
            return false; // rule action called reject() implying the next rule should be tested instead.
        }
        return false;
    },

// return next match in input
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) {
            this.done = true;
        }

        var token,
            match,
            tempMatch,
            index;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
                        continue; // rule action called reject() implying a rule MISmatch.
                    } else {
                        // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                        return false;
                    }
                } else if (!this.options.flex) {
                    break;
                }
            }
        }
        if (match) {
            token = this.test_match(match, rules[index]);
            if (token !== false) {
                return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });
        }
    },

// return next match that has a token
lex:function lex() {
        var r = this.next();
        if (r) {
            return r;
        } else {
            return this.lex();
        }
    },

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions["INITIAL"].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return "INITIAL";
        }
    },

// alias for begin(condition)
pushState:function pushState(condition) {
        this.begin(condition);
    },

// return the number of states currently on the stack
stateStackSize:function stateStackSize() {
        return this.conditionStack.length;
    },
options: {},
performAction: function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {
var YYSTATE=YY_START;
switch($avoiding_name_collisions) {
case 0:/* skip whitespace */
break;
case 1:return 29
break;
case 2:return 26
break;
case 3:return 27
break;
case 4:return 26
break;
case 5:return 27
break;
case 6:return 26
break;
case 7:return 27
break;
case 8:return 9
break;
case 9:return 10
break;
case 10:return 8
break;
case 11:return 7
break;
case 12:return 17
break;
case 13:return 11
break;
case 14:return 18
break;
case 15:return 19
break;
case 16:return ">="
break;
case 17:return "<="
break;
case 18:return "<>"
break;
case 19:return "="
break;
case 20:return ">"
break;
case 21:return "<"
break;
case 22:return "{"
break;
case 23:return "}"
break;
case 24:return "!"
break;
case 25:return ","
break;
case 26:return ":"
break;
case 27:return ";"
break;
case 28:return "%"
break;
case 29:return 35;
break;
case 30:return 35;
break;
case 31:yy_.yytext = yy_.yytext.substr(2,yy_.yyleng-3).replace(/\"\"/g, "\""); return "SHEET";
break;
case 32:yy_.yytext = yy_.yytext.substr(1,yy_.yyleng-3).replace(/\"\"/g, "\""); return "SHEET";
break;
case 33:yy_.yytext = yy_.yytext.slice(0, -1); return "SHEET"
break;
case 34:yy_.yytext = yy_.yytext.slice(1, -1); return "SHEET"
break;
case 35:return "CELL";
break;
case 36:yy_.yytext = yy_.yytext.substr(1,yy_.yyleng-2).replace(/\"\"/g, "\""); return "STRING";
break;
case 37:return 23
break;
case 38:return 5
break;
case 39:return 'INVALID'
break;
}
},
rules: [/^(?:\s+)/,/^(?:[0-9]+(\.[0-9]+)?\b)/,/^(?:TRUE\b)/,/^(?:FALSE\b)/,/^(?:true\b)/,/^(?:false\b)/,/^(?:True\b)/,/^(?:False\b)/,/^(?:\*)/,/^(?:\/)/,/^(?:-)/,/^(?:\+)/,/^(?:&)/,/^(?:\^)/,/^(?:\()/,/^(?:\))/,/^(?:>=)/,/^(?:<=)/,/^(?:<>)/,/^(?:=)/,/^(?:>)/,/^(?:<)/,/^(?:\{)/,/^(?:\})/,/^(?:!)/,/^(?:,)/,/^(?::)/,/^(?:;)/,/^(?:%)/,/^(?:[A-Za-z](?=[(]))/,/^(?:[A-Za-z][A-Za-z0-9\.]+(?=[(]))/,/^(?:\$'(?:''|[^'])*'!)/,/^(?:'(?:''|[^'])*'!)/,/^(?:[a-zA-Z]([a-zA-Z0-9.$]+)?!)/,/^(?:\$([a-zA-Z])([a-zA-Z0-9.$]+)?!)/,/^(?:\$?([a-zA-Z]+)\$?([0-9]+))/,/^(?:"(?:""|[^"])*")/,/^(?:[a-zA-Z]([a-zA-Z0-9.$^\(]+)?)/,/^(?:$)/,/^(?:.)/],
conditions: {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39],"inclusive":true}}
});
return lexer;
})();
parser.lexer = lexer;
function Parser () {
  this.yy = {};
}
Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();


if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = parser;
exports.Parser = parser.Parser;
exports.parse = function () { return parser.parse.apply(parser, arguments); };
exports.main = function commonjsMain(args) {
    if (!args[1]) {
        console.log('Usage: '+args[0]+' FILE');
        process.exit(1);
    }
    var source = require('fs').readFileSync(require('path').normalize(args[1]), "utf8");
    return exports.parser.parse(source);
};
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(process.argv.slice(1));
}
}
}).call(this,require('_process'))
},{"_process":7,"fs":4,"path":6}],4:[function(require,module,exports){

},{}],5:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

// Copyright 2015 Peter W Moresi

// Returns true when the value is a finite number.
function isnumber(value) {
  return typeof value === 'number' && !Number.isNaN(value) && isFinite(value);
}

// Copyright 2015 Peter W Moresi

// List of errors in the spreadsheet system

function FFError(message) {
  this.name = "NotImplementedError";
  this.message = message || "";
}

FFError.prototype = Error.prototype;
FFError.prototype.toString = function () {
  return this.message;
};

var nil = new FFError('#NULL!');
var div0 = new FFError('#DIV/0!');
var value = new FFError('#VALUE!');
var ref = new FFError('#REF!');
var name = new FFError('#NAME?');
var num = new FFError('#NUM!');
var na = new FFError('#N/A!');
var error$1 = new FFError('#ERROR!');
var data = new FFError('#GETTING_DATA!');
var missing = new FFError('#MISSING!');
var unknown = new FFError('#UNKNOWN!');
var error$2 = {
  nil: nil,
  div0: div0,
  value: value,
  ref: ref,
  name: name,
  num: num,
  na: na,
  error: error$1,
  data: data,
  missing: missing,
  unknown: unknown
};

// ABS computes absolute value of a number
function abs(value) {

  // Return `#VALUE!` if not number
  if (!isnumber(value)) {
    return error$2.value;
  }

  // Use built-in Math.abs
  return Math.abs(value);
}

// ACOS computes the inverse cosine of a number
function acos(value) {

  // Return `#VALUE!` if not number
  if (!isnumber(value)) {
    return error$2.value;
  }

  // Use built-in Math.acos
  return Math.acos(value);
}

// ADD calculates the sum of two numbers.
function add() {
  for (var _len = arguments.length, values = Array(_len), _key = 0; _key < _len; _key++) {
    values[_key] = arguments[_key];
  }

  // Return `#NA!` if 2 arguments are not provided.
  if (values.length !== 2) {
    return error$2.na;
  }

  // decompose values into a and b.
  var a = values[0];
  var b = values[1];

  // Return `#VALUE!` if either a or b is not a number.

  if (!isnumber(a) || !isnumber(b)) {
    return error$2.value;
  }

  // Return the sum.
  return a + b;
}

// ISERR returns true when the value is an error (except `#NA!`) or when then
// value is a number which is NaN or [-]Infinity.
function iserr(value) {
  return value !== error$2.na && value.constructor.name === 'Error' || typeof value === 'number' && (Number.isNaN(value) || !Number.isFinite(value));
}

// ISERROR returns true when the value is an error.
function iserror(value) {
  return iserr(value) || value === error$2.na;
}

// Copyright 2015 Peter W Moresi

// ISFUNCTION returns true when `value` is a function.
function isfunction(value) {
  return value && Object.prototype.toString.call(value) == '[object Function]';
};

// AND reduces list of truthy values into true or false value
function and() {
  for (var _len2 = arguments.length, criteria = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    criteria[_key2] = arguments[_key2];
  }

  // Reduce criteria into boolean value.
  return criteria.reduce(function (acc, item) {

    // Once `false` or #error! is found always return previously value
    if (acc === false || iserror(acc)) return acc;

    // find the value if a literal or deferred value
    var val = isfunction(item) ? item() : item;

    // return `#VALUE!` if not true, false, 1 or 0
    if (val !== true && val !== false && val !== 1 && val !== 0) {
      return error$2.value;
    }

    // Return true when value is true or 1
    return val === true || val === 1;
  });
}

// Copyright 2015 Peter W Moresi

// FLATTEN converts a nested array into a flattened array. It only supports one
// level of nesting.
function flatten(ref) {
  return ref.reduce(function (a, b) {
    return a.concat(b);
  }, []);
}

// SUM a given list of `numbers`
function sum() {
  for (var _len3 = arguments.length, numbers = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
    numbers[_key3] = arguments[_key3];
  }

  return flatten(flatten(numbers)).reduce(function (a, b) {
    if (typeof b !== 'number') {
      return error$2.value;
    }
    return a + b;
  });
}

// AVERAGE computes sum of items divided by number of items
function average() {

  // compute sum all of the items.
  var v = sum.apply(undefined, arguments);

  // return sum when computed error.
  if (iserror(v)) {
    return v;
  }

  // return sum divided by item count
  return v / arguments.length;
}

// BIN2DEC converts binary string into decimal value
function bin2dec(value) {
  var valueAsString;

  if (typeof value === "string") {
    valueAsString = value;
  } else if (typeof value !== "undefined") {
    valueAsString = value.toString();
  } else {
    return error$2.NA;
  }

  if (valueAsString.length > 10) return error$2.NUM;

  // we subtract 512 when the leading number is 0.
  if (valueAsString.length === 10 && valueAsString[0] === '1') {
    return parseInt(valueAsString.substring(1), 2) - 512;
  }

  // Convert binary number to decimal with built-in facility
  return parseInt(valueAsString, 2);
};

// branch is the function equivalent to `if-then-else`
//
// syntax:
// branch( test, result_if_true, [test2, result_if_true,] false_result )
function branch() {
  for (var _len4 = arguments.length, cases = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
    cases[_key4] = arguments[_key4];
  }

  var resolved = false;

  // Reduce all cases into a value.
  return cases.reduce(function (acc, item, index) {
    var val = void 0;

    // Return previously resolved result
    if (resolved === true) return acc;

    // Handle last item
    if (index === cases.length - 1) {
      // There is no last item.
      if (index % 2 === 1) return;

      // return the last item
      return isfunction(item) ? item() : item;
    }

    // Check if condition is true
    if (index % 2 === 0 && (isfunction(item) && item() === true || item === true)) {
      resolved = true;
      val = cases[index + 1];
      return isfunction(val) ? val() : val;
    }

    return acc;
  }, undefined);
}

// Copyright 2015 Peter W Moresi

// Shared constants
var d1900 = new Date(1900, 0, 1);
var JulianOffset = 2415019;
var SecondsInHour = 3600;
var SecondsInDay = 86400;
var MilliSecondsInDay = 86400000;
var DayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var DayNames3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var MonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var MonthNames3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var AM = "AM";
var AM1 = "A";
var PM = "PM";
var PM1 = "P";
var τ = 6.28318530717958;
var MaxCols = 16384;
var SeparatorChar = ",";
var DecimalChar = ".";
var DefaultCurrency = "$";
var AllowedColors = {
  BLACK: "#000000",
  BLUE: "#0000FF",
  CYAN: "#00FFFF",
  GREEN: "#00FF00",
  MAGENTA: "#FF00FF",
  RED: "#FF0000",
  WHITE: "#FFFFFF",
  YELLOW: "#FFFF00"
};

// CELLINDEX computes the index for row and column in a 2 dimensional array.
function cellindex(row, col) {
  // Multiple row by maximum columns plus the col.
  return Math.floor(row * MaxCols + col);
}

// Copyright 2015 Peter W Moresi

// UNIQUE reduces an `array` into an array without duplicate values.
function unique(array) {
  return array.reduce(function (p, c) {
    if (p.indexOf(c) < 0) p.push(c);
    return p;
  }, []);
}

// CHANGED computes the list of keys that are different between two objects.
function changed(a, b) {

  // Compute the keys in object a and b.
  var keysA = Object.keys(a),
      keysB = Object.keys(b);

  // Find the unique set of properties comparing a to b and b to a.
  return unique(keysA.filter(function (n) {
    return a[n] !== b[n];
  }).concat(keysB.filter(function (n) {
    return a[n] !== b[n];
  })));
}

// CHOOSE accepts an index and a list of items. It returns the item that corresponds to the index.
function choose(index) {

  // Return `#NA!` if index or items are not provided.
  if (!index || arguments.length - 1 === 0) {
    return error$2.na;
  }

  // Return `#VALUE!` if index is less than 1 or greater than 254.
  if (index < 1 || index > 254) {
    return error$2.value;
  }

  // Return `#VALUE!` if number of items is less than index.
  if (arguments.length - 1 < index) {
    return error$2.value;
  }

  // Return the item.
  return arguments.length <= index - 1 + 1 ? undefined : arguments[index - 1 + 1];
}

// Copyright 2015 Peter W Moresi

// ISBLANK returns true when the value is undefined or null.
function isblank(value) {
  return typeof value === 'undefined' || value === null;
};

// Copyright 2015 Peter W Moresi

// ISARRAY returns true when the value is an aray.
function isarray(value) {
  return Object.prototype.toString.call(value) === '[object Array]';
}

// SELECT fields from object
function select(fields, body) {
  // non-json
  if (!body || 'object' != (typeof body === "undefined" ? "undefined" : _typeof(body))) return;

  // check for fields
  if (!fields) return;

  // split
  if ('string' == typeof fields) fields = fields.split(/ *, */);

  // fields array
  if (isarray(body)) {
    return body.map(function (obj) {
      return fields.reduce(function (ret, key) {
        ret[key] = obj[key];
        return ret;
      }, {});
    });

    return;
  }

  // fields object
  return fields.reduce(function (ret, key) {
    ret[key] = body[key];
    return ret;
  }, {});
}

// CLEAN accepts an object and remove properties that are blank.
function clean(obj) {
  // Compute keys where value is non blank.
  var keys = Object.keys(obj).filter(function (n) {
    return !isblank(obj[n]);
  });

  // Compute object with only non-blank keys.
  return select(keys, obj);
}

// CODE accepts text and optionally index (default 1) returning the character code.
function code() {
  var text = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];
  var index = arguments.length <= 1 || arguments[1] === undefined ? 1 : arguments[1];

  if (index < 1) return error$2.na;
  if (text.length < index) return error$2.value;
  return text.charCodeAt(index - 1);
}

// Copyright 2015 Peter W Moresi

// ISTEXT returns true when the value is a string.
function istext(value) {
  return 'string' === typeof value;
};

// ISREF returns true when the value is a reference.
function isref(value) {
  if (!value) return false;
  return value._isref === true;
}

// Convert letter to number (e.g A -> 0)
function columnnumber(column) {

  if (!istext(column)) {
    return error$2.value;
  }

  // see toColumn for rant on why this is sensible even though it is illogical.
  var s = 0,
      secondPass;

  if (column.length > 0) {

    s = column.charCodeAt(0) - 'A'.charCodeAt(0);

    for (var i = 1; i < column.length; i++) {
      // compensate for spreadsheet column naming
      s += 1;
      s *= 26;
      s += column.charCodeAt(i) - 'A'.charCodeAt(0);
      secondPass = true;
    }

    return s;
  }

  return error$2.value;
}

// COLUMN return the column number that corresponds to the reference.
function column(value) {

  // Return `#VALUE!` when the value is not a reference.
  if (!isref(value)) {
    return error$2.value;
  }

  // Run the COLUMNNUMBER and convert to base 1.
  return columnnumber(value.column) + 1;
}

// Convert index to letter (e.g 0 -> A)
function columnletter(index) {

  if (!isnumber(index)) {
    return error$2.value;
  }

  // The column is determined by applying a modified Hexavigesimal algorithm.
  // Normally BA follows Z but spreadsheets count wrong and nobody cares.

  // Instead they do it in a way that makes sense to most people but
  // is mathmatically incorrect. So AA follows Z which in the base 10
  // system is like saying 01 follows 9.

  // In the least significant digit
  // A..Z is 0..25

  // For the second to nth significant digit
  // A..Z is 1..26

  var converted = "",
      secondPass = false,
      remainder,
      value = Math.abs(index);

  do {
    remainder = value % 26;

    if (secondPass) {
      remainder--;
    }

    converted = String.fromCharCode(remainder + 'A'.charCodeAt(0)) + converted;
    value = Math.floor((value - remainder) / 26);

    secondPass = true;
  } while (value > 0);

  return converted;
}

// Copyright 2015 Peter W Moresi

// CONCATENATE reduces a list of values into a single string.
function concatenate() {
  for (var _len5 = arguments.length, values = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
    values[_key5] = arguments[_key5];
  }

  // Combine into a single string value
  return values.reduce(function (acc, item) {
    return "" + acc + item;
  });
}

// COS returns the cosine of a value.
function cos(value) {

  // Return `#VALUE!` when value is not a number.
  if (!isnumber(value)) {
    return error$2.value;
  }

  return Math.cos(value);
}

// Copyright 2015 Peter W Moresi

// ISDATE returns true when the `value` is a JavaScript date object.
function isdate(value) {
  return value && Object.prototype.toString.call(value) == '[object Date]';
};

// SERIAL convert a date object into a serial number.
function serial(date) {
  // Credit: https://github.com/sutoiku/formula.js/
  if (!isdate(date)) {
    return error$2.na;
  }
  var diff = Math.ceil((date - d1900) / MilliSecondsInDay);
  return diff + (diff > 59 ? 2 : 1);
}

// DATE returns a serial number given a year, month and day.
function date(year, month, day) {
  return serial(new Date(year, month - 1, day));
}

// PARSEDATE converts a value into a Date object.
function parsedate(val) {

  /* *******************
  Extracted from Social Calc
   convert_date_julian_to_gregorian(juliandate)
   ymd->{}
  .year
  .month
  .day
   From: http://aa.usno.navy.mil/faq/docs/JD_Formula.html
  Uses: Fliegel, H. F. and van Flandern, T. C. (1968). Communications of the ACM, Vol. 11, No. 10 (October, 1968).
  Translated from the FORTRAN
   ************************* */
  function convert_date_julian_to_gregorian(juliandate) {

    var L, N, I, J, K;

    L = juliandate + 68569;
    N = Math.floor(4 * L / 146097);
    L = L - Math.floor((146097 * N + 3) / 4);
    I = Math.floor(4000 * (L + 1) / 1461001);
    L = L - Math.floor(1461 * I / 4) + 31;
    J = Math.floor(80 * L / 2447);
    K = L - Math.floor(2447 * J / 80);
    L = Math.floor(J / 11);
    J = J + 2 - 12 * L;
    I = 100 * (N - 49) + I + L;

    return new Date(I, J - 1, K);
  }

  if (val instanceof Error) {
    return val;
  } else if (typeof val === 'number') {
    // val is assumed to be serial number.
    return convert_date_julian_to_gregorian(Math.floor(val + JulianOffset));
  } else if (typeof val === 'string') {
    var timestamp = Date.parse(val);
    if (Number.isNaN(timestamp)) {
      return error$2.value;
    }
    return new Date(timestamp);
  }

  return error$2.value;
}

// DATEVALUE parses a date string and returns a serial number.
function datevalue(d) {
  return serial(parsedate(d));
}

// DATEDIF return the difference between two dates given a start date, end date and unit.
function datedif(start_date, end_date, unit) {
  var second = 1000,
      minute = second * 60,
      hour = minute * 60,
      day = hour * 24,
      week = day * 7;
  start_date = parsedate(start_date), end_date = parsedate(end_date);

  var timediff = end_date - start_date;
  if (Number.isNaN(timediff)) return NaN;

  switch (unit) {
    case "Y":
      return end_date.getFullYear() - start_date.getFullYear();
    case "M":
      return end_date.getFullYear() * 12 + end_date.getMonth() - (start_date.getFullYear() * 12 + start_date.getMonth());
    case "W":
      return Math.floor(timediff / week);
    case "D":
      return Math.floor(timediff / day);
    case "MD":
      return end_date.getdate() - start_date.getdate();
    case "YM":
      return end_date.getMonth() - start_date.getMonth();
    case "YD":
      return new error("NOT IMPLEMENTED");
    default:
      return undefined;
  }
}

// PARSEBOOL converts a truthy value into a boolean value.
function parsebool(val) {

  if (val instanceof Error) {
    return val;
  } else if (typeof val === 'boolean') {
    return val;
  } else if (typeof val === 'number') {
    return val !== 0;
  } else if (typeof val === 'string') {
    var up = val.toUpperCase();
    if (up === 'TRUE' || up === 'FALSE') {
      return up === 'TRUE';
    }
  }

  return error$2.value;
}

function days360(start_date, end_date, method) {
  method = parsebool(method);
  start_date = parsedate(start_date);
  end_date = parsedate(end_date);

  if (start_date instanceof Error) {
    return start_date;
  }
  if (end_date instanceof Error) {
    return end_date;
  }
  if (method instanceof Error) {
    return method;
  }
  var sm = start_date.getMonth();
  var em = end_date.getMonth();
  var sd, ed;
  if (method) {
    sd = start_date.getDate() === 31 ? 30 : start_date.getDate();
    ed = end_date.getDate() === 31 ? 30 : end_date.getDate();
  } else {
    var smd = new Date(start_date.getFullYear(), sm + 1, 0).getDate();
    var emd = new Date(end_date.getFullYear(), em + 1, 0).getDate();
    sd = start_date.getDate() === smd ? 30 : start_date.getDate();
    if (end_date.getDate() === emd) {
      if (sd < 30) {
        em++;
        ed = 1;
      } else {
        ed = 30;
      }
    } else {
      ed = end_date.getDate();
    }
  }
  return 360 * (end_date.getFullYear() - start_date.getFullYear()) + 30 * (em - sm) + (ed - sd);
}

// Copyright 2015 Peter W Moresi

// REPT creates string by repeating text a given number of times.
function rept(text, number) {
  var r = '';
  for (var i = 0; i < number; i++) {
    r += text;
  }
  return r;
}

// based on https://github.com/sutoiku/formula.js/blob/mast../src/engineering.js
function dec2bin(input, places) {

  // exit if input is an error
  if (input instanceof Error) {
    return number;
  }

  // cast input to number
  var number = parseInt(input);

  if (!/^-?[0-9]{1,3}$/.test(number) || Number.isNaN(number)) {
    return error$2.value;
  }

  // Return error.if number is not decimal, is lower than -512, or is greater than 511
  if (number < -512 || number > 511) {
    return error$2.num;
  }

  // Ignore places and return a 10-character binary number if number is negative
  if (number < 0) {
    return '1' + rept('0', 9 - (512 + number).toString(2).length) + (512 + number).toString(2);
  }

  // Convert decimal number to binary
  var result = parseInt(number, 10).toString(2);

  // Return binary number using the minimum number of characters necessary if places is undefined
  if (typeof places === 'undefined') {
    return result;
  } else {
    // Return error.if places is nonnumeric
    if (!/^-?[0-9]{1,3}$/.test(places) || Number.isNaN(places)) {
      return error$2.value;
    }

    // Return error.if places is negative
    if (places < 0) {
      return error$2.num;
    }

    // Truncate places in case it is not an integer
    places = Math.floor(places);

    // Pad return value with leading 0s (zeros) if necessary (using Underscore.string)
    return places >= result.length ? rept('0', places - result.length) + result : error$2.num;
  }
}

// Copyright 2015 Peter W Moresi

function diff(a, b) {
  var keysA = Object.keys(a),
      keysB = Object.keys(b),
      InA = keysB.filter(function (n) {
    return keysA.indexOf(n) > -1;
  }),
      NotInA = keysB.filter(function (n) {
    return keysA.indexOf(n) === -1;
  }),
      NotInB = keysA.filter(function (n) {
    return keysB.indexOf(n) === -1;
  }),
      Diff = InA.filter(function (n) {
    return a[n] !== b[n];
  });

  return {
    unique_left: NotInA,
    unique_right: NotInB,
    diff: Diff.reduce(function (x, y) {
      var diff = {};
      diff[y] = { left: a[y], right: b[y] };
      return Object.assign({}, x, diff);
    }, {})
  };
}

// DIVIDE calculates the product of two numbers.
function divide() {
  for (var _len6 = arguments.length, values = Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
    values[_key6] = arguments[_key6];
  }

  // Return `#NA!` if 2 arguments are not provided.
  if (values.length !== 2) {
    return error$2.na;
  }

  // decompose values into a and b.
  var a = values[0];
  var b = values[1];

  // You cannot divide a number by 0.

  if (b === 0) {
    return error$2.div0;
  }

  // Return `#VALUE!` if either a or b is not a number.
  if (!isnumber(a) || !isnumber(b)) {
    return error$2.value;
  }

  // Return the product
  return a / b;
}

// Copyright 2015 Peter W Moresi

// EQ compares two values and returns a boolean value.
function eq(a, b) {
  // String comparisions are case-insensitive
  if (typeof a === "string" && typeof b === "string") {
    return a.toLowerCase() === b.toLowerCase();
  } else {
    return a === b;
  }
}

// Exact compares two values and only returns true if they meet strict equivalence.
var exact = function exact(a, b) {
  return a === b;
};

// Copyright 2015 Peter W Moresi

// FILTER limits a range based on arrays of boolean values.
function filter(range) {
  for (var _len7 = arguments.length, filters = Array(_len7 > 1 ? _len7 - 1 : 0), _key7 = 1; _key7 < _len7; _key7++) {
    filters[_key7 - 1] = arguments[_key7];
  }

  // A filter is an array of true/false values.
  // The filter may be for rows or for columns but not both.
  // A array filter may only filter a range that covers a single row or a single column.

  function makefilter() {
    return function (value, index) {
      return filters.reduce(function (previousValue, currentValue) {
        if (previousValue === false) {
          return false;
        } else {
          return currentValue[index];
        }
      }, true);
    };
  }

  return range.filter(makefilter());
}

// FIND searches for text within a string
function find(find_text) {
  var within_text = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];
  var position = arguments.length <= 2 || arguments[2] === undefined ? 1 : arguments[2];


  // Find the position of the text
  position = within_text.indexOf(find_text, position - 1);

  // If found return the position as base 1.
  return position === -1 ? error$2.value : position + 1;
}

function gt(a, b) {
  if (isref(a) && isref(b)) {
    return error$2.na;
  } else if (isarray(a) && isarray(b)) {
    return error$2.na;
  } else if (isref(a) || isarray(a)) {
    return a.map(function (d) {
      return d > b;
    });
  } else if (isref(b) || isarray(b)) {
    return b.map(function (d) {
      return d > a;
    });
  } else {
    return a > b;
  }
}

function gte(a, b) {
  if (isref(a) && isref(b)) {
    return error.na;
  } else if (isarray(a) && isarray(b)) {
    return error.na;
  } else if (isref(a) || isarray(a)) {
    return a.map(function (d) {
      return d >= b;
    });
  } else if (isref(b) || isarray(b)) {
    return b.map(function (d) {
      return d >= a;
    });
  } else {
    return a >= b;
  }
}

// Copyright 2015 Peter W Moresi

// credit to http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
// rfc4122 version 4 compliant solution

// Generate a globally unique identifier
function guid() {
  var guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0,
        v = c == 'x' ? r : r & 0x3 | 0x8;
    return v.toString(16);
  });
  return guid;
};

// HLOOKUP searches for a needle across the rows.
function hlookup(needle, table) {
  var index = arguments.length <= 2 || arguments[2] === undefined ? 1 : arguments[2];
  var exactmatch = arguments[3];

  if (typeof needle === "undefined" || isblank(needle)) {
    return null;
  }

  if (index > table.length) {
    return error$2.ref;
  }

  var needleLower = (needle + '').toLowerCase(),
      row = table[0];

  for (var i = 0; i < row.length; i++) {

    if (exactmatch && row[i] === needle || row[i] == needle || typeof row[i] === "string" && row[i].toLowerCase().indexOf(needleLower) != -1) {
      return table[index - 1][i];
    }
  }

  return error$2.na;
}

// IFBLANK return the `value` if non-blank, otherwise it returns `value_if_blank`.
function ifblank(value, value_if_blank) {
  return isblank(value) ? value_if_blank : value;
}

// ISEMPTY returns true when the value is blank, is an empty array or when it
// is an empty string.
function isempty(value) {
  return isblank(value) || isarray(value) && value.length === 0 || istext(value) && value === '';
};

// IFBLANK return the `value` if empty, otherwise it returns `value_if_empty`.
function ifempty(value, value_if_empty) {
  return isempty(value) ? value_if_empty : value;
}

// IFBLANK return the `value` if error, otherwise it returns `value_if_error`.
function iferror(value) {
  var value_if_error = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

  return iserror(value) ? value_if_error : value;
}

// IFBLANK return the `value` if `#NA!`, otherwise it returns `value_if_na`.
function ifna(value, value_if_na) {
  return value === error$2.na ? value_if_na : value;
}

// INDEX2COL computes the row given a cell index
function index2row(index) {
  return Math.floor(index / MaxCols);
}

// INDEX2COL computes the column given a cell index
function index2col(index) {
  return index - index2row(index) * MaxCols;
}

// REF accepts top and bottom and returns a reference object. It encapsulates a cell or a range.
function ref$1(top, bottom) {

  // The index must be a number
  if (!isnumber(top) && !isfunction(top)) {
    return error$2.value;
  }

  if (isblank(bottom)) {
    bottom = top;
  }

  var getTop = function getTop() {
    return isfunction(top) ? top() : top;
  };
  var getBottom = function getBottom() {
    return isfunction(bottom) ? bottom() : bottom;
  };

  return {

    get _isref() {
      return true;
    },

    get top() {
      return getTop();
    },

    get bottom() {
      return getBottom();
    },

    // Returns row (rowIndex plus 1)
    get row() {
      return index2row(getTop()) + 1;
    },

    // Returns rowIndex (base 0)
    get rowIndex() {
      return index2row(getTop());
    },

    // Returns column letter
    get column() {
      return columnletter(index2col(getTop()));
    },

    // Returns column index
    get columnIndex() {
      return index2col(getTop());
    },

    // Returns row (rowIndex plus 1)
    get bottomRow() {
      return index2row(getBottom()) + 1;
    },

    // Returns rowIndex (base 0)
    get bottomRowIndex() {
      return index2row(getBottom());
    },

    // Returns column letter
    get bottomColumn() {
      return columnletter(index2col(getBottom()));
    },

    // Returns column index
    get bottomColumnIndex() {
      return index2col(getBottom());
    },

    // The cell id puts the whole table into a single dimension. It simply needs to be between the topLeft and the bottomRight to qualify.
    hit: function hit(index) {

      // Return `#NA!` when index is negative.
      if (index < 0) return error$2.na;

      // Check if value is inside range from top to bottom, inclusive.
      return index >= getTop() && index <= getBottom();
    },


    get size() {
      return 1 + (getBottom() - getTop());
    },

    // Return array with every cell index
    get cells() {
      return Array.apply(getTop(), Array(1 + (getBottom() - getTop()))).map(function (x, y) {
        return y + getTop();
      });
    },

    // Return array with every row
    get rows() {
      return unique(Array.apply(getTop(), Array(1 + (getBottom() - getTop()))).map(function (x, y) {
        return index2row(y + getTop());
      }));
    }

  };
}

// Returns a cell indirection
function indirect(ref) {
  return ref(ref);
}

// Copyright 2015 Peter W Moresi

// ISEMAIL returns true when the `value` matches the regex.
function isemail(value) {
  // credit to http://stackoverflow.com/questions/46155/validate-email-address-in-javascript
  var re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(value);
};

// Copyright 2015 Peter W Moresi

// ISEVEN returns true when the value is even.
function iseven(value) {
  return !(Math.floor(Math.abs(value)) & 1);
}

// ISNA returns true when the value is `#NA!`
function isna(value) {
  return value === error$2.na;
}

// Copyright 2015 Peter W Moresi

// ISODD returns true when the value is odd.
function isodd(value) {
  return !!(Math.floor(Math.abs(value)) & 1);
}

// Copyright 2015 Peter W Moresi

// ISURL returns true when the value matches the regex for a uniform resource locator.
function isurl(str) {
  // credit: http://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-an-url
  var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
  '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|' + // domain name
  '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
  '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
  '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
  '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
  return pattern.test(str);
}

// LEN returns the size of a string or array.
function len(text) {
  if (arguments.length === 0) {
    return error$2.error;
  }

  if (typeof text === 'string') {
    return text.length;
  }

  if (text.length) {
    return text.length;
  }

  return error$2.value;
};

// Copyright 2015 Peter W Moresi

// LOOKUP find a value in an array.
function lookup() {
  var lookup_value, lookup_array, lookup_vector, results_vector;
  if (arguments.length === 2) {
    // array form
    var wide = false;

    lookup_value = arguments[0].valueOf();
    lookup_array = arguments[1];

    for (var i = 0; i < lookup_array.length; i++) {
      if (typeof lookup_array[i] !== 'undefined' && lookup_value === lookup_array[i].valueOf()) {
        return lookup_array[i];
      }
    }
  } else if (arguments.length === 3) {
    // vector form`
    lookup_value = arguments[0].valueOf();
    lookup_vector = arguments[1];
    results_vector = arguments[2];

    for (var i = 0; i < lookup_vector.length; i++) {
      if (typeof lookup_vector[i] !== 'undefined' && lookup_value === lookup_vector[i].valueOf()) {
        return results_vector[i];
      }
    }
  }

  return error.na;
}

// LOWER converts `value` to lower case
function lower(value) {
  if (!istext(value)) return error$2.value;
  return value.toLowerCase();
}

// LT compares two values and returns true when a is less than b.
function lt(a, b) {
  if (isref(a) && isref(b)) {
    return error.na;
  } else if (isarray(a) && isarray(b)) {
    return error.na;
  } else if (isref(a) || isarray(a)) {
    return a.map(function (d) {
      return d < b;
    });
  } else if (isref(b) || isarray(b)) {
    return b.map(function (d) {
      return d < a;
    });
  } else {
    return a < b;
  }
}

// LT compares two values and returns true when a is less than or equal to b.
function lte(a, b) {
  if (isref(a) && isref(b)) {
    return error.na;
  } else if (isarray(a) && isarray(b)) {
    return error.na;
  } else if (isref(a) || isarray(a)) {
    return a.map(function (d) {
      return d <= b;
    });
  } else if (isref(b) || isarray(b)) {
    return b.map(function (d) {
      return d <= a;
    });
  } else {
    return a <= b;
  }
}

// MIN returns the smallest number from a `list`.
function min() {
  for (var _len8 = arguments.length, list = Array(_len8), _key8 = 0; _key8 < _len8; _key8++) {
    list[_key8] = arguments[_key8];
  }

  return flatten(list).reduce(function (min, next) {
    if (isnumber(next)) {
      return Math.min(min, next);
    }

    return min;
  }, Number.POSITIVE_INFINITY);
}

// MAX returns the largest number from a `list`.
function max() {
  for (var _len9 = arguments.length, list = Array(_len9), _key9 = 0; _key9 < _len9; _key9++) {
    list[_key9] = arguments[_key9];
  }

  return flatten(list).reduce(function (max, next) {
    if (isnumber(next)) {
      return Math.max(max, next);
    }

    return max;
  }, Number.NEGATIVE_INFINITY);
}

// MULTIPLY calculates the product of two numbers.
function multiply() {
  for (var _len10 = arguments.length, values = Array(_len10), _key10 = 0; _key10 < _len10; _key10++) {
    values[_key10] = arguments[_key10];
  }

  // Return `#NA!` if 2 arguments are not provided.
  if (values.length !== 2) {
    return error$2.na;
  }

  // decompose values into a and b.
  var a = values[0];
  var b = values[1];

  // Return `#VALUE!` if either a or b is not a number.

  if (!isnumber(a) || !isnumber(b)) {
    return error$2.value;
  }

  // Return the product
  return a * b;
}

// N converts a `value` to a number. It supports numbers, true, false and dates.
function n(value) {

  // Pass numbers and errors back out.
  if (isnumber(value) || iserror(value)) {
    return value;
  }

  // Convert dates to serial number.
  if (value instanceof Date) {
    return serial(value);
  }

  // Convert true to 1
  if (value === true) {
    return 1;
  }

  // Convert false to 0
  if (value === false) {
    return 0;
  }

  // Return 0 in all other cases.
  return 0;
}

// Convert a text value into a number value.
function numbervalue(text, decimal_separator, group_separator) {
  decimal_separator = decimal_separator || '.';
  group_separator = group_separator || ',';

  // Return `#VALUE!` when text is empty
  if (isempty(text)) {
    return error$2.value;
  }

  // Return the value when it is already a number.
  if (isnumber(text)) {
    return text;
  }

  var foundDecimal = false,
      len = text.length - 1;

  if (text.length === 1) {
    if (text.charCodeAt(0) < 48 || text.charCodeAt(0) > 57) {
      return error$2.value;
    }
    return +text;
  }

  return text.split('').reduce(function (acc, item, index) {
    if (acc === error$2.value) {
      return error$2.value;
    } else if (len === index) {
      if (item === '%') {
        return +acc / 100;
      }
      return +acc.concat(item);
    } else if (item === decimal_separator) {
      if (foundDecimal) return error$2.value;
      foundDecimal = true;
      return acc.concat('.');
    } else if (item === group_separator) {
      return acc;
      // check if between 0 and 9 ascii codes
    } else if (item.charCodeAt(0) < 48 || item.charCodeAt(0) > 57) {
        return error$2.value;
      }

    return acc.concat(item);
  });
};

// NE returns true when a is not equal to b.
function ne(a, b) {
  return !eq(a, b);
}

// NOT negates a `value`
function not(value) {
  return value !== true && value !== false && value !== 1 && value !== 0 ? error$2.value : !value;
}

// OCT2DEC converts a octal value into a decimal value.
function oct2dec(octalNumber) {
  // Credits: Based on implementation found in https://gist.github.com/ghalimi/4525876#file-oct2dec-js
  // Return error.when number passed in is not octal or has more than 10 digits
  if (!/^[0-7]{1,10}$/.test(octalNumber)) return error$2.num;

  // Convert octal number to decimal number
  var nonNegativeDecimalNumber = parseInt(octalNumber, 8);

  // Returns the corresponding decimal number
  // Two's Complement Decimal Range: -(2^N-1) to (2^N-1 - 1) where N=30 (N = number of bits) and ^ means raised to the power of
  // 2^N-1 = 2^(30 - 1) = 2^29 = 536870912
  // 2^N-1 - 1 = 536870912 - 1 = 536870911
  // 2^N = 2^30 = 1073741824
  // Two's Complement Decimal Range: [-536870912,536870911]
  // Largest octal number allowed: 7777777777 which in decimal is 1073741823 = 2^N - 1
  // Case 1: Negative Range
  //  if nonNegativeDecimalNumber >= 2^N-1, then return (nonNegativeNumber - 2^N)
  //  Smallest Number: 2^N-1 - 2^N = 2^N-1 - 2*2^N-1 = 2^N-1 * (1 - 2) = 2^N-1 * (-1) = -2^N-1
  //  Largest Number: (2^N - 1) - (2^N) = (2^N - 2^N) - 1 = -1
  //  Range: [-2^N-1, -1] = [-536870912, -1]
  //
  // Smallest octal number allowed: 0 which in decimal is 0
  // Case 2: Non-Negative Range
  //   Range: [0, 2^N-1 - 1] = [0, 536870911]

  return nonNegativeDecimalNumber >= 536870912 ? nonNegativeDecimalNumber - 1073741824 : nonNegativeDecimalNumber;
}

// OR returns true when any of the criter is true or 1.
function or() {
  for (var _len11 = arguments.length, criteria = Array(_len11), _key11 = 0; _key11 < _len11; _key11++) {
    criteria[_key11] = arguments[_key11];
  }

  return criteria.reduce(function (acc, item) {
    if (acc === true) return true;
    var value = isfunction(item) ? item() : item;
    return value === true || value === 1;
  }, false);
}

// PI returns half the universal circle constant
function pi() {
  return τ / 2;
}

// PMT returns a loan payment
function pmt(rate, periods, present) {
  var future = arguments.length <= 3 || arguments[3] === undefined ? 0 : arguments[3];
  var type = arguments.length <= 4 || arguments[4] === undefined ? 0 : arguments[4];


  if (!isnumber(rate) || !isnumber(periods)) {
    return error$2.value;
  }

  if (rate === 0) {
    return -((present + future) / periods);
  } else {
    var term = Math.pow(1 + rate, periods);
    if (type === 1) {
      return -((future * rate / (term - 1) + present * rate / (1 - 1 / term)) / (1 + rate));
    } else {
      return -(future * rate / (term - 1) + present * rate / (1 - 1 / term));
    }
  }
};

// POWER computes the power of a value and nth degree.
function power() {
  for (var _len12 = arguments.length, values = Array(_len12), _key12 = 0; _key12 < _len12; _key12++) {
    values[_key12] = arguments[_key12];
  }

  // Return `#NA!` if 2 arguments are not provided.
  if (values.length !== 2) {
    return error$2.na;
  }

  // decompose values into a and b.
  var val = values[0];
  var nth = values[1];

  // Return `#VALUE!` if either a or b is not a number.

  if (!isnumber(val) || !isnumber(nth)) {
    return error$2.value;
  }

  // Compute the power of val to the nth.
  return Math.pow(val, nth);
}

// REPLACE returns a new string after replacing with `new_text`.
function replace(text, position, length, new_text) {

  if (iserror(position) || iserror(length) || typeof text !== 'string' || typeof new_text !== 'string') {
    return error$2.value;
  }
  return text.substr(0, position - 1) + new_text + text.substr(position - 1 + length);
}

// RIGHT pulls a given number of character from the right side of `text`.
function right(text, number) {

  if (isblank(text)) {
    return '';
  }

  if (!n(+number)) {
    return text;
  }

  return text.substring(text.length - number);
}

// Copyright 2015 Peter W Moresi

// CONVERT a number to a fixed precision.
function round(number, precision) {
  return +number.toFixed(precision);
}

// Copyright 2015 Peter W Moresi

// ROUNDUP converts a number to a fixed precision by rounding up.
function roundup(number, precision) {
  var factors = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000];
  var factor = factors[precision];
  if (number > 0) {
    return Math.ceil(number * factor) / factor;
  } else {
    return Math.floor(number * factor) / factor;
  }
}

// SEARCH finds text using wildcards ?, *, ~?, and ~*.
function search(find_text, within_text, position) {
  if (!within_text) {
    return null;
  }
  position = typeof position === 'undefined' ? 1 : position;

  // The SEARCH function translated the find_text into a regex.
  var find_exp = find_text.replace(/([^~])\?/g, '$1.') // convert ? into .
  .replace(/([^~])\*/g, '$1.*') // convert * into .*
  .replace(/([~])\?/g, '\\?') // convert ~? into \?
  .replace(/([~])\*/g, '\\*'); // convert ~* into \*

  position = new RegExp(find_exp, "i").exec(within_text);

  if (position) {
    return position.index + 1;
  }
  return error$2.value;
}

// SIN calculates the sinine of a value.
function sin(value) {

  if (!isnumber(value)) {
    return error$2.value;
  }

  return Math.sin(value);
}

// INT returns true when a needle is found in a list.
function some(needle, list) {

  // Return `#NA!` when the needle and list are blank.
  if (isblank(needle) && isblank(list)) {
    return error$2.na;
  }

  // Return `#NA!` when the list is not an array.
  if (!isarray(list)) {
    return error$2.na;
  }

  // Return true when some of the values match the needle.
  return list.some(function (n) {
    return eq(n, needle);
  });
}

// SORT a reference or an array.
//
// The criteria may use 1 of several forms:
//
// sort(reference(reference: Array, ...criteria : List<string>)
// sort(reference(reference: Range, ...criteria : List<string>)
//
// The List<function> will be reduced into a single function.
//
// The list<string> will also be reduced into a single function which
// interprets the strings as pairs. The odd items are fields and the
// even ones are direction (ASC|DESC).
function sort(ref) {
  for (var _len13 = arguments.length, criteria = Array(_len13 > 1 ? _len13 - 1 : 0), _key13 = 1; _key13 < _len13; _key13++) {
    criteria[_key13 - 1] = arguments[_key13];
  }

  // reduce the criteria array into a function
  var makeComparer = function makeComparer() {
    return function (a, b) {
      var result = 0;
      for (var i = 0; i < criteria.length; i + 2) {
        var field = typeof criteria[i] === 'string' ? criteria[i] : criteria[i] - 1,
            order = criteria[i + 1];

        if (a[field] < b[field]) {
          return order ? -1 : 1;
        } else {
          return order ? 1 : -1;
        }
      }

      return result;
    };
  };

  if (isref(ref) || isarray(ref)) {
    return ref.sort(makeComparer());
  }

  return error$2.na;
}

// Copyright 2015 Peter W Moresi

// SPLIT `text` given a `delimiter`.
function split(text, delimiter) {
  return text.split(delimiter);
}

// Copyright 2015 Peter W Moresi

// SUBSTITUTE `old_text` with `new_text` a given number of occurrences in `text`.
function substitute(text, old_text, new_text, occurrence) {
  if (!text || !old_text || !new_text) {
    return text;
  } else if (occurrence === undefined) {
    return text.replace(new RegExp(old_text, 'g'), new_text);
  } else {
    var index = 0;
    var i = 0;
    while (text.indexOf(old_text, index) > 0) {
      index = text.indexOf(old_text, index + 1);
      i++;
      if (i === occurrence) {
        return text.substring(0, index) + new_text + text.substring(index + old_text.length);
      }
    }
  }
}

// SUBTRACT calculates the difference of two numbers.
function subtract() {
  for (var _len14 = arguments.length, values = Array(_len14), _key14 = 0; _key14 < _len14; _key14++) {
    values[_key14] = arguments[_key14];
  }

  // Return `#NA!` if 2 arguments are not provided.
  if (values.length !== 2) {
    return error$2.na;
  }

  // decompose values into a and b.
  var a = values[0];
  var b = values[1];

  // Return `#VALUE!` if either a or b is not a number.

  if (!isnumber(a) || !isnumber(b)) {
    return error$2.value;
  }

  // Return the difference.
  return a - b;
}

// TAN computes the tagent of a value.
function tan(value) {

  if (!isnumber(value)) {
    return error$2.value;
  }

  return Math.tan(value);
}

// TAU returns the universal circle constant
function tau() {
  return τ;
}

var FormatNumber = {};

FormatNumber.format_definitions = {}; // Parsed formats are stored here globally

// Other constants

FormatNumber.commands = {
  copy: 1, color: 2, integer_placeholder: 3, fraction_placeholder: 4, decimal: 5,
  currency: 6, general: 7, separator: 8, date: 9, comparison: 10, section: 11, style: 12
};

/* *******************

result = FormatNumber.formatNumberWithFormat = function(rawvalue, format_string, currency_char)

************************* */

FormatNumber.formatNumberWithFormat = function (rawvalue, format_string, currency_char) {

  var scfn = FormatNumber;

  var op, operandstr, fromend, cval, operandstrlc;
  var startval, estartval;
  var hrs, mins, secs, ehrs, emins, esecs, ampmstr, ymd;
  var minOK, mpos, mspos;
  var result = '';
  var format;
  var section, gotcomparison, compop, compval, cpos, oppos;
  var sectioninfo;
  var i, decimalscale, scaledvalue, strvalue, strparts, integervalue, fractionvalue;
  var integerdigits2, integerpos, fractionpos, textcolor, textstyle, separatorchar, decimalchar;
  var value; // working copy to change sign, etc.

  rawvalue = rawvalue - 0; // make sure a number
  value = rawvalue;
  if (!isFinite(value)) return 'NaN';

  var negativevalue = value < 0 ? 1 : 0; // determine sign, etc.
  if (negativevalue) value = -value;
  var zerovalue = value == 0 ? 1 : 0;

  currency_char = currency_char || DefaultCurrency;

  FormatNumber.parse_format_string(scfn.format_definitions, format_string); // make sure format is parsed
  //console.log("format_string", format_string, format)
  format = scfn.format_definitions[format_string]; // Get format structure
  //console.log("format", format)

  if (!format) throw 'Format not parsed error.';

  section = format.sectioninfo.length - 1; // get number of sections - 1

  // has comparisons - determine which section
  if (format.hascomparison) {
    section = 0; // set to which section we will use
    gotcomparison = 0; // this section has no comparison
    for (cpos = 0;; cpos++) {
      // scan for comparisons
      op = format.operators[cpos];
      operandstr = format.operands[cpos]; // get next operator and operand

      // at end with no match
      if (!op) {
        // if comparison but no match
        if (gotcomparison) {
          format_string = 'General'; // use default of General
          scfn.parse_format_string(scfn.format_definitions, format_string);
          format = scfn.format_definitions[format_string];
          section = 0;
        }
        break; // if no comparision, matches on this section
      }
      // end of section
      if (op == scfn.commands.section) {
        if (!gotcomparison) {
          // no comparison, so it's a match
          break;
        }
        gotcomparison = 0;
        section++; // check out next one
        continue;
      }
      // found a comparison - do we meet it?
      if (op == scfn.commands.comparison) {
        i = operandstr.indexOf(':');
        compop = operandstr.substring(0, i);
        compval = operandstr.substring(i + 1) - 0;
        if (compop == '<' && rawvalue < compval || compop == '<=' && rawvalue <= compval || compop == '=' && rawvalue == compval || compop == '<>' && rawvalue != compval || compop == '>=' && rawvalue >= compval || compop == '>' && rawvalue > compval) {
          break;
        }
        gotcomparison = 1;
      }
    }
  }
  // more than one section (separated by ";")
  else if (section > 0) {
      // two sections
      if (section == 1) {
        if (negativevalue) {
          negativevalue = 0; // sign will provided by section, not automatically
          section = 1; // use second section for negative values
        } else {
            section = 0; // use first for all others
          }
      }
      // three sections
      else if (section == 2) {
          if (negativevalue) {
            negativevalue = 0; // sign will provided by section, not automatically
            section = 1; // use second section for negative values
          } else if (zerovalue) {
              section = 2; // use third section for zero values
            } else {
                section = 0; // use first for positive
              }
        }
    }

  sectioninfo = format.sectioninfo[section]; // look at values for our section

  if (sectioninfo.commas > 0) {
    // scale by thousands
    for (i = 0; i < sectioninfo.commas; i++) {
      value /= 1000;
    }
  }
  if (sectioninfo.percent > 0) {
    // do percent scaling
    for (i = 0; i < sectioninfo.percent; i++) {
      value *= 100;
    }
  }

  decimalscale = 1; // cut down to required number of decimal digits
  for (i = 0; i < sectioninfo.fractiondigits; i++) {
    decimalscale *= 10;
  }
  scaledvalue = Math.floor(value * decimalscale + 0.5);
  scaledvalue = scaledvalue / decimalscale;

  if (typeof scaledvalue != 'number') return 'NaN';
  if (!isFinite(scaledvalue)) return 'NaN';

  strvalue = scaledvalue + ''; // convert to string (Number.toFixed doesn't do all we need)

  //   strvalue = value.toFixed(sectioninfo.fractiondigits); // cut down to required number of decimal digits
  // and convert to string

  if (scaledvalue == 0 && (sectioninfo.fractiondigits || sectioninfo.integerdigits)) {
    negativevalue = 0; // no "-0" unless using multiple sections or General
  }

  //console.log(rawvalue+'')

  // converted to scientific notation
  if (strvalue.indexOf('e') >= 0) {
    return rawvalue + ''; // Just return plain converted raw value
  }

  strparts = strvalue.match(/^\+{0,1}(\d*)(?:\.(\d*)){0,1}$/); // get integer and fraction parts
  if (!strparts) return 'NaN'; // if not a number
  integervalue = strparts[1];
  if (!integervalue || integervalue == '0') integervalue = '';
  fractionvalue = strparts[2];
  if (!fractionvalue) fractionvalue = '';

  // there are date placeholders
  if (sectioninfo.hasdate) {
    //console.log('hasdate')
    // bad date
    if (rawvalue < 0) {
      return '??-???-?? ??:??:??';
    }
    startval = (rawvalue - Math.floor(rawvalue)) * SecondsInDay; // get date/time parts
    estartval = rawvalue * SecondsInDay; // do elapsed time version, too
    hrs = Math.floor(startval / SecondsInHour);
    ehrs = Math.floor(estartval / SecondsInHour);
    startval = startval - hrs * SecondsInHour;
    mins = Math.floor(startval / 60);
    emins = Math.floor(estartval / 60);
    secs = startval - mins * 60;
    decimalscale = 1; // round appropriately depending if there is ss.0
    for (i = 0; i < sectioninfo.fractiondigits; i++) {
      decimalscale *= 10;
    }
    secs = Math.floor(secs * decimalscale + 0.5);
    secs = secs / decimalscale;
    esecs = Math.floor(estartval * decimalscale + 0.5);
    esecs = esecs / decimalscale;
    if (secs >= 60) {
      // handle round up into next second, minute, etc.
      secs = 0;
      mins++;emins++;
      if (mins >= 60) {
        mins = 0;
        hrs++;ehrs++;
        if (hrs >= 24) {
          hrs = 0;
          rawvalue++;
        }
      }
    }
    fractionvalue = secs - Math.floor(secs) + ''; // for "hh:mm:ss.000"
    fractionvalue = fractionvalue.substring(2); // skip "0."

    ymd = parsedate(rawvalue);
    ymd = {
      year: ymd.getFullYear(),
      month: ymd.getMonth() + 1,
      day: ymd.getDate()
    };

    minOK = 0; // says "m" can be minutes if true
    mspos = sectioninfo.sectionstart; // m scan position in ops
    for (;; mspos++) {
      // scan for "m" and "mm" to see if any minutes fields, and am/pm
      op = format.operators[mspos];
      operandstr = format.operands[mspos]; // get next operator and operand
      if (!op) break; // don't go past end
      if (op == scfn.commands.section) break;
      if (op == scfn.commands.date) {
        if ((operandstr.toLowerCase() == 'am/pm' || operandstr.toLowerCase() == 'a/p') && !ampmstr) {
          if (hrs >= 12) {
            hrs -= 12;
            ampmstr = operandstr.toLowerCase() == 'a/p' ? PM1 : PM; // "P" : "PM";
          } else {
              ampmstr = operandstr.toLowerCase() == 'a/p' ? AM1 : AM; // "A" : "AM";
            }
          if (operandstr.indexOf(ampmstr) < 0) ampmstr = ampmstr.toLowerCase(); // have case match case in format
        }
        if (minOK && (operandstr == 'm' || operandstr == 'mm')) {
          format.operands[mspos] += 'in'; // turn into "min" or "mmin"
        }
        if (operandstr.charAt(0) == 'h') {
          minOK = 1; // m following h or hh or [h] is minutes not months
        } else {
            minOK = 0;
          }
      } else if (op != scfn.commands.copy) {
        // copying chars can be between h and m
        minOK = 0;
      }
    }
    minOK = 0;
    for (--mspos;; mspos--) {
      // scan other way for s after m
      op = format.operators[mspos];
      operandstr = format.operands[mspos]; // get next operator and operand
      if (!op) break; // don't go past end
      if (op == scfn.commands.section) break;
      if (op == scfn.commands.date) {
        if (minOK && (operandstr == 'm' || operandstr == 'mm')) {
          format.operands[mspos] += 'in'; // turn into "min" or "mmin"
        }
        if (operandstr == 'ss') {
          minOK = 1; // m before ss is minutes not months
        } else {
            minOK = 0;
          }
      } else if (op != scfn.commands.copy) {
        // copying chars can be between ss and m
        minOK = 0;
      }
    }
  }

  integerdigits2 = 0; // init counters, etc.
  integerpos = 0;
  fractionpos = 0;
  textcolor = '';
  textstyle = '';
  separatorchar = SeparatorChar;
  if (separatorchar.indexOf(' ') >= 0) separatorchar = separatorchar.replace(/ /g, ' ');
  decimalchar = DecimalChar;
  if (decimalchar.indexOf(' ') >= 0) decimalchar = decimalchar.replace(/ /g, ' ');

  oppos = sectioninfo.sectionstart;

  while (op = format.operators[oppos]) {
    // execute format
    operandstr = format.operands[oppos++]; // get next operator and operand

    if (op == scfn.commands.copy) {
      // put char in result
      result += operandstr;
    } else if (op == scfn.commands.color) {
      // set color
      textcolor = operandstr;
    } else if (op == scfn.commands.style) {
      // set style
      textstyle = operandstr;
    } else if (op == scfn.commands.integer_placeholder) {
      // insert number part
      if (negativevalue) {
        result += '-';
        negativevalue = 0;
      }
      integerdigits2++;
      if (integerdigits2 == 1) {
        // first one
        if (integervalue.length > sectioninfo.integerdigits) {
          // see if integer wider than field
          for (; integerpos < integervalue.length - sectioninfo.integerdigits; integerpos++) {
            result += integervalue.charAt(integerpos);
            if (sectioninfo.thousandssep) {
              // see if this is a separator position
              fromend = integervalue.length - integerpos - 1;
              if (fromend > 2 && fromend % 3 == 0) {
                result += separatorchar;
              }
            }
          }
        }
      }
      if (integervalue.length < sectioninfo.integerdigits && integerdigits2 <= sectioninfo.integerdigits - integervalue.length) {
        // field is wider than value
        if (operandstr == '0' || operandstr == '?') {
          // fill with appropriate characters
          result += operandstr == '0' ? '0' : ' ';
          if (sectioninfo.thousandssep) {
            // see if this is a separator position
            fromend = sectioninfo.integerdigits - integerdigits2;
            if (fromend > 2 && fromend % 3 == 0) {
              result += separatorchar;
            }
          }
        }
      } else {
        // normal integer digit - add it
        result += integervalue.charAt(integerpos);
        if (sectioninfo.thousandssep) {
          // see if this is a separator position
          fromend = integervalue.length - integerpos - 1;
          if (fromend > 2 && fromend % 3 == 0) {
            result += separatorchar;
          }
        }
        integerpos++;
      }
    } else if (op == scfn.commands.fraction_placeholder) {
      // add fraction part of number
      if (fractionpos >= fractionvalue.length) {
        if (operandstr == '0' || operandstr == '?') {
          result += operandstr == '0' ? '0' : ' ';
        }
      } else {
        result += fractionvalue.charAt(fractionpos);
      }
      fractionpos++;
    } else if (op == scfn.commands.decimal) {
      // decimal point
      if (negativevalue) {
        result += '-';
        negativevalue = 0;
      }
      result += decimalchar;
    } else if (op == scfn.commands.currency) {
      // currency symbol
      if (negativevalue) {
        result += '-';
        negativevalue = 0;
      }
      result += operandstr;
    } else if (op == scfn.commands.general) {
      // insert "General" conversion

      // *** Cut down number of significant digits to avoid floating point artifacts:

      if (value != 0) {
        // only if non-zero
        var factor = Math.floor(Math.LOG10E * Math.log(value)); // get integer magnitude as a power of 10
        factor = Math.pow(10, 13 - factor); // turn into scaling factor
        value = Math.floor(factor * value + 0.5) / factor; // scale positive value, round, undo scaling
        if (!isFinite(value)) return 'NaN';
      }
      if (negativevalue) {
        result += '-';
      }
      strvalue = value + ''; // convert original value to string
      if (strvalue.indexOf('e') >= 0) {
        // converted to scientific notation
        result += strvalue;
        continue;
      }
      strparts = strvalue.match(/^\+{0,1}(\d*)(?:\.(\d*)){0,1}$/); // get integer and fraction parts
      integervalue = strparts[1];
      if (!integervalue || integervalue == '0') integervalue = '';
      fractionvalue = strparts[2];
      if (!fractionvalue) fractionvalue = '';
      integerpos = 0;
      fractionpos = 0;
      if (integervalue.length) {
        for (; integerpos < integervalue.length; integerpos++) {
          result += integervalue.charAt(integerpos);
          if (sectioninfo.thousandssep) {
            // see if this is a separator position
            fromend = integervalue.length - integerpos - 1;
            if (fromend > 2 && fromend % 3 == 0) {
              result += separatorchar;
            }
          }
        }
      } else {
        result += '0';
      }
      if (fractionvalue.length) {
        result += decimalchar;
        for (; fractionpos < fractionvalue.length; fractionpos++) {
          result += fractionvalue.charAt(fractionpos);
        }
      }
    } else if (op == scfn.commands.date) {
      // date placeholder
      operandstrlc = operandstr.toLowerCase();
      if (operandstrlc == 'y' || operandstrlc == 'yy') {
        result += (ymd.year + '').substring(2);
      } else if (operandstrlc == 'yyyy') {
        result += ymd.year + '';
      } else if (operandstrlc == 'd') {
        result += ymd.day + '';
      } else if (operandstrlc == 'dd') {
        cval = 1000 + ymd.day;
        result += (cval + '').substr(2);
      } else if (operandstrlc == 'ddd') {
        cval = Math.floor(rawvalue + 6) % 7;
        result += DayNames3[cval];
      } else if (operandstrlc == 'dddd') {
        cval = Math.floor(rawvalue + 6) % 7;
        result += DayNames[cval];
      } else if (operandstrlc == 'm') {
        result += ymd.month + '';
      } else if (operandstrlc == 'mm') {
        cval = 1000 + ymd.month;
        result += (cval + '').substr(2);
      } else if (operandstrlc == 'mmm') {
        result += MonthNames3[ymd.month - 1];
      } else if (operandstrlc == 'mmmm') {
        result += MonthNames[ymd.month - 1];
      } else if (operandstrlc == 'mmmmm') {
        result += MonthNames[ymd.month - 1].charAt(0);
      } else if (operandstrlc == 'h') {
        result += hrs + '';
      } else if (operandstrlc == 'h]') {
        result += ehrs + '';
      } else if (operandstrlc == 'mmin') {
        cval = 1000 + mins + '';
        result += cval.substr(2);
      } else if (operandstrlc == 'mm]') {
        if (emins < 100) {
          cval = 1000 + emins + '';
          result += cval.substr(2);
        } else {
          result += emins + '';
        }
      } else if (operandstrlc == 'min') {
        result += mins + '';
      } else if (operandstrlc == 'm]') {
        result += emins + '';
      } else if (operandstrlc == 'hh') {
        cval = 1000 + hrs + '';
        result += cval.substr(2);
      } else if (operandstrlc == 's') {
        cval = Math.floor(secs);
        result += cval + '';
      } else if (operandstrlc == 'ss') {
        cval = 1000 + Math.floor(secs) + '';
        result += cval.substr(2);
      } else if (operandstrlc == 'am/pm' || operandstrlc == 'a/p') {
        result += ampmstr;
      } else if (operandstrlc == 'ss]') {
        if (esecs < 100) {
          cval = 1000 + Math.floor(esecs) + '';
          result += cval.substr(2);
        } else {
          cval = Math.floor(esecs);
          result += cval + '';
        }
      }
    } else if (op == scfn.commands.section) {
      // end of section
      break;
    } else if (op == scfn.commands.comparison) {
      // ignore
      continue;
    } else {
      result += '!! Parse error.!!';
    }
  }

  if (textcolor) {
    result = '<span style="color:' + textcolor + ';">' + result + '</span>';
  }
  if (textstyle) {
    result = '<span style="' + textstyle + ';">' + result + '</span>';
  }

  //console.log(result)

  return result;
};

/* *******************

FormatNumber.parse_format_string(format_defs, format_string)

Takes a format string (e.g., "#,##0.00_);(#,##0.00)") and fills in format_defs with the parsed info

format_defs
["#,##0.0"]->{} - elements in the hash are one hash for each format
.operators->[] - array of operators from parsing the format string (each a number)
.operands->[] - array of corresponding operators (each usually a string)
.sectioninfo->[] - one hash for each section of the format
.start
.integerdigits
.fractiondigits
.commas
.percent
.thousandssep
.hasdates
.hascomparison - true if any section has [<100], etc.

************************* */

FormatNumber.parse_format_string = function (format_defs, format_string) {

  var scfn = FormatNumber;

  var format, section, sectioninfo;
  var integerpart = 1; // start out in integer part
  var lastwasinteger; // last char was an integer placeholder
  var lastwasslash; // last char was a backslash - escaping following character
  var lastwasasterisk; // repeat next char
  var lastwasunderscore; // last char was _ which picks up following char for width
  var inquote, quotestr; // processing a quoted string
  var inbracket, bracketstr, bracketdata; // processing a bracketed string
  var ingeneral, gpos; // checks for characters "General"
  var ampmstr, part; // checks for characters "A/P" and "AM/PM"
  var indate; // keeps track of date/time placeholders
  var chpos; // character position being looked at
  var ch; // character being looked at

  if (format_defs[format_string]) return; // already defined - nothing to do

  format = { operators: [], operands: [], sectioninfo: [{}] }; // create info structure for this format
  format_defs[format_string] = format; // add to other format definitions

  section = 0; // start with section 0
  sectioninfo = format.sectioninfo[section]; // get reference to info for current section
  sectioninfo.sectionstart = 0; // position in operands that starts this section
  sectioninfo.integerdigits = 0; // number of integer-part placeholders
  sectioninfo.fractiondigits = 0; // fraction placeholders
  sectioninfo.commas = 0; // commas encountered, to handle scaling
  sectioninfo.percent = 0; // times to scale by 100

  for (chpos = 0; chpos < format_string.length; chpos++) {
    // parse
    ch = format_string.charAt(chpos); // get next char to examine
    if (inquote) {
      if (ch == '"') {
        inquote = 0;
        format.operators.push(scfn.commands.copy);
        format.operands.push(quotestr);
        continue;
      }
      quotestr += ch;
      continue;
    }
    if (inbracket) {
      if (ch == ']') {
        inbracket = 0;
        bracketdata = FormatNumber.parse_format_bracket(bracketstr);
        if (bracketdata.operator == scfn.commands.separator) {
          sectioninfo.thousandssep = 1; // explicit [,]
          continue;
        }
        if (bracketdata.operator == scfn.commands.date) {
          sectioninfo.hasdate = 1;
        }
        if (bracketdata.operator == scfn.commands.comparison) {
          format.hascomparison = 1;
        }
        format.operators.push(bracketdata.operator);
        format.operands.push(bracketdata.operand);
        continue;
      }
      bracketstr += ch;
      continue;
    }

    if (lastwasslash) {
      format.operators.push(scfn.commands.copy);
      format.operands.push(ch);
      lastwasslash = false;
      continue;
    }

    if (lastwasasterisk) {
      format.operators.push(scfn.commands.copy);
      format.operands.push(ch + ch + ch + ch + ch); // do 5 of them since no real tabs
      lastwasasterisk = false;
      continue;
    }

    if (lastwasunderscore) {
      format.operators.push(scfn.commands.copy);
      format.operands.push(' ');
      lastwasunderscore = false;
      continue;
    }

    if (ingeneral) {
      if ('general'.charAt(ingeneral) == ch.toLowerCase()) {
        ingeneral++;
        if (ingeneral == 7) {
          format.operators.push(scfn.commands.general);
          format.operands.push(ch);
          ingeneral = 0;
        }
        continue;
      }
      ingeneral = 0;
    }

    // last char was part of a date placeholder
    if (indate) {
      //console.log('foo')
      if (indate.charAt(0) == ch) {
        // another of the same char
        indate += ch; // accumulate it
        continue;
      }
      format.operators.push(scfn.commands.date); // something else, save date info
      format.operands.push(indate);
      sectioninfo.hasdate = 1;
      indate = '';
    }
    if (ampmstr) {
      ampmstr += ch;
      part = ampmstr.toLowerCase();
      if (part != 'am/pm'.substring(0, part.length) && part != 'a/p'.substring(0, part.length)) {
        ampstr = '';
      } else if (part == 'am/pm' || part == 'a/p') {
        format.operators.push(scfn.commands.date);
        format.operands.push(ampmstr);
        ampmstr = '';
      }
      continue;
    }
    if (ch == '#' || ch == '0' || ch == '?') {
      // placeholder
      if (integerpart) {
        sectioninfo.integerdigits++;
        if (sectioninfo.commas) {
          // comma inside of integer placeholders
          sectioninfo.thousandssep = 1; // any number is thousands separator
          sectioninfo.commas = 0; // reset count of "thousand" factors
        }
        lastwasinteger = 1;
        format.operators.push(scfn.commands.integer_placeholder);
        format.operands.push(ch);
      } else {
        sectioninfo.fractiondigits++;
        format.operators.push(scfn.commands.fraction_placeholder);
        format.operands.push(ch);
      }
    } else if (ch == '.') {
      lastwasinteger = 0;
      format.operators.push(scfn.commands.decimal);
      format.operands.push(ch);
      integerpart = 0;
    } else if (ch === '$') {
      lastwasinteger = 0;
      format.operators.push(scfn.commands.currency);
      format.operands.push(ch);
    } else if (ch == ',') {
      if (lastwasinteger) {
        sectioninfo.commas++;
      } else {
        format.operators.push(scfn.commands.copy);
        format.operands.push(ch);
      }
    } else if (ch == '%') {
      lastwasinteger = 0;
      sectioninfo.percent++;
      format.operators.push(scfn.commands.copy);
      format.operands.push(ch);
    } else if (ch == '"') {
      lastwasinteger = 0;
      inquote = 1;
      quotestr = '';
    } else if (ch == '[') {
      lastwasinteger = 0;
      inbracket = 1;
      bracketstr = '';
    } else if (ch == '\\') {
      lastwasslash = 1;
      lastwasinteger = 0;
    } else if (ch == '*') {
      lastwasasterisk = 1;
      lastwasinteger = 0;
    } else if (ch == '_') {
      lastwasunderscore = 1;
      lastwasinteger = 0;
    } else if (ch == ';') {
      section++; // start next section
      format.sectioninfo[section] = {}; // create a new section
      sectioninfo = format.sectioninfo[section]; // get reference to info for current section
      sectioninfo.sectionstart = 1 + format.operators.length; // remember where it starts
      sectioninfo.integerdigits = 0; // number of integer-part placeholders
      sectioninfo.fractiondigits = 0; // fraction placeholders
      sectioninfo.commas = 0; // commas encountered, to handle scaling
      sectioninfo.percent = 0; // times to scale by 100
      integerpart = 1; // reset for new section
      lastwasinteger = 0;
      format.operators.push(scfn.commands.section);
      format.operands.push(ch);
    } else if (ch.toLowerCase() == 'g') {
      ingeneral = 1;
      lastwasinteger = 0;
    } else if (ch.toLowerCase() == 'a') {
      ampmstr = ch;
      lastwasinteger = 0;
    } else if ('dmyhHs'.indexOf(ch) >= 0) {
      //console.log('foo')
      indate = ch;
    } else {
      lastwasinteger = 0;
      format.operators.push(scfn.commands.copy);
      format.operands.push(ch);
    }
  }

  // last char was part of unsaved date placeholder
  if (indate) {
    format.operators.push(scfn.commands.date);
    format.operands.push(indate);
    sectioninfo.hasdate = 1;
  }

  return;
};

/* *******************

bracketdata = FormatNumber.parse_format_bracket(bracketstr)

Takes a bracket contents (e.g., "RED", ">10") and returns an operator and operand

bracketdata->{}
.operator
.operand

************************* */

FormatNumber.parse_format_bracket = function (bracketstr) {

  var scfn = FormatNumber;

  var bracketdata = {};
  var parts;

  // currency
  if (bracketstr.charAt(0) == '$') {
    bracketdata.operator = scfn.commands.currency;
    parts = bracketstr.match(/^\$(.+?)(\-.+?){0,1}$/);
    if (parts) {
      bracketdata.operand = parts[1] || DefaultCurrency || '$';
    } else {
      bracketdata.operand = bracketstr.substring(1) || DefaultCurrency || '$';
    }
  } else if (bracketstr == '?$') {
    bracketdata.operator = scfn.commands.currency;
    bracketdata.operand = '[?$]';
  } else if (AllowedColors[bracketstr.toUpperCase()]) {
    bracketdata.operator = scfn.commands.color;
    bracketdata.operand = AllowedColors[bracketstr.toUpperCase()];
  } else if (parts = bracketstr.match(/^style=([^']*)$/)) {
    // [style=...]
    bracketdata.operator = scfn.commands.style;
    bracketdata.operand = parts[1];
  } else if (bracketstr == ',') {
    bracketdata.operator = scfn.commands.separator;
    bracketdata.operand = bracketstr;
  } else if (AllowedDates[bracketstr.toUpperCase()]) {
    bracketdata.operator = scfn.commands.date;
    bracketdata.operand = AllowedDates[bracketstr.toUpperCase()];
  } else if (parts = bracketstr.match(/^[<>=]/)) {
    // comparison operator
    parts = bracketstr.match(/^([<>=]+)(.+)$/); // split operator and value
    bracketdata.operator = scfn.commands.comparison;
    bracketdata.operand = parts[1] + ':' + parts[2];
  } else {
    // unknown bracket
    bracketdata.operator = scfn.commands.copy;
    bracketdata.operand = '[' + bracketstr + ']';
  }

  return bracketdata;
};

function text(value, format, currency_char) {
  return FormatNumber.formatNumberWithFormat(value, format, currency_char);
}

// TRIMS returns a string without whitespace at the beginning or end.
function trim(text) {
  if (typeof text !== 'string') {
    return error$2.value;
  }
  return text.trim();
}

// Copyright 2015 Peter W Moresi

// UPPER converts a string to upper case
function upper(string) {
  return string.toUpperCase();
}

// VLOOKUP find a needle in a table searching vertically.
function vlookup(needle) {
  var table = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];
  var index = arguments.length <= 2 || arguments[2] === undefined ? 1 : arguments[2];
  var exactmatch = arguments.length <= 3 || arguments[3] === undefined ? false : arguments[3];


  if (iserror(needle) || isblank(needle)) {
    return needle;
  }

  for (var i = 0; i < table.length; i++) {
    var row = table[i];

    if (index > row.length) {
      return error$2.ref;
    }

    if (exactmatch && row[0] === needle || row[0] == needle || typeof row[0] === "string" && row[0].toLowerCase().indexOf(needle.toLowerCase()) != -1) {
      return index < row.length + 1 ? row[index - 1] : row[0];
    }
  }

  return error$2.na;
}

// XOR computes the exclusive or for a given set of `values`.
function xor() {
  for (var _len15 = arguments.length, values = Array(_len15), _key15 = 0; _key15 < _len15; _key15++) {
    values[_key15] = arguments[_key15];
  }

  return !!(flatten(values).reduce(function (a, b) {
    if (b) {
      return a + 1;
    }
    return a;
  }, 0) & 1);
}

exports.abs = abs;
exports.acos = acos;
exports.add = add;
exports.and = and;
exports.average = average;
exports.bin2dec = bin2dec;
exports.branch = branch;
exports.cond = branch;
exports.cellindex = cellindex;
exports.cellIndex = cellindex;
exports.changed = changed;
exports.choose = choose;
exports.clean = clean;
exports.code = code;
exports.column = column;
exports.columnletter = columnletter;
exports.columnLetter = columnletter;
exports.columnnumber = columnnumber;
exports.concatenate = concatenate;
exports.cos = cos;
exports.date = date;
exports.datevalue = datevalue;
exports.dateValue = datevalue;
exports.datedif = datedif;
exports.days360 = days360;
exports.dec2bin = dec2bin;
exports.diff = diff;
exports.divide = divide;
exports.eq = eq;
exports.exact = exact;
exports.filter = filter;
exports.find = find;
exports.flatten = flatten;
exports.gt = gt;
exports.gte = gte;
exports.guid = guid;
exports.hlookup = hlookup;
exports.ifblank = ifblank;
exports.ifBlank = ifblank;
exports.ifempty = ifempty;
exports.ifEmpty = ifempty;
exports.iferror = iferror;
exports.ifError = iferror;
exports.ifna = ifna;
exports.ifNA = ifna;
exports.index2col = index2col;
exports.index2row = index2row;
exports.indirect = indirect;
exports.isarray = isarray;
exports.isArray = isarray;
exports.isblank = isblank;
exports.isBlank = isblank;
exports.isdate = isdate;
exports.isDate = isdate;
exports.isemail = isemail;
exports.isEmail = isemail;
exports.isempty = isempty;
exports.isEmpty = isempty;
exports.iserror = iserror;
exports.isError = iserror;
exports.iseven = iseven;
exports.isEven = iseven;
exports.isfunction = isfunction;
exports.isFunction = isfunction;
exports.isna = isna;
exports.isNA = isna;
exports.isnumber = isnumber;
exports.isNumber = isnumber;
exports.isodd = isodd;
exports.isOdd = isodd;
exports.isref = isref;
exports.isRef = isref;
exports.istext = istext;
exports.isText = istext;
exports.isurl = isurl;
exports.ISURL = isurl;
exports.len = len;
exports.lookup = lookup;
exports.lower = lower;
exports.lt = lt;
exports.lte = lte;
exports.min = min;
exports.max = max;
exports.multiply = multiply;
exports.n = n;
exports.numbervalue = numbervalue;
exports.numberValue = numbervalue;
exports.ne = ne;
exports.not = not;
exports.oct2dec = oct2dec;
exports.or = or;
exports.parsebool = parsebool;
exports.parseBool = parsebool;
exports.parsedate = parsedate;
exports.parseDate = parsedate;
exports.pi = pi;
exports.pmt = pmt;
exports.power = power;
exports.ref = ref$1;
exports.replace = replace;
exports.rept = rept;
exports.right = right;
exports.round = round;
exports.roundup = roundup;
exports.search = search;
exports.select = select;
exports.serial = serial;
exports.sin = sin;
exports.some = some;
exports.sort = sort;
exports.split = split;
exports.substitute = substitute;
exports.subtract = subtract;
exports.sum = sum;
exports.tan = tan;
exports.tau = tau;
exports.text = text;
exports.trim = trim;
exports.unique = unique;
exports.upper = upper;
exports.vlookup = vlookup;
exports.xor = xor;


},{}],6:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":7}],7:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[1]);
