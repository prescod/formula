(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
if (typeof window === 'object' && typeof window.formula === 'undefined') {
  window.formula = require('./lib/compiler')
}

},{"./lib/compiler":2}],2:[function(require,module,exports){
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
        switch (node.name.toLowerCase()) {
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

      case 'variable':
        if (precedents && !suppress) {
          precedents.push(node);
        }
        if (node.scope) {
          return 'context.get(\"' + node.scope + '\", \"' + node.name + '\")';
        }
        return 'context.get(\"' + node.name + '\")';
      case 'value':
        switch (node.subtype) {
          case 'array':
            return '[' + printItems(node.items) + ']';
          case 'string':
            return "'" + node.value.replace(/'/g, "''") + "'";

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
  var locals = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
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
    locals.get = function (scope, name) {
      if (!name) return locals[scope];
      return locals[scope] ? locals[scope][name] : undefined;
    };
  }

  return compiled.bind(r)(locals);
}

},{"./parser":3,"functionfoundry":7}],3:[function(require,module,exports){
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
var o=function(k,v,o,l){for(o=o||{},l=k.length;l--;o[k[l]]=v);return o},$V0=[1,4],$V1=[1,5],$V2=[1,6],$V3=[1,7],$V4=[1,8],$V5=[1,11],$V6=[1,12],$V7=[1,13],$V8=[1,14],$V9=[1,15],$Va=[1,16],$Vb=[1,24],$Vc=[1,18],$Vd=[1,19],$Ve=[1,20],$Vf=[1,21],$Vg=[1,22],$Vh=[1,23],$Vi=[1,25],$Vj=[1,26],$Vk=[1,27],$Vl=[1,28],$Vm=[1,29],$Vn=[1,30],$Vo=[5,6,7,8,9,10,11,12,13,14,15,16,17,19,20,32,33,36],$Vp=[5,6,7,8,12,13,14,15,16,17,19,32,33,36],$Vq=[1,58],$Vr=[1,59],$Vs=[19,32,33,36],$Vt=[5,6,7,8,9,10,12,13,14,15,16,17,19,32,33,36],$Vu=[5,6,12,13,14,15,16,19,32,33,36];
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"expressions":3,"e":4,"EOF":5,"=":6,"+":7,"-":8,"*":9,"/":10,"^":11,"<>":12,">":13,"<":14,">=":15,"<=":16,"&":17,"(":18,")":19,":":20,"IDENT":21,"SCOPE":22,"func":23,"array_literal":24,"TRUE":25,"FALSE":26,"STRING":27,"NUMBER":28,"%":29,"range":30,"param_list":31,",":32,";":33,"FUNC":34,"{":35,"}":36,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",6:"=",7:"+",8:"-",9:"*",10:"/",11:"^",12:"<>",13:">",14:"<",15:">=",16:"<=",17:"&",18:"(",19:")",20:":",21:"IDENT",22:"SCOPE",25:"TRUE",26:"FALSE",27:"STRING",28:"NUMBER",29:"%",32:",",33:";",34:"FUNC",35:"{",36:"}"},
productions_: [0,[3,2],[3,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,2],[4,3],[4,2],[4,3],[4,3],[4,1],[4,2],[4,1],[4,1],[4,1],[4,1],[4,1],[4,2],[4,1],[30,3],[31,1],[31,3],[31,3],[23,4],[23,3],[24,3]],
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
 this.$ = { type: 'variable', name:$$[$0] }; 
break;
case 20:
 this.$ = { type: 'variable', scope: $$[$0-1], name: $$[$0] }; 
break;
case 21: case 22:
 this.$ = $$[$0]; 
break;
case 23:
this.$ = { type: 'value', subtype: 'boolean', value: true }; 
break;
case 24:
this.$ = { type: 'value', subtype: 'boolean', value: false }; 
break;
case 25:
this.$ = { type: 'value', subtype: 'string', value:String(yytext)}; 
break;
case 26:
this.$ = { type: 'value', subtype: 'number', value:$$[$0-1]/100 }; 
break;
case 27:
this.$ = { type: 'value', subtype: 'number', value:Number(yytext) }; 
break;
case 29:
 this.$ = [$$[$0]]; 
break;
case 30:
 this.$ = $$[$0-2].concat([$$[$0]]); 
break;
case 31:
 this.$ = ($$[$0][0].subtype !== 'array') ? [{ type: 'value', subtype: 'array', items:$$[$0-2] }, { type: 'value', subtype: 'array', items:$$[$0] }] : [{ type: 'value', subtype: 'array', items:$$[$0-2] }].concat($$[$0]); 
break;
case 32:
 this.$ = { type: 'function', name: $$[$0-3], args:$$[$0-1] }; 
break;
case 33:
 this.$ = { type: 'function', name: $$[$0-2], args:[] }; 
break;
case 34:
 this.$ = { type: 'value', subtype: 'array', items:$$[$0-1] }; 
break;
}
},
table: [{3:1,4:2,6:[1,3],7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{1:[3]},{5:[1,17],6:$Vb,7:$Vc,8:$Vd,9:$Ve,10:$Vf,11:$Vg,12:$Vh,13:$Vi,14:$Vj,15:$Vk,16:$Vl,17:$Vm,20:$Vn},{4:31,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:32,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:33,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:34,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},o($Vo,[2,19]),{21:[1,35]},o($Vo,[2,21]),o($Vo,[2,22]),o($Vo,[2,23]),o($Vo,[2,24]),o($Vo,[2,25]),o($Vo,[2,27],{29:[1,36]}),{18:[1,37]},{4:39,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,31:38,34:$V9,35:$Va},{1:[2,1]},{4:40,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:41,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:42,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:43,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:44,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:45,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:46,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:47,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:48,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:49,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:50,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:51,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:52,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{5:[1,53],6:$Vb,7:$Vc,8:$Vd,9:$Ve,10:$Vf,11:$Vg,12:$Vh,13:$Vi,14:$Vj,15:$Vk,16:$Vl,17:$Vm,20:$Vn},o($Vp,[2,14],{9:$Ve,10:$Vf,11:$Vg,20:$Vn}),o($Vp,[2,16],{9:$Ve,10:$Vf,11:$Vg,20:$Vn}),{6:$Vb,7:$Vc,8:$Vd,9:$Ve,10:$Vf,11:$Vg,12:$Vh,13:$Vi,14:$Vj,15:$Vk,16:$Vl,17:$Vm,19:[1,54],20:$Vn},o($Vo,[2,20]),o($Vo,[2,26]),{4:39,7:$V0,8:$V1,18:$V2,19:[1,56],21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,31:55,34:$V9,35:$Va},{32:$Vq,33:$Vr,36:[1,57]},o($Vs,[2,29],{6:$Vb,7:$Vc,8:$Vd,9:$Ve,10:$Vf,11:$Vg,12:$Vh,13:$Vi,14:$Vj,15:$Vk,16:$Vl,17:$Vm,20:$Vn}),o($Vp,[2,3],{9:$Ve,10:$Vf,11:$Vg,20:$Vn}),o($Vp,[2,4],{9:$Ve,10:$Vf,11:$Vg,20:$Vn}),o($Vt,[2,5],{11:$Vg,20:$Vn}),o($Vt,[2,6],{11:$Vg,20:$Vn}),o([5,6,7,8,9,10,11,12,13,14,15,16,17,19,32,33,36],[2,7],{20:$Vn}),o($Vu,[2,8],{7:$Vc,8:$Vd,9:$Ve,10:$Vf,11:$Vg,17:$Vm,20:$Vn}),o($Vu,[2,9],{7:$Vc,8:$Vd,9:$Ve,10:$Vf,11:$Vg,17:$Vm,20:$Vn}),o($Vu,[2,10],{7:$Vc,8:$Vd,9:$Ve,10:$Vf,11:$Vg,17:$Vm,20:$Vn}),o($Vu,[2,11],{7:$Vc,8:$Vd,9:$Ve,10:$Vf,11:$Vg,17:$Vm,20:$Vn}),o($Vu,[2,12],{7:$Vc,8:$Vd,9:$Ve,10:$Vf,11:$Vg,17:$Vm,20:$Vn}),o($Vu,[2,13],{7:$Vc,8:$Vd,9:$Ve,10:$Vf,11:$Vg,17:$Vm,20:$Vn}),o([5,6,12,13,14,15,16,17,19,32,33,36],[2,15],{7:$Vc,8:$Vd,9:$Ve,10:$Vf,11:$Vg,20:$Vn}),o($Vo,[2,18]),{1:[2,2]},o($Vo,[2,17]),{19:[1,60],32:$Vq,33:$Vr},o($Vo,[2,33]),o($Vo,[2,34]),{4:61,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,34:$V9,35:$Va},{4:39,7:$V0,8:$V1,18:$V2,21:$V3,22:$V4,23:9,24:10,25:$V5,26:$V6,27:$V7,28:$V8,31:62,34:$V9,35:$Va},o($Vo,[2,32]),o($Vs,[2,30],{6:$Vb,7:$Vc,8:$Vd,9:$Ve,10:$Vf,11:$Vg,12:$Vh,13:$Vi,14:$Vj,15:$Vk,16:$Vl,17:$Vm,20:$Vn}),o([19,36],[2,31],{32:$Vq,33:$Vr})],
defaultActions: {17:[2,1],53:[2,2]},
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
case 1:return 28
break;
case 2:return 25
break;
case 3:return 26
break;
case 4:return 25
break;
case 5:return 26
break;
case 6:return 25
break;
case 7:return 26
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
case 29:return 34;
break;
case 30:return 34;
break;
case 31:yy_.yytext = yy_.yytext.substr(1,yy_.yyleng-2).replace(/\"\"/g, "\""); return "STRING";
break;
case 32:yy_.yytext = yy_.yytext.substr(2,yy_.yyleng-3).replace(/\"\"/g, "\""); return "SCOPE";
break;
case 33:yy_.yytext = yy_.yytext.substr(1,yy_.yyleng-3).replace(/\"\"/g, "\""); return "SCOPE";
break;
case 34:yy_.yytext = yy_.yytext.slice(0, -1); return "SCOPE"
break;
case 35:yy_.yytext = yy_.yytext.slice(1, -1); return "SCOPE"
break;
case 36:return 21
break;
case 37:return 5
break;
case 38:return 'INVALID'
break;
}
},
rules: [/^(?:\s+)/,/^(?:[0-9]+(\.[0-9]+)?\b)/,/^(?:TRUE\b)/,/^(?:FALSE\b)/,/^(?:true\b)/,/^(?:false\b)/,/^(?:True\b)/,/^(?:False\b)/,/^(?:\*)/,/^(?:\/)/,/^(?:-)/,/^(?:\+)/,/^(?:&)/,/^(?:\^)/,/^(?:\()/,/^(?:\))/,/^(?:>=)/,/^(?:<=)/,/^(?:<>)/,/^(?:=)/,/^(?:>)/,/^(?:<)/,/^(?:\{)/,/^(?:\})/,/^(?:!)/,/^(?:,)/,/^(?::)/,/^(?:;)/,/^(?:%)/,/^(?:[A-Za-z](?=[(]))/,/^(?:[A-Za-z][A-Za-z0-9\.]+(?=[(]))/,/^(?:"(?:""|[^"])*")/,/^(?:\$'(?:''|[^'])*'!)/,/^(?:'(?:''|[^'])*'!)/,/^(?:[a-zA-Z]([a-zA-Z0-9_.$]+)?!)/,/^(?:\$([a-zA-Z])([a-zA-Z0-9_.$]+)?!)/,/^(?:([\[\]a-zA-Z0-9_.$^@\(]+))/,/^(?:$)/,/^(?:.)/],
conditions: {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38],"inclusive":true}}
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
},{"_process":151,"fs":5,"path":150}],4:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return b64.length * 3 / 4 - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],5:[function(require,module,exports){

},{}],6:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  var actual = that.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual)
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":4,"ieee754":148,"isarray":149}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _branch = require('./branch');

var _branch2 = _interopRequireDefault(_branch);

var _choose = require('./choose');

var _choose2 = _interopRequireDefault(_choose);

var _and = require('./and');

var _and2 = _interopRequireDefault(_and);

var _or = require('./or');

var _or2 = _interopRequireDefault(_or);

var _not = require('./not');

var _not2 = _interopRequireDefault(_not);

var _eq = require('./eq');

var _eq2 = _interopRequireDefault(_eq);

var _ne = require('./ne');

var _ne2 = _interopRequireDefault(_ne);

var _gt = require('./gt');

var _gt2 = _interopRequireDefault(_gt);

var _gte = require('./gte');

var _gte2 = _interopRequireDefault(_gte);

var _lt = require('./lt');

var _lt2 = _interopRequireDefault(_lt);

var _lte = require('./lte');

var _lte2 = _interopRequireDefault(_lte);

var _ifblank = require('./ifblank');

var _ifblank2 = _interopRequireDefault(_ifblank);

var _ifempty = require('./ifempty');

var _ifempty2 = _interopRequireDefault(_ifempty);

var _iferror = require('./iferror');

var _iferror2 = _interopRequireDefault(_iferror);

var _ifna = require('./ifna');

var _ifna2 = _interopRequireDefault(_ifna);

var _isarray = require('./isarray');

var _isarray2 = _interopRequireDefault(_isarray);

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

var _isboolean = require('./isboolean');

var _isboolean2 = _interopRequireDefault(_isboolean);

var _isdate = require('./isdate');

var _isdate2 = _interopRequireDefault(_isdate);

var _isemail = require('./isemail');

var _isemail2 = _interopRequireDefault(_isemail);

var _isempty = require('./isempty');

var _isempty2 = _interopRequireDefault(_isempty);

var _iserror = require('./iserror');

var _iserror2 = _interopRequireDefault(_iserror);

var _iseven = require('./iseven');

var _iseven2 = _interopRequireDefault(_iseven);

var _isfunction = require('./isfunction');

var _isfunction2 = _interopRequireDefault(_isfunction);

var _isleapyear = require('./isleapyear');

var _isleapyear2 = _interopRequireDefault(_isleapyear);

var _isna = require('./isna');

var _isna2 = _interopRequireDefault(_isna);

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _isodd = require('./isodd');

var _isodd2 = _interopRequireDefault(_isodd);

var _isoweeknum = require('./isoweeknum');

var _isoweeknum2 = _interopRequireDefault(_isoweeknum);

var _isref = require('./isref');

var _isref2 = _interopRequireDefault(_isref);

var _istext = require('./istext');

var _istext2 = _interopRequireDefault(_istext);

var _isurl = require('./isurl');

var _isurl2 = _interopRequireDefault(_isurl);

var _iswholenumber = require('./iswholenumber');

var _iswholenumber2 = _interopRequireDefault(_iswholenumber);

var _xor = require('./xor');

var _xor2 = _interopRequireDefault(_xor);

var _add = require('./add');

var _add2 = _interopRequireDefault(_add);

var _subtract = require('./subtract');

var _subtract2 = _interopRequireDefault(_subtract);

var _multiply = require('./multiply');

var _multiply2 = _interopRequireDefault(_multiply);

var _divide = require('./divide');

var _divide2 = _interopRequireDefault(_divide);

var _abs = require('./abs');

var _abs2 = _interopRequireDefault(_abs);

var _acos = require('./acos');

var _acos2 = _interopRequireDefault(_acos);

var _cos = require('./cos');

var _cos2 = _interopRequireDefault(_cos);

var _pi = require('./pi');

var _pi2 = _interopRequireDefault(_pi);

var _power = require('./power');

var _power2 = _interopRequireDefault(_power);

var _round = require('./round');

var _round2 = _interopRequireDefault(_round);

var _roundup = require('./roundup');

var _roundup2 = _interopRequireDefault(_roundup);

var _sin = require('./sin');

var _sin2 = _interopRequireDefault(_sin);

var _tan = require('./tan');

var _tan2 = _interopRequireDefault(_tan);

var _tau = require('./tau');

var _tau2 = _interopRequireDefault(_tau);

var _trunc = require('./trunc');

var _trunc2 = _interopRequireDefault(_trunc);

var _char = require('./char');

var _char2 = _interopRequireDefault(_char);

var _code = require('./code');

var _code2 = _interopRequireDefault(_code);

var _concatenate = require('./concatenate');

var _concatenate2 = _interopRequireDefault(_concatenate);

var _exact = require('./exact');

var _exact2 = _interopRequireDefault(_exact);

var _find = require('./find');

var _find2 = _interopRequireDefault(_find);

var _join = require('./join');

var _join2 = _interopRequireDefault(_join);

var _left = require('./left');

var _left2 = _interopRequireDefault(_left);

var _len = require('./len');

var _len2 = _interopRequireDefault(_len);

var _lower = require('./lower');

var _lower2 = _interopRequireDefault(_lower);

var _numbervalue = require('./numbervalue');

var _numbervalue2 = _interopRequireDefault(_numbervalue);

var _parsebool = require('./parsebool');

var _parsebool2 = _interopRequireDefault(_parsebool);

var _parsedate = require('./parsedate');

var _parsedate2 = _interopRequireDefault(_parsedate);

var _parsequery = require('./parsequery');

var _parsequery2 = _interopRequireDefault(_parsequery);

var _proper = require('./proper');

var _proper2 = _interopRequireDefault(_proper);

var _replace = require('./replace');

var _replace2 = _interopRequireDefault(_replace);

var _right = require('./right');

var _right2 = _interopRequireDefault(_right);

var _rept = require('./rept');

var _rept2 = _interopRequireDefault(_rept);

var _search = require('./search');

var _search2 = _interopRequireDefault(_search);

var _substitute = require('./substitute');

var _substitute2 = _interopRequireDefault(_substitute);

var _substituteAll = require('./substituteAll');

var _substituteAll2 = _interopRequireDefault(_substituteAll);

var _surroundKeys = require('./surroundKeys');

var _surroundKeys2 = _interopRequireDefault(_surroundKeys);

var _split = require('./split');

var _split2 = _interopRequireDefault(_split);

var _text = require('./text');

var _text2 = _interopRequireDefault(_text);

var _trim = require('./trim');

var _trim2 = _interopRequireDefault(_trim);

var _upper = require('./upper');

var _upper2 = _interopRequireDefault(_upper);

var _hlookup = require('./hlookup');

var _hlookup2 = _interopRequireDefault(_hlookup);

var _index = require('./index');

var _index2 = _interopRequireDefault(_index);

var _lookup = require('./lookup');

var _lookup2 = _interopRequireDefault(_lookup);

var _match = require('./match');

var _match2 = _interopRequireDefault(_match);

var _vlookup = require('./vlookup');

var _vlookup2 = _interopRequireDefault(_vlookup);

var _date = require('./date');

var _date2 = _interopRequireDefault(_date);

var _datevalue = require('./datevalue');

var _datevalue2 = _interopRequireDefault(_datevalue);

var _datedif = require('./datedif');

var _datedif2 = _interopRequireDefault(_datedif);

var _day = require('./day');

var _day2 = _interopRequireDefault(_day);

var _days = require('./days360');

var _days2 = _interopRequireDefault(_days);

var _edate = require('./edate');

var _edate2 = _interopRequireDefault(_edate);

var _eomonth = require('./eomonth');

var _eomonth2 = _interopRequireDefault(_eomonth);

var _hour = require('./hour');

var _hour2 = _interopRequireDefault(_hour);

var _minute = require('./minute');

var _minute2 = _interopRequireDefault(_minute);

var _month = require('./month');

var _month2 = _interopRequireDefault(_month);

var _now = require('./now');

var _now2 = _interopRequireDefault(_now);

var _second = require('./second');

var _second2 = _interopRequireDefault(_second);

var _today = require('./today');

var _today2 = _interopRequireDefault(_today);

var _time = require('./time');

var _time2 = _interopRequireDefault(_time);

var _timevalue = require('./timevalue');

var _timevalue2 = _interopRequireDefault(_timevalue);

var _year = require('./year');

var _year2 = _interopRequireDefault(_year);

var _yearfrac = require('./yearfrac');

var _yearfrac2 = _interopRequireDefault(_yearfrac);

var _average = require('./average');

var _average2 = _interopRequireDefault(_average);

var _min = require('./min');

var _min2 = _interopRequireDefault(_min);

var _max = require('./max');

var _max2 = _interopRequireDefault(_max);

var _sum = require('./sum');

var _sum2 = _interopRequireDefault(_sum);

var _fv = require('./fv');

var _fv2 = _interopRequireDefault(_fv);

var _nper = require('./nper');

var _nper2 = _interopRequireDefault(_nper);

var _npv = require('./npv');

var _npv2 = _interopRequireDefault(_npv);

var _pmt = require('./pmt');

var _pmt2 = _interopRequireDefault(_pmt);

var _pv = require('./pv');

var _pv2 = _interopRequireDefault(_pv);

var _bin2dec = require('./bin2dec');

var _bin2dec2 = _interopRequireDefault(_bin2dec);

var _dec2bin = require('./dec2bin');

var _dec2bin2 = _interopRequireDefault(_dec2bin);

var _oct2dec = require('./oct2dec');

var _oct2dec2 = _interopRequireDefault(_oct2dec);

var _filter = require('./filter');

var _filter2 = _interopRequireDefault(_filter);

var _flatten = require('./flatten');

var _flatten2 = _interopRequireDefault(_flatten);

var _map = require('./map');

var _map2 = _interopRequireDefault(_map);

var _pluck = require('./pluck');

var _pluck2 = _interopRequireDefault(_pluck);

var _reduce = require('./reduce');

var _reduce2 = _interopRequireDefault(_reduce);

var _some = require('./some');

var _some2 = _interopRequireDefault(_some);

var _sort = require('./sort');

var _sort2 = _interopRequireDefault(_sort);

var _unique = require('./unique');

var _unique2 = _interopRequireDefault(_unique);

var _changed = require('./changed');

var _changed2 = _interopRequireDefault(_changed);

var _diff = require('./diff');

var _diff2 = _interopRequireDefault(_diff);

var _clean = require('./clean');

var _clean2 = _interopRequireDefault(_clean);

var _get = require('./get');

var _get2 = _interopRequireDefault(_get);

var _select = require('./select');

var _select2 = _interopRequireDefault(_select);

var _cellindex = require('./cellindex');

var _cellindex2 = _interopRequireDefault(_cellindex);

var _column = require('./column');

var _column2 = _interopRequireDefault(_column);

var _columnletter = require('./columnletter');

var _columnletter2 = _interopRequireDefault(_columnletter);

var _columnnumber = require('./columnnumber');

var _columnnumber2 = _interopRequireDefault(_columnnumber);

var _decodebase = require('./decodebase64');

var _decodebase2 = _interopRequireDefault(_decodebase);

var _decodejwt = require('./decodejwt');

var _decodejwt2 = _interopRequireDefault(_decodejwt);

var _guid = require('./guid');

var _guid2 = _interopRequireDefault(_guid);

var _int = require('./int');

var _int2 = _interopRequireDefault(_int);

var _index2col = require('./index2col');

var _index2col2 = _interopRequireDefault(_index2col);

var _index2row = require('./index2row');

var _index2row2 = _interopRequireDefault(_index2row);

var _n = require('./n');

var _n2 = _interopRequireDefault(_n);

var _numbers = require('./numbers');

var _numbers2 = _interopRequireDefault(_numbers);

var _ref = require('./ref');

var _ref2 = _interopRequireDefault(_ref);

var _serial = require('./serial');

var _serial2 = _interopRequireDefault(_serial);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Copyright @ 2015-2016 WebsiteHQ LLC

// # FunctionFoundry
// Library of functions distributed through npm.
//
// ## Install
//   ```sh
//   npm install --save functionfoundry
//   ```

// ## Polyfills
// The library includes a polyfill for Number.isNaN.

// ### Number.isNaN
// credit: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN
Number.isNaN = Number.isNaN || function (value) {
  return value !== value;
};

// ## Functions
// The library includes functions for logic, math, text, lookup, date/time, aggregation, arrays, objects, finance, statistics and other utilities.

// ### Logical

// #### [branch](./branch)
// `branch` is equivalent to `if-elseif-else`.


// define `cond` alias for branch
var cond = _branch2.default;

// #### [choose](./choose)
// `choose` is equivalent to `switch case`.


// #### [and](./and)
// `and` returns true when all arguments are true or evaluates to true.


// #### [or](./or)
// `or` returns true when any argument is true or evaluates to true.


// #### [not](./not)
// `not` returns the inverse.


// #### [eq](./eq)
// `eq` returns true when the first and second arguments are equivalent. String comparision is _case insensitive_.


// #### [ne](./ne)
// `ne` returns true when the first and second arguments are not equivalent. String comparision is _case insensitive_.


// #### [gt](./gt)
// `gt` returns true when first argument is greater than the second.


// #### [gte](./gte)
// `gte` returns true when first argument is greater than or equal to the second.


// #### [lt](./lt)
// `lt` returns true when first argument is less than the second.


// #### [lte](./lte)
// `lte` returns true when first argument is less than or equal to the second.


// #### [ifblank](./ifblank)
// `ifempty` returns the second argument when the first argument is blank or the third argument

var ifBlank = _ifblank2.default;

// #### [ifempty](./ifempty)
// `ifempty` returns the second argument when the first argument is empty or the third argument

var ifEmpty = _ifempty2.default;

// #### [iferror](./iferror)
// `ifempty` returns the second argument when the first argument is an error or the third argument

var ifError = _iferror2.default;

// #### [ifna](./ifna)
// `ifempty` returns the second argument when the first argument is #NA! or the third argument

var ifNA = _ifna2.default;

// #### [isarray](./isarray)
// `isarray` returns true when the value is an array.

var isArray = _isarray2.default;

// #### [isblank](./isblank)
// `isblank` returns true when the value is undefined or null.

var isBlank = _isblank2.default;

// #### [isboolean](./isboolean)
// `isboolean` returns true when the value is true or false.

var isbool = _isboolean2.default;
var isBoolean = _isboolean2.default;
var isBool = _isboolean2.default;

// #### [isdate](./isdate)
// `isdate` returns true when the value is a JavaScript Date object.

var isDate = _isdate2.default;

// #### [isemail](./isemail)
// `isdate` returns true when the value matches the pattern for a valid email address.

var isEmail = _isemail2.default;

// #### [isempty](./isempty)
// `isempty` returns true when the value is blank or empty string.

var isEmpty = _isempty2.default;

// #### [iserror](./iserror)
// `iserror` returns true when the value is an error value.

var isError = _iserror2.default;

// #### [iseven](./iseven)
// `iseven` returns true when the value is an even number.

var isEven = _iseven2.default;

// #### [isfunction](./isfunction)
// `isfunction` returns true when the value is a JavaScript function.

var isFunction = _isfunction2.default;

// #### [isleapyear](./isleapyear)
// `isfunction` returns true when the value is a leap year.

var isLeapYear = _isleapyear2.default;

// #### [isna](./isna)
// `isna` returns true when the value is #NA!.

var isNA = _isna2.default;

// #### [isnumber](./isnumber)
// `isnumber` returns true when the value is JavaScript number type and not NaN and not infinite.

var isNumber = _isnumber2.default;

// #### [isodd](./isodd)
// `isodd` returns true when the value is an odd number.

var isOdd = _isodd2.default;

// #### [isoweeknum](./isoweeknum)
// `isoweeknum` returns number of the ISO week number of the year for a given date.

var isoWeekNum = _isoweeknum2.default;

// #### [isref](./isref)
// `isref` returns true when value is a ref object.

var isRef = _isref2.default;

// #### [istext](./istext)
// `istext` returns true when value is a string.

var isText = _istext2.default;

// #### [isurl](./isurl)
// `isurl` returns true when value matches a url pattern.

var isURL = _isurl2.default;

// #### [iswholenumber](./iswholenumber)
// `iswholenumber` returns true when value is an integer.

var isWholeNumber = _iswholenumber2.default;
var isInteger = _iswholenumber2.default;

// #### [xor](./xor)
// `xor` returns the logical exclusive Or of all arguments.


// ### Math functions

// #### [add](./add)
// `add` sums the first and second arguments.


// #### [subtract](./subtract)
// `subtract` returns the difference between the first and second arguments.


// #### [multiply](./multiply)
// `multiply` returns the product of the first and second arguments.


// #### [divide](./divide)
// `divide` returns the result of the first argument divided by the second.


// #### [abs](./abs)
// `abs` returns the absolute value of the first argument.


// #### [acos](./acos)
// `acos` returns the inverse cosine of a number.


// #### [cos](./cos)
/// `cos` returns the cosine of a number


// #### [pi](./pi)
/// `pi` returns the circle constant 3.14...


// #### [power](./power)
// `power` returns the nth power of a number.


// #### [round](./round)
// `round` returns a number rounded to a precision.


// #### [roundup](./roundup)
// `roundup` returns a number rounded up to a precision.


// #### [sin](./sin)
// `sin` return the sinine of a number.


// #### [tan](./tan)
// `tan` returns the tangent of a number.


// #### [tau](./tau)
// `tau` returns the circle constant 6.28...


// #### [trunc](./trunc)
// `trunc` returns a number truncated to a given precision.


// ### Text

// #### [char](./char)
// `char` returns a character given an ASCII code.


// #### [code](./code)
// `code` returns the ASCII code for a given character.


// #### [concatenate](./concatenate)
// `concatenate` combines multiple values into a string.

var concat = _concatenate2.default;

// #### [exact](./exact)
// `exact` compares two values for strict equivalence.


// #### [find](./find)
// `find` searches a string for a value and returns the index.


// #### [join](./join)
// `join` combines an array of values into a string with a given delimiter.


// #### [left](./left)
// `left` returns a given number of characters from the left side of a string.


// #### [len](./len)
// `len` returns the size of a string of array.


// #### [lower](./lower)
// `lower` converts text to lower case.


// #### [numbervalue](./numbervalue)
// `numbervalue` converts text into a number.

var numberValue = _numbervalue2.default;

// #### [parsebool](./parsebool)
// `parsebool` converts text into a boolean value.

var parseBool = _parsebool2.default;

// #### [parsedate](./parsedate)
// `parsedate` converts text into a JavaScript date object

var parseDate = _parsedate2.default;

// #### [parsequery](./parsequery)
// `parsequery` returns a JSObject for a URL query string.

var parseQuery = _parsequery2.default;

// #### [proper](./proper)
// `proper` returns a string as a proper name.


// #### [replace](./replace)
// `replace` returns a string where one value is replaced with a new value.


// #### [right](./right)
// `right` returns a given number of characters from the right of a string.


// #### [rept](./rept)
// `rept` returns a string with a given value repeated `n` times.


// #### [search](./search)
// `search` returns the index of a value inside a string with wildcard support for single characters (?) and multiple characters (*).


// #### [substitute](./substitute)
// `substitute` returns a new string with every instance of value replaced.


// #### [substituteAll](./substituteAll)
// `substituteAll` returns a new string with every instance of set of values replaced.

var template = _substituteAll2.default;

// #### [surroundKeys](./surroundKeys)
// `surroundKeys` returns a new object where the keys have been wrapped with start and end strings.


// #### [split](./split)
// `split` returns an array of strings from a given string separated by a delimiter.


// #### [text](./text)
// `text` formats numbers and dates using a format code.


// #### [trim](./trim)
// `trim` returns a value with the whitespace removed from the left and right.


// #### [upper](./upper)
// `upper` returns a value in all upper case.


// ### Lookup and reference

// #### [hlookup](./hlookup)
// `hlookup` searches the first row and returns the value from the found column at a given row.


// #### [index](./index)
// `index` returns the value for a given row and column.


// #### [lookup](./lookup)
// `lookup` searches an array and returns the value found or (optionally) the value at the same index in a second array.


// #### [match](./match)
// `match` searches an array and returns the found index with support for wildcard and range queries.


// #### [vlookup](./vlookup)
// `vlookup` searches the first column and returns the value from the found row at a given column.


// ### Date manipulation

// #### [date](./date)
// `date` returns a serial number for a given year, month and day.


// #### [datevalue](./datevalue)
// `datevalue` returns a serial number for a given date string.

var dateValue = _datevalue2.default;

// #### [datedif](./datedif)
// `datedif` returns the difference between two dates with support for multiple units.


// #### [day](./day)
// `day` returns the day part from a date or date string.


// #### [days360](./days360)
// `days360` returns the days behind two dates using a 360 day year.


// #### [edate](./edate)
// `edate` returns the serial number for a date that is a given number of months before or after a given date.


// #### [eomonth](./eomonth)
// `eomonth` returns the last day of the month in future or past months.


// #### [hour](./hour)
// `hour` returns the hour part of a time fraction value.


// #### [minute](./minute)
// `minute` returns the minute part of a time fraction value.


// #### [month](./month)
// `month` returns the month for a given date.


// #### [now](./now)
// `now` returns the current date time in a serial number and time fraction.


// #### [second](./second)
// `second` return the second part of a time fraction


// #### [today](./today)
// `today` returns a serial number for the current date.


// #### [time](./time)
// `time` returns a time fraction for an hour, minute and second.


// #### [timevalue](./timevalue)
// `timevalue` returns a time fraction given a text value.


// #### [year](./year)
// `year` return the year for a given date.


// #### [yearfrac](./yearfrac)
// `yearfrac` calculates the fraction of a year between two dates.


// ### Aggregation

// #### [average](./average)
// `average` returns the sum divided by the number of items.


// #### [min](./min)
// `min` returns the smallest value in an array.


// #### [max](./max)
// `min` returns the largest value in an array.


// #### [sum](./sum)
// `sum` returns the value of all items in an array added together.


// ### Finance

// #### [fv](./fv)
// `fv` returns the future value of an investment.


// #### [nper](./nper)
// `nper` returns the number of periods for an investment.


// #### [npv](./npv)
// `npv` returns the net present value of an investment.


// #### [pmt](./pmt)
// `pmt` returns the amortized payment for a loan.


// #### [pv](./pv)
// `pv` returns the present value of an investment.


// ### Engineering

// #### [bin2dec](./bin2dec)
// `bin2dec` converts a binary number into a decimal value.


// #### [dec2bin](./dec2bin)
// `dec2bin` converts a decimal value to a binary string.


// #### [oct2dec](./oct2dec)
// `oct2dec` converts an octal string to a decimal value.


// ### Arrays

// #### [filter](./filter)
// `filter` limits a range based on arrays of true/false values.


// #### [flatten](./flatten)
// `flatten` returns an array with values flatten into a single dimension.


// #### [map](./map)
// `map` returns an array mapped to new values with a given function.


// #### [pluck](./pluck)
// `pluck` returns an array with a property plucked from an array of objects.


// #### [reduce](./reduce)
// `reduce` converts an array into a value.


// #### [some](./some)
// `some` returns true if some of the values in an array match the criteria.


// #### [sort](./sort)
// `sort` returns an array sorted by criteria.


// #### [unique](./unique)
// `unique` returns the list of unique values from an array.


// ### Objects

// #### [changed](./changed)
// `changed` computes the list of keys that are different between two objects.


// #### [diff](./diff)
// `diff` computes the unique left, unique right and changed properties of two objects.


// #### [clean](./clean)
// `clean` returns an object skipping properties with empty values.


// #### [get](./get)
// `get` returns the value of a property from an object.


// #### [select](./select)
// `select` returns an object with keys limited to a given set.


// ### Utility

// #### [cellindex](./cellindex)
// `cellindex` computes the index of a row/column in a fixed size 1 dimensional space.

var cellIndex = _cellindex2.default;

// #### [column](./column)
// `column` returns the column index from a cell index.


// #### [columnletter](./columnletter)
// `column` returns the column letter from a cell index.

var columnLetter = _columnletter2.default;

// #### [columnnumber](./columnnumber)
// `columnnumber` converts a column letter into a number.


// #### [decodebase64](./decodebase64)
// `decodeBase64` decodes the base 64 binary into string

var decodeBase64 = _decodebase2.default;
var atob = _decodebase2.default;

// #### [decodejwt](./decodejwt)
// `decodeJWT` decodes the payload from a JSON Web Token

var decodeJWT = _decodejwt2.default;

// #### [guid](./guid)
// `guid` returns a new globally unique identifier (version 4).


// #### [int](./int)
// `int` return the floor of a number.


// #### [index2col](./index2col)
// `index2col` computes the column given a cell index.


// #### [index2row](./index2row)
// `index2row` computes the row given a cell index.


// #### [n](./n)
// `n` converts a `value` to a number. It supports numbers, true, false and dates.


// #### [numbers](./numbers)
// `numbers` returns the numbers from an array.


// #### [ref](./ref)
// `ref` returns a ref object that represents a range.


// #### [serial](./serial)
// `serial` converts a JS date into the number of days from 1/1/1900.
exports.default = {
  abs: _abs2.default,
  acos: _acos2.default,
  add: _add2.default,
  and: _and2.default,
  atob: atob,
  average: _average2.default,
  bin2dec: _bin2dec2.default,
  branch: _branch2.default,
  cellIndex: cellIndex,
  cellindex: _cellindex2.default,
  changed: _changed2.default,
  char: _char2.default,
  choose: _choose2.default,
  clean: _clean2.default,
  code: _code2.default,
  column: _column2.default,
  columnLetter: columnLetter,
  columnletter: _columnletter2.default,
  columnnumber: _columnnumber2.default,
  concat: concat,
  concatenate: _concatenate2.default,
  cond: cond,
  cos: _cos2.default,
  date: _date2.default,
  dateValue: dateValue,
  datedif: _datedif2.default,
  datevalue: _datevalue2.default,
  day: _day2.default,
  days360: _days2.default,
  dec2bin: _dec2bin2.default,
  decodeBase64: decodeBase64,
  decodeJWT: decodeJWT,
  decodebase64: _decodebase2.default,
  decodejwt: _decodejwt2.default,
  diff: _diff2.default,
  divide: _divide2.default,
  edate: _edate2.default,
  eomonth: _eomonth2.default,
  eq: _eq2.default,
  exact: _exact2.default,
  filter: _filter2.default,
  find: _find2.default,
  flatten: _flatten2.default,
  fv: _fv2.default,
  get: _get2.default,
  gt: _gt2.default,
  gte: _gte2.default,
  guid: _guid2.default,
  hlookup: _hlookup2.default,
  hour: _hour2.default,
  ifBlank: ifBlank,
  ifEmpty: ifEmpty,
  ifError: ifError,
  ifNA: ifNA,
  ifblank: _ifblank2.default,
  ifempty: _ifempty2.default,
  iferror: _iferror2.default,
  ifna: _ifna2.default,
  index: _index2.default,
  index2col: _index2col2.default,
  index2row: _index2row2.default,
  int: _int2.default,
  isArray: isArray,
  isBlank: isBlank,
  isBool: isBool,
  isBoolean: isBoolean,
  isDate: isDate,
  isEmail: isEmail,
  isEmpty: isEmpty,
  isError: isError,
  isEven: isEven,
  isFunction: isFunction,
  isInteger: isInteger,
  isLeapYear: isLeapYear,
  isNA: isNA,
  isNumber: isNumber,
  isOdd: isOdd,
  isRef: isRef,
  isText: isText,
  isWholeNumber: isWholeNumber,
  isarray: _isarray2.default,
  isblank: _isblank2.default,
  isbool: isbool,
  isboolean: _isboolean2.default,
  isdate: _isdate2.default,
  isemail: _isemail2.default,
  isempty: _isempty2.default,
  iserror: _iserror2.default,
  iseven: _iseven2.default,
  isfunction: _isfunction2.default,
  isleapyear: _isleapyear2.default,
  isna: _isna2.default,
  isnumber: _isnumber2.default,
  isoWeekNum: isoWeekNum,
  isodd: _isodd2.default,
  isoweeknum: _isoweeknum2.default,
  isref: _isref2.default,
  istext: _istext2.default,
  isurl: _isurl2.default,
  iswholenumber: _iswholenumber2.default,
  join: _join2.default,
  left: _left2.default,
  len: _len2.default,
  lookup: _lookup2.default,
  lower: _lower2.default,
  lt: _lt2.default,
  lte: _lte2.default,
  map: _map2.default,
  match: _match2.default,
  max: _max2.default,
  min: _min2.default,
  minute: _minute2.default,
  month: _month2.default,
  multiply: _multiply2.default,
  n: _n2.default,
  ne: _ne2.default,
  not: _not2.default,
  now: _now2.default,
  nper: _nper2.default,
  npv: _npv2.default,
  numberValue: numberValue,
  numbers: _numbers2.default,
  numbervalue: _numbervalue2.default,
  oct2dec: _oct2dec2.default,
  or: _or2.default,
  parseBool: parseBool,
  parseDate: parseDate,
  parseQuery: parseQuery,
  parsebool: _parsebool2.default,
  parsedate: _parsedate2.default,
  parsequery: _parsequery2.default,
  pi: _pi2.default,
  pluck: _pluck2.default,
  pmt: _pmt2.default,
  power: _power2.default,
  proper: _proper2.default,
  pv: _pv2.default,
  reduce: _reduce2.default,
  ref: _ref2.default,
  replace: _replace2.default,
  rept: _rept2.default,
  right: _right2.default,
  round: _round2.default,
  roundup: _roundup2.default,
  search: _search2.default,
  second: _second2.default,
  select: _select2.default,
  serial: _serial2.default,
  sin: _sin2.default,
  some: _some2.default,
  sort: _sort2.default,
  split: _split2.default,
  substitute: _substitute2.default,
  substituteAll: _substituteAll2.default,
  subtract: _subtract2.default,
  sum: _sum2.default,
  surroundKeys: _surroundKeys2.default,
  tan: _tan2.default,
  tau: _tau2.default,
  template: template,
  text: _text2.default,
  time: _time2.default,
  timevalue: _timevalue2.default,
  today: _today2.default,
  trim: _trim2.default,
  trunc: _trunc2.default,
  unique: _unique2.default,
  upper: _upper2.default,
  vlookup: _vlookup2.default,
  xor: _xor2.default,
  year: _year2.default,
  yearfrac: _yearfrac2.default
};
module.exports = exports['default'];
},{"./abs":8,"./acos":9,"./add":10,"./and":11,"./average":12,"./bin2dec":13,"./branch":14,"./cellindex":15,"./changed":16,"./char":17,"./choose":18,"./clean":19,"./code":20,"./column":21,"./columnletter":22,"./columnnumber":23,"./concatenate":24,"./cos":26,"./date":27,"./datedif":28,"./datevalue":29,"./day":30,"./days360":31,"./dec2bin":32,"./decodebase64":33,"./decodejwt":34,"./diff":35,"./divide":36,"./edate":37,"./eomonth":38,"./eq":39,"./exact":41,"./filter":42,"./find":43,"./flatten":44,"./fv":45,"./get":46,"./gt":47,"./gte":48,"./guid":49,"./hlookup":50,"./hour":51,"./ifblank":52,"./ifempty":53,"./iferror":54,"./ifna":55,"./index":56,"./index2col":57,"./index2row":58,"./int":59,"./isarray":60,"./isblank":61,"./isboolean":62,"./isdate":63,"./isemail":64,"./isempty":65,"./iserror":67,"./iseven":68,"./isfunction":70,"./isleapyear":71,"./isna":72,"./isnumber":73,"./isodd":74,"./isoweeknum":75,"./isref":76,"./istext":77,"./isurl":79,"./iswholenumber":80,"./join":81,"./left":82,"./len":83,"./lookup":84,"./lower":85,"./lt":86,"./lte":87,"./map":88,"./match":89,"./max":90,"./min":91,"./minute":92,"./month":93,"./multiply":94,"./n":95,"./ne":96,"./not":97,"./now":98,"./nper":99,"./npv":100,"./numbers":101,"./numbervalue":102,"./oct2dec":103,"./or":104,"./parsebool":105,"./parsedate":106,"./parsequery":107,"./pi":108,"./pluck":109,"./pmt":110,"./power":111,"./proper":112,"./pv":113,"./reduce":114,"./ref":115,"./replace":116,"./rept":117,"./right":118,"./round":119,"./roundup":120,"./search":121,"./second":122,"./select":123,"./serial":124,"./sin":125,"./some":126,"./sort":127,"./split":128,"./substitute":129,"./substituteAll":130,"./subtract":131,"./sum":132,"./surroundKeys":133,"./tan":134,"./tau":135,"./text":136,"./time":137,"./timevalue":138,"./today":139,"./trim":140,"./trunc":141,"./unique":142,"./upper":143,"./vlookup":144,"./xor":145,"./year":146,"./yearfrac":147}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = abs;

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// ABS computes absolute value of a number
// Copyright 2015 WebsiteHQ LLC

function abs(value) {

  // Return `#VALUE!` if not number
  if (!(0, _isnumber2.default)(value)) {
    return _error2.default.value;
  }

  // Use built-in Math.abs
  return Math.abs(value);
}
module.exports = exports['default'];
},{"./error":40,"./isnumber":73}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = acos;

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// ACOS computes the inverse cosine of a number
// Copyright 2015 WebsiteHQ LLC

function acos(value) {

  // Return `#VALUE!` if not number
  if (!(0, _isnumber2.default)(value)) {
    return _error2.default.value;
  }

  // Use built-in Math.acos
  return Math.acos(value);
}
module.exports = exports['default'];
},{"./error":40,"./isnumber":73}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = add;

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// ADD calculates the sum of two numbers.
// Copyright 2015 WebsiteHQ LLC

function add() {
  for (var _len = arguments.length, values = Array(_len), _key = 0; _key < _len; _key++) {
    values[_key] = arguments[_key];
  }

  // Return `#NA!` if 2 arguments are not provided.
  if (values.length !== 2) {
    return _error2.default.na;
  }

  // decompose values into a and b.
  var a = values[0],
      b = values[1];

  // Return `#VALUE!` if either a or b is not a number.

  if (!(0, _isnumber2.default)(a) || !(0, _isnumber2.default)(b)) {
    return _error2.default.value;
  }

  // Return the sum.
  return a + b;
}
module.exports = exports['default'];
},{"./error":40,"./isnumber":73}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = and;

var _iserror = require('./iserror');

var _iserror2 = _interopRequireDefault(_iserror);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

var _isfunction = require('./isfunction');

var _isfunction2 = _interopRequireDefault(_isfunction);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// AND reduces list of truthy values into true or false value
function and() {
  for (var _len = arguments.length, criteria = Array(_len), _key = 0; _key < _len; _key++) {
    criteria[_key] = arguments[_key];
  }

  // Reduce criteria into boolean value.
  return criteria.reduce(function (acc, item) {

    // Once `false` or #error! is found always return previously value
    if (acc === false || (0, _iserror2.default)(acc)) return acc;

    // find the value if a literal or deferred value
    var val = (0, _isfunction2.default)(item) ? item() : item;

    // return `#VALUE!` if not true, false, 1 or 0
    if (val !== true && val !== false && val !== 1 && val !== 0) {
      return _error2.default.value;
    }

    // Return true when value is true or 1
    return val === true || val === 1;
  });
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40,"./iserror":67,"./isfunction":70}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = average;

var _sum = require('./sum');

var _sum2 = _interopRequireDefault(_sum);

var _iserror = require('./iserror');

var _iserror2 = _interopRequireDefault(_iserror);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// AVERAGE computes sum of items divided by number of items
// Copyright 2015 WebsiteHQ LLC

function average() {

  // compute sum all of the items.
  var v = _sum2.default.apply(undefined, arguments);

  // return sum when computed error.
  if ((0, _iserror2.default)(v)) {
    return v;
  }

  // return sum divided by item count
  return v / arguments.length;
}
module.exports = exports['default'];
},{"./iserror":67,"./sum":132}],13:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = bin2dec;

var _error = require("./error");

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// BIN2DEC converts binary string into decimal value
function bin2dec(value) {
    var valueAsString;

    if (typeof value === "string") {
        valueAsString = value;
    } else if (typeof value !== "undefined") {
        valueAsString = value.toString();
    } else {
        return _error2.default.NA;
    }

    if (valueAsString.length > 10) return _error2.default.NUM;

    // we subtract 512 when the leading number is 0.
    if (valueAsString.length === 10 && valueAsString[0] === '1') {
        return parseInt(valueAsString.substring(1), 2) - 512;
    }

    // Convert binary number to decimal with built-in facility
    return parseInt(valueAsString, 2);
} // Copyright 2015 WebsiteHQ LLC

;
module.exports = exports["default"];
},{"./error":40}],14:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = branch;

var _isfunction = require('./isfunction');

var _isfunction2 = _interopRequireDefault(_isfunction);

var _istruthy = require('./istruthy');

var _istruthy2 = _interopRequireDefault(_istruthy);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// branch( test, result_if_true, [test2, result_if_true,] false_result )
// Copyright 2015 WebsiteHQ LLC

function branch() {
  for (var _len = arguments.length, cases = Array(_len), _key = 0; _key < _len; _key++) {
    cases[_key] = arguments[_key];
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
      return (0, _isfunction2.default)(item) ? item() : item;
    }

    // Check if condition is true
    if (index % 2 === 0 && ((0, _isfunction2.default)(item) && (0, _istruthy2.default)(item()) || !(0, _isfunction2.default)(item) && (0, _istruthy2.default)(item))) {
      resolved = true;
      val = cases[index + 1];
      return (0, _isfunction2.default)(val) ? val() : val;
    }

    return acc;
  }, undefined);
}
module.exports = exports['default'];
},{"./isfunction":70,"./istruthy":78}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = cellindex;

var _constants = require('./constants');

// CELLINDEX computes the index for row and column in a 2 dimensional array.
function cellindex(row, col) {
  // Multiple row by maximum columns plus the col.
  return Math.floor(row * _constants.MaxCols + col);
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./constants":25}],16:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = changed;

var _unique = require('./unique');

var _unique2 = _interopRequireDefault(_unique);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// CHANGED computes the list of keys that are different between two objects.
function changed(a, b) {

  // Compute the keys in object a and b.
  var keysA = Object.keys(a),
      keysB = Object.keys(b);

  // Find the unique set of properties comparing a to b and b to a.
  return (0, _unique2.default)(keysA.filter(function (n) {
    return a[n] !== b[n];
  }).concat(keysB.filter(function (n) {
    return a[n] !== b[n];
  })));
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./unique":142}],17:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = char;
// Copyright 2015 WebsiteHQ LLC

// CHAR convert number into character (e.g 65 => 'A')
function char(number) {
  return String.fromCharCode(number);
}
module.exports = exports["default"];
},{}],18:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = choose;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// CHOOSE accepts an index and a list of items. It returns the item that corresponds to the index.
function choose(index) {

  // Return `#NA!` if index or items are not provided.
  if (!index || (arguments.length <= 1 ? 0 : arguments.length - 1) === 0) {
    return _error2.default.na;
  }

  // Return `#VALUE!` if index is less than 1 or greater than 254.
  if (index < 1 || index > 254) {
    return _error2.default.value;
  }

  // Return `#VALUE!` if number of items is less than index.
  if ((arguments.length <= 1 ? 0 : arguments.length - 1) < index) {
    return _error2.default.value;
  }

  // Return the item.
  return arguments.length <= index - 1 + 1 ? undefined : arguments[index - 1 + 1];
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40}],19:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = clean;

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

var _select = require('./select');

var _select2 = _interopRequireDefault(_select);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// CLEAN accepts an object and remove properties that are blank.
// Copyright 2015 WebsiteHQ LLC

function clean(obj) {
  // Compute keys where value is non blank.
  var keys = Object.keys(obj).filter(function (n) {
    return !(0, _isblank2.default)(obj[n]);
  });

  // Compute object with only non-blank keys.
  return (0, _select2.default)(keys, obj);
}
module.exports = exports['default'];
},{"./isblank":61,"./select":123}],20:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = code;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// CODE accepts text and optionally index (default 1) returning the character code.
function code() {
  var text = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var index = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;

  if (index < 1) return _error2.default.na;
  if (text.length < index) return _error2.default.value;
  return text.charCodeAt(index - 1);
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40}],21:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = column;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

var _istext = require('./istext');

var _istext2 = _interopRequireDefault(_istext);

var _isref = require('./isref');

var _isref2 = _interopRequireDefault(_isref);

var _columnnumber = require('./columnnumber');

var _columnnumber2 = _interopRequireDefault(_columnnumber);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// COLUMN return the column number that corresponds to the reference.
// Copyright 2015 WebsiteHQ LLC

function column(value) {

  // Return `#VALUE!` when the value is not a reference.
  if (!(0, _isref2.default)(value)) {
    return _error2.default.value;
  }

  // Run the COLUMNNUMBER and convert to base 1.
  return (0, _columnnumber2.default)(value.column) + 1;
}
module.exports = exports['default'];
},{"./columnnumber":23,"./error":40,"./isref":76,"./istext":77}],22:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = columnletter;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Convert index to letter (e.g 0 -> A)
// Copyright 2015 WebsiteHQ LLC

function columnletter(index) {

  if (!(0, _isnumber2.default)(index)) {
    return _error2.default.value;
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
module.exports = exports['default'];
},{"./error":40,"./isnumber":73}],23:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = columnnumber;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

var _istext = require('./istext');

var _istext2 = _interopRequireDefault(_istext);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Convert letter to number (e.g A -> 0)
// Copyright 2015 WebsiteHQ LLC

function columnnumber(column) {

  if (!(0, _istext2.default)(column)) {
    return _error2.default.value;
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

  return _error2.default.value;
}
module.exports = exports['default'];
},{"./error":40,"./istext":77}],24:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = concatenate;
// Copyright 2015 WebsiteHQ LLC

// CONCATENATE reduces a list of values into a single string.
function concatenate() {
  for (var _len = arguments.length, values = Array(_len), _key = 0; _key < _len; _key++) {
    values[_key] = arguments[_key];
  }

  // Combine into a single string value
  return values.reduce(function (acc, item) {
    return "" + acc + item;
  });
}
module.exports = exports["default"];
},{}],25:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
// Copyright 2015 WebsiteHQ LLC

// Shared constants
var d1900 = exports.d1900 = new Date(1900, 0, 1),
    JulianOffset = exports.JulianOffset = 2415019,
    MinutesInHour = exports.MinutesInHour = 60,
    MinutesInDay = exports.MinutesInDay = 1440,
    SecondsInMinute = exports.SecondsInMinute = 60,
    SecondsInHour = exports.SecondsInHour = 3600,
    SecondsInDay = exports.SecondsInDay = 86400,
    DaysInYear = exports.DaysInYear = 365.25,
    MilliSecondsInDay = exports.MilliSecondsInDay = 86400000,
    AllowedDates = exports.AllowedDates = { H: "h]", M: "m]", MM: "mm]", S: "s]", SS: "ss]" },
    DayNames = exports.DayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    DayNames3 = exports.DayNames3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    MonthNames = exports.MonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    MonthNames3 = exports.MonthNames3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    AM = exports.AM = "AM",
    AM1 = exports.AM1 = "A",
    PM = exports.PM = "PM",
    PM1 = exports.PM1 = "P",


// Circle Constants
τ = exports.τ = 6.28318530717958,
    // http://tauday.com/tau-manifesto

// Address System Constants
MaxCols = exports.MaxCols = 16384,
    // 14 bits, 2^14
MaxRows = exports.MaxRows = 1048576,
    // 20 bits, 2^20

// Formatting Constants
SeparatorChar = exports.SeparatorChar = ",",
    DecimalChar = exports.DecimalChar = ".",
    DefaultCurrency = exports.DefaultCurrency = "$",
    // the currency string used if none specified
AllowedColors = exports.AllowedColors = {
  BLACK: "#000000",
  BLUE: "#0000FF",
  CYAN: "#00FFFF",
  GREEN: "#00FF00",
  MAGENTA: "#FF00FF",
  RED: "#FF0000",
  WHITE: "#FFFFFF",
  YELLOW: "#FFFF00"
};
},{}],26:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = cos;

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// COS returns the cosine of a value.
// Copyright 2015 WebsiteHQ LLC

function cos(value) {

  // Return `#VALUE!` when value is not a number.
  if (!(0, _isnumber2.default)(value)) {
    return _error2.default.value;
  }

  return Math.cos(value);
}
module.exports = exports['default'];
},{"./error":40,"./isnumber":73}],27:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = date;

var _serial = require('./serial');

var _serial2 = _interopRequireDefault(_serial);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// DATE returns a serial number given a year, month and day.
function date(year, month, day) {
  return (0, _serial2.default)(new Date(year, month - 1, day));
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./serial":124}],28:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = datedif;

var _parsedate = require("./parsedate");

var _parsedate2 = _interopRequireDefault(_parsedate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// DATEDIF return the difference between two dates given a start date, end date and unit.
function datedif(start_date, end_date, unit) {
  var second = 1000,
      minute = second * 60,
      hour = minute * 60,
      day = hour * 24,
      week = day * 7;
  start_date = (0, _parsedate2.default)(start_date), end_date = (0, _parsedate2.default)(end_date);

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
} // Copyright 2015 WebsiteHQ LLC
module.exports = exports["default"];
},{"./parsedate":106}],29:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = datevalue;

var _parsedate = require('./parsedate');

var _parsedate2 = _interopRequireDefault(_parsedate);

var _serial = require('./serial');

var _serial2 = _interopRequireDefault(_serial);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// DATEVALUE parses a date string and returns a serial number.
// Copyright 2015 WebsiteHQ LLC

function datevalue(d) {
  return (0, _serial2.default)((0, _parsedate2.default)(d));
}
module.exports = exports['default'];
},{"./parsedate":106,"./serial":124}],30:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = day;

var _parsedate = require('./parsedate');

var _parsedate2 = _interopRequireDefault(_parsedate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// DAY parses a date string and returns the day of the month.
function day(d) {
  return (0, _parsedate2.default)(d).getDate();
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./parsedate":106}],31:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = days360;

var _parsebool = require('./parsebool');

var _parsebool2 = _interopRequireDefault(_parsebool);

var _parsedate = require('./parsedate');

var _parsedate2 = _interopRequireDefault(_parsedate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Copyright 2015 WebsiteHQ LLC

function days360(start_date, end_date, method) {
    method = (0, _parsebool2.default)(method);
    start_date = (0, _parsedate2.default)(start_date);
    end_date = (0, _parsedate2.default)(end_date);

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
module.exports = exports['default'];
},{"./parsebool":105,"./parsedate":106}],32:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = dec2bin;

var _rept = require('./rept');

var _rept2 = _interopRequireDefault(_rept);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// based on https://github.com/sutoiku/formula.js/blob/mast../src/engineering.js
// Copyright 2015 WebsiteHQ LLC

function dec2bin(input, places) {

  // exit if input is an error
  if (input instanceof Error) {
    return number;
  }

  // cast input to number
  var number = parseInt(input);

  if (!/^-?[0-9]{1,3}$/.test(number) || Number.isNaN(number)) {
    return _error2.default.value;
  }

  // Return error.if number is not decimal, is lower than -512, or is greater than 511
  if (number < -512 || number > 511) {
    return _error2.default.num;
  }

  // Ignore places and return a 10-character binary number if number is negative
  if (number < 0) {
    return '1' + (0, _rept2.default)('0', 9 - (512 + number).toString(2).length) + (512 + number).toString(2);
  }

  // Convert decimal number to binary
  var result = parseInt(number, 10).toString(2);

  // Return binary number using the minimum number of characters necessary if places is undefined
  if (typeof places === 'undefined') {
    return result;
  } else {
    // Return error.if places is nonnumeric
    if (!/^-?[0-9]{1,3}$/.test(places) || Number.isNaN(places)) {
      return _error2.default.value;
    }

    // Return error.if places is negative
    if (places < 0) {
      return _error2.default.num;
    }

    // Truncate places in case it is not an integer
    places = Math.floor(places);

    // Pad return value with leading 0s (zeros) if necessary (using Underscore.string)
    return places >= result.length ? (0, _rept2.default)('0', places - result.length) + result : _error2.default.num;
  }
}
module.exports = exports['default'];
},{"./error":40,"./rept":117}],33:[function(require,module,exports){
(function (Buffer){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = decodebase64;
function decodebase64(str) {

  if (typeof window !== 'undefined' && typeof atob !== 'undefined') {
    return window.atob(str);
  } else if (typeof module !== 'undefined' && module.exports) {
    return new Buffer(str, 'base64').toString();
  } else {
    var chars;

    var _ret = function () {
      var InvalidCharacterError = function InvalidCharacterError(message) {
        this.message = message;
      };

      var atob = function atob(input) {

        var str = String(input).replace(/=+$/, '');
        if (str.length % 4 == 1) {
          throw new InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.");
        }
        for (
        // initialize result and counters
        var bc = 0, bs, buffer, idx = 0, output = '';
        // get next character
        buffer = str.charAt(idx++);
        // character found in table? initialize bit storage and add its ascii value;
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
        // and if not first of each 4 characters,
        // convert the first 8 bits to one ascii character
        bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
          // try to find character in table (0-63, not found => -1)
          buffer = chars.indexOf(buffer);
        }
        return output;
      };

      chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';


      InvalidCharacterError.prototype = new Error();
      InvalidCharacterError.prototype.name = 'InvalidCharacterError';

      return {
        v: atob(str)
      };
    }();

    if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
  }
}
module.exports = exports['default'];
}).call(this,require("buffer").Buffer)
},{"buffer":6}],34:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = decodejwt;

var _decodebase = require('./decodebase64');

var _decodebase2 = _interopRequireDefault(_decodebase);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function decodejwt(token) {

    function b64DecodeUnicode(str) {
        return decodeURIComponent(Array.prototype.map.call((0, _decodebase2.default)(str), function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    }

    return JSON.parse(b64DecodeUnicode(token.split('.')[1]));
}
module.exports = exports['default'];
},{"./decodebase64":33}],35:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = diff;
// Copyright 2015 WebsiteHQ LLC

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
module.exports = exports["default"];
},{}],36:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = divide;

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// DIVIDE calculates the product of two numbers.
// Copyright 2015 WebsiteHQ LLC

function divide() {
  for (var _len = arguments.length, values = Array(_len), _key = 0; _key < _len; _key++) {
    values[_key] = arguments[_key];
  }

  // Return `#NA!` if 2 arguments are not provided.
  if (values.length !== 2) {
    return _error2.default.na;
  }

  // decompose values into a and b.
  var a = values[0],
      b = values[1];

  // You cannot divide a number by 0.

  if (b === 0) {
    return _error2.default.div0;
  }

  // Return `#VALUE!` if either a or b is not a number.
  if (!(0, _isnumber2.default)(a) || !(0, _isnumber2.default)(b)) {
    return _error2.default.value;
  }

  // Return the product
  return a / b;
}
module.exports = exports['default'];
},{"./error":40,"./isnumber":73}],37:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = edate;

var _parsedate = require('./parsedate');

var _parsedate2 = _interopRequireDefault(_parsedate);

var _serial = require('./serial');

var _serial2 = _interopRequireDefault(_serial);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function edate(start_date, months) {
    start_date = (0, _parsedate2.default)(start_date);

    if (start_date instanceof Error) {
        return start_date;
    }
    if (isNaN(months)) {
        return error.value;
    }
    months = parseInt(months, 10);
    start_date.setMonth(start_date.getMonth() + months);
    return (0, _serial2.default)(start_date);
};
module.exports = exports['default'];
},{"./parsedate":106,"./serial":124}],38:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = eomonth;

var _parsedate = require('./parsedate');

var _parsedate2 = _interopRequireDefault(_parsedate);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Copyright 2015 WebsiteHQ LLC

function eomonth(start_date, months) {
  start_date = (0, _parsedate2.default)(start_date);

  if (start_date instanceof Error) {
    return start_date;
  }
  if (isNaN(months)) {
    return _error2.default.value;
  }
  months = parseInt(months, 10);
  return new Date(start_date.getFullYear(), start_date.getMonth() + months + 1, 0);
}
module.exports = exports['default'];
},{"./error":40,"./parsedate":106}],39:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = eq;
// Copyright 2015 WebsiteHQ LLC

// EQ compares two values and returns a boolean value.
function eq(a, b) {
  // String comparisions are case-insensitive
  if (typeof a === "string" && typeof b === "string") {
    return a.toLowerCase() === b.toLowerCase();
  } else {
    return a === b;
  }
}
module.exports = exports["default"];
},{}],40:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
// Copyright 2015 WebsiteHQ LLC

// List of errors in the spreadsheet system

function FFError(message, name) {
    this.name = name || "NotImplementedError";
    this.message = message || "";
}

FFError.prototype = Error.prototype;
FFError.prototype.toString = function () {
    return this.message;
};

var nil = new FFError('#NULL!', "Null reference"),
    div0 = new FFError('#DIV/0!', "Divide by zero"),
    value = new FFError('#VALUE!', "Invalid value"),
    ref = new FFError('#REF!', "Invalid reference"),
    name = new FFError('#NAME?', "Invalid name"),
    num = new FFError('#NUM!', "Invalid number"),
    na = new FFError('#N/A!', "Not applicable"),
    error = new FFError('#ERROR!', "Error"),
    data = new FFError('#GETTING_DATA!', "Error getting data"),
    missing = new FFError('#MISSING!', "Missing"),
    unknown = new FFError('#UNKNOWN!', "Unknown error");

exports.default = {
    nil: nil,
    div0: div0,
    value: value,
    ref: ref,
    name: name,
    num: num,
    na: na,
    error: error,
    data: data,
    missing: missing,
    unknown: unknown
};
module.exports = exports["default"];
},{}],41:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exact;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Exact compares two values and only returns true if they meet strict equivalence.
function exact(a, b) {
  return a === b;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40}],42:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = filter;
// Copyright 2015 WebsiteHQ LLC

// FILTER limits a range based on arrays of boolean values.
function filter(range) {
  for (var _len = arguments.length, filters = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    filters[_key - 1] = arguments[_key];
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
module.exports = exports["default"];
},{}],43:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = find;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// FIND searches for text within a string
function find(find_text) {
  var within_text = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var position = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;


  // Find the position of the text
  position = within_text.indexOf(find_text, position - 1);

  // If found return the position as base 1.
  return position === -1 ? _error2.default.value : position + 1;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40}],44:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = flatten;
// Copyright 2015 WebsiteHQ LLC

// FLATTEN converts a nested array into a flattened array. It only supports one
// level of nesting.
function flatten(ref) {
  return ref.reduce(function (a, b) {
    return a.concat(b);
  }, []);
}
module.exports = exports["default"];
},{}],45:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = fv;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function fv(rate, periods, payment) {
  var value = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
  var type = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;


  // is this error code correct?
  if ((0, _isblank2.default)(rate)) return _error2.default.na;
  if ((0, _isblank2.default)(periods)) return _error2.default.na;
  if ((0, _isblank2.default)(payment)) return _error2.default.na;

  var fv;
  if (rate === 0) {
    fv = value + payment * periods;
  } else {
    var term = Math.pow(1 + rate, periods);
    if (type === 1) {
      fv = value * term + payment * (1 + rate) * (term - 1) / rate;
    } else {
      fv = value * term + payment * (term - 1) / rate;
    }
  }
  return -fv;
};
module.exports = exports['default'];
},{"./error":40,"./isblank":61}],46:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = get;

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// get a property (p) from an object (o)
function get(p, o) {
  return o[p];
}
module.exports = exports['default'];
},{"./isblank":61}],47:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = gt;

var _isarray = require('./isarray');

var _isarray2 = _interopRequireDefault(_isarray);

var _isref = require('./isref');

var _isref2 = _interopRequireDefault(_isref);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function gt(a, b) {
  if ((0, _isref2.default)(a) && (0, _isref2.default)(b)) {
    return _error2.default.na;
  } else if ((0, _isarray2.default)(a) && (0, _isarray2.default)(b)) {
    return _error2.default.na;
  } else if ((0, _isref2.default)(a) || (0, _isarray2.default)(a)) {
    return a.map(function (d) {
      return d > b;
    });
  } else if ((0, _isref2.default)(b) || (0, _isarray2.default)(b)) {
    return b.map(function (d) {
      return d > a;
    });
  } else {
    return a > b;
  }
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40,"./isarray":60,"./isref":76}],48:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = gte;

var _isarray = require('./isarray');

var _isarray2 = _interopRequireDefault(_isarray);

var _isref = require('./isref');

var _isref2 = _interopRequireDefault(_isref);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Copyright 2015 WebsiteHQ LLC

function gte(a, b) {
  if ((0, _isref2.default)(a) && (0, _isref2.default)(b)) {
    return error.na;
  } else if ((0, _isarray2.default)(a) && (0, _isarray2.default)(b)) {
    return error.na;
  } else if ((0, _isref2.default)(a) || (0, _isarray2.default)(a)) {
    return a.map(function (d) {
      return d >= b;
    });
  } else if ((0, _isref2.default)(b) || (0, _isarray2.default)(b)) {
    return b.map(function (d) {
      return d >= a;
    });
  } else {
    return a >= b;
  }
}
module.exports = exports['default'];
},{"./isarray":60,"./isref":76}],49:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = guid;
// Copyright 2015 WebsiteHQ LLC

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
module.exports = exports['default'];
},{}],50:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = hlookup;

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Find a needle in a table searching horizontally.
// Copyright 2015 WebsiteHQ LLC

function hlookup(needle, table) {
    var index = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
    var exactmatch = arguments[3];

    if (typeof needle === "undefined" || (0, _isblank2.default)(needle)) {
        return null;
    }

    if (index > table.length) {
        return _error2.default.ref;
    }

    var needleLower = (needle + '').toLowerCase(),
        row = table[0];

    for (var i = 0; i < row.length; i++) {

        if (exactmatch && row[i] === needle || row[i] == needle || typeof row[i] === "string" && row[i].toLowerCase().indexOf(needleLower) != -1) {
            return table[index - 1][i];
        }
    }

    return _error2.default.na;
}
module.exports = exports['default'];
},{"./error":40,"./isblank":61}],51:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = hour;

var _trunc = require('./trunc');

var _trunc2 = _interopRequireDefault(_trunc);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function hour(value) {
    // remove numbers before decimal place and convert fraction to 24 hour scale.
    return (0, _trunc2.default)((value - (0, _trunc2.default)(value)) * 24);
}
module.exports = exports['default'];
},{"./trunc":141}],52:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = ifblank;

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// IFBLANK return the `value` if non-blank, otherwise it returns `value_if_blank`.
function ifblank(value, value_if_blank) {
    return (0, _isblank2.default)(value) ? value_if_blank : value;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./isblank":61}],53:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = ifempty;

var _isempty = require('./isempty');

var _isempty2 = _interopRequireDefault(_isempty);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// IFBLANK return the `value` if empty, otherwise it returns `value_if_empty`.
function ifempty(value, value_if_empty) {
    return (0, _isempty2.default)(value) ? value_if_empty : value;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./isempty":65}],54:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = iferror;

var _iserror = require('./iserror');

var _iserror2 = _interopRequireDefault(_iserror);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// IFBLANK return the `value` if error, otherwise it returns `value_if_error`.
function iferror(value) {
    var value_if_error = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    return (0, _iserror2.default)(value) ? value_if_error : value;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./iserror":67}],55:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = ifna;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// IFBLANK return the `value` if `#NA!`, otherwise it returns `value_if_na`.
function ifna(value, value_if_na) {
    return value === _error2.default.na ? value_if_na : value;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40}],56:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = index;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

var _isarray = require('./isarray');

var _isarray2 = _interopRequireDefault(_isarray);

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// index returns the value in a row and column from a 2d array
function index(reference, row_num) {
  var column_num = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;

  var row;

  if (!(0, _isarray2.default)(reference) || (0, _isblank2.default)(row_num)) {
    return _error2.default.value;
  }

  if (reference.length < row_num) {
    return _error2.default.ref;
  }

  row = reference[row_num - 1];

  if (!(0, _isarray2.default)(row)) {
    return _error2.default.value;
  }

  if (row.length < column_num) {
    return _error2.default.ref;
  }

  return row[column_num - 1];
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40,"./isarray":60,"./isblank":61}],57:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = index2col;

var _constants = require('./constants');

var _index2row = require('./index2row');

var _index2row2 = _interopRequireDefault(_index2row);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// INDEX2COL computes the column given a cell index
// Copyright 2015 WebsiteHQ LLC

function index2col(index) {
  return index - (0, _index2row2.default)(index) * _constants.MaxCols;
}
module.exports = exports['default'];
},{"./constants":25,"./index2row":58}],58:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = index2row;

var _constants = require('./constants');

// INDEX2COL computes the row given a cell index
function index2row(index) {
  return Math.floor(index / _constants.MaxCols);
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./constants":25}],59:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = int;
function int(value) {
  return Math.floor(value);
}
module.exports = exports["default"];
},{}],60:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isarray;
// Copyright 2015 WebsiteHQ LLC

// ISARRAY returns true when the value is an aray.
function isarray(value) {
  return Object.prototype.toString.call(value) === '[object Array]';
}
module.exports = exports['default'];
},{}],61:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = isblank;
// Copyright 2015 WebsiteHQ LLC

// ISBLANK returns true when the value is undefined or null.
function isblank(value) {
    return typeof value === 'undefined' || value === null;
};
module.exports = exports['default'];
},{}],62:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = isboolean;
// Copyright 2015 WebsiteHQ LLC

// returns true if true or false
function isboolean(val) {
    return val === true || val === false;
};
module.exports = exports["default"];
},{}],63:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = isdate;
// Copyright 2015 WebsiteHQ LLC

// ISDATE returns true when the `value` is a JavaScript date object.
function isdate(value) {
    return value && Object.prototype.toString.call(value) == '[object Date]';
};
module.exports = exports['default'];
},{}],64:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isemail;
// Copyright 2015 WebsiteHQ LLC

// ISEMAIL returns true when the `value` matches the regex.
function isemail(value) {
  // credit to http://stackoverflow.com/questions/46155/validate-email-address-in-javascript
  var re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(value);
};
module.exports = exports["default"];
},{}],65:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isempty;

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

var _isarray = require('./isarray');

var _isarray2 = _interopRequireDefault(_isarray);

var _istext = require('./istext');

var _istext2 = _interopRequireDefault(_istext);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// ISEMPTY returns true when the value is blank, is an empty array or when it
// is an empty string.
function isempty(value) {
  return (0, _isblank2.default)(value) || (0, _isarray2.default)(value) && value.length === 0 || (0, _istext2.default)(value) && value === '';
} // Copyright 2015 WebsiteHQ LLC

;
module.exports = exports['default'];
},{"./isarray":60,"./isblank":61,"./istext":77}],66:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = iserr;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// ISERR returns true when the value is an error (except `#NA!`) or when then
// value is a number which is NaN or [-]Infinity.
function iserr(value) {
  return value !== _error2.default.na && value.constructor.name === 'Error' || typeof value === 'number' && (Number.isNaN(value) || !Number.isFinite(value));
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40}],67:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = iserror;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

var _iserr = require('./iserr');

var _iserr2 = _interopRequireDefault(_iserr);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// ISERROR returns true when the value is an error.
// Copyright 2015 WebsiteHQ LLC

function iserror(value) {
    return (0, _iserr2.default)(value) || value === _error2.default.na;
}
module.exports = exports['default'];
},{"./error":40,"./iserr":66}],68:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = iseven;
// Copyright 2015 WebsiteHQ LLC

// ISEVEN returns true when the value is even.
function iseven(value) {
    return !(Math.floor(Math.abs(value)) & 1);
}
module.exports = exports["default"];
},{}],69:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isblank;
// Copyright 2015 WebsiteHQ LLC

// Returns true when the value is a falsy value.
// https://developer.mozilla.org/en-US/docs/Glossary/Falsy
function isblank(value) {
  return value === false || value === 0 || value === '' || typeof value === 'undefined' || value === null || Number.isNaN(value);
};
module.exports = exports['default'];
},{}],70:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = isfunction;
// Copyright 2015 WebsiteHQ LLC

// ISFUNCTION returns true when `value` is a function.
function isfunction(value) {
    return value && Object.prototype.toString.call(value) == '[object Function]';
};
module.exports = exports['default'];
},{}],71:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = isleapyear;

var _parsedate = require('./parsedate');

var _parsedate2 = _interopRequireDefault(_parsedate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function isleapyear(val) {
    var date = (0, _parsedate2.default)(val);
    var year = date.getFullYear();
    return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
}
module.exports = exports['default'];
},{"./parsedate":106}],72:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isna;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// ISNA returns true when the value is `#NA!`
function isna(value) {
  return value === _error2.default.na;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40}],73:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = isnumber;
// Copyright 2015 WebsiteHQ LLC

// Returns true when the value is a finite number.
function isnumber(value) {
    return typeof value === 'number' && !Number.isNaN(value) && isFinite(value);
}
module.exports = exports['default'];
},{}],74:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isodd;
// Copyright 2015 WebsiteHQ LLC

// ISODD returns true when the value is odd.
function isodd(value) {
  return !!(Math.floor(Math.abs(value)) & 1);
}
module.exports = exports["default"];
},{}],75:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = isoweeknum;

var _parsedate = require('./parsedate');

var _parsedate2 = _interopRequireDefault(_parsedate);

var _constants = require('./constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function isoweeknum(date) {
    date = (0, _parsedate2.default)(date);

    if (date instanceof Error) {
        return date;
    }

    date.setHours(0, 0, 0);
    date.setDate(date.getDate() + 4 - (date.getDay() || 7));
    var yearStart = new Date(date.getFullYear(), 0, 1);
    return Math.ceil(((date - yearStart) / _constants.MilliSecondsInDay + 1) / 7);
};
module.exports = exports['default'];
},{"./constants":25,"./parsedate":106}],76:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isref;

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// ISREF returns true when the value is a reference.
function isref(value) {
  if (!value) return false;
  return value._isref === true;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./isblank":61}],77:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = istext;
// Copyright 2015 WebsiteHQ LLC

// ISTEXT returns true when the value is a string.
function istext(value) {
    return 'string' === typeof value;
};
module.exports = exports['default'];
},{}],78:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = istruthy;

var _isfalsy = require('./isfalsy');

var _isfalsy2 = _interopRequireDefault(_isfalsy);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Returns true when the value is not falsey
// https://developer.mozilla.org/en-US/docs/Glossary/Truthy
function istruthy(value) {
    return !(0, _isfalsy2.default)(value);
} // Copyright 2015 WebsiteHQ LLC

;
module.exports = exports['default'];
},{"./isfalsy":69}],79:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isurl;
// Copyright 2015 WebsiteHQ LLC

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
module.exports = exports['default'];
},{}],80:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = iswholenumber;

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Returns true when the value is a whole number
function iswholenumber(value) {
    return (0, _isnumber2.default)(value) && value % 1 === 0;
} // Copyright 2015 WebsiteHQ LLC
module.exports = exports['default'];
},{"./isnumber":73}],81:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = join;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// combine a array of strings/numbers into a single string
function join(list) {
  var delim = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ', ';


  // all values must be string or number
  if (list.some(function (d) {
    return typeof d !== 'string' && typeof d !== 'number';
  })) {
    return _error2.default.value;
  }

  // defer to JS implementation
  return list.join(delim);
}
module.exports = exports['default'];
},{"./error":40}],82:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = left;

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

var _n = require('./n');

var _n2 = _interopRequireDefault(_n);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function left(text, number) {

  if ((0, _isblank2.default)(text)) {
    return '';
  }

  if (!(0, _n2.default)(+number)) {
    return text;
  }

  return text.substring(0, number);
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40,"./isblank":61,"./n":95}],83:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = len;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// LEN returns the size of a string or array.
function len(text) {
  if (arguments.length === 0) {
    return _error2.default.error;
  }

  if (typeof text === 'string') {
    return text.length;
  }

  if (text.length) {
    return text.length;
  }

  return _error2.default.value;
} // Copyright 2015 WebsiteHQ LLC

;
module.exports = exports['default'];
},{"./error":40}],84:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = lookup;
// Copyright 2015 WebsiteHQ LLC

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
module.exports = exports['default'];
},{}],85:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = lower;

var _istext = require('./istext');

var _istext2 = _interopRequireDefault(_istext);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// LOWER converts `value` to lower case
// Copyright 2015 WebsiteHQ LLC

function lower(value) {
  if (!(0, _istext2.default)(value)) return _error2.default.value;
  return value.toLowerCase();
}
module.exports = exports['default'];
},{"./error":40,"./istext":77}],86:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = lt;

var _isarray = require('./isarray');

var _isarray2 = _interopRequireDefault(_isarray);

var _isref = require('./isref');

var _isref2 = _interopRequireDefault(_isref);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// LT compares two values and returns true when a is less than b.
// Copyright 2015 WebsiteHQ LLC

function lt(a, b) {
  if ((0, _isref2.default)(a) && (0, _isref2.default)(b)) {
    return error.na;
  } else if ((0, _isarray2.default)(a) && (0, _isarray2.default)(b)) {
    return error.na;
  } else if ((0, _isref2.default)(a) || (0, _isarray2.default)(a)) {
    return a.map(function (d) {
      return d < b;
    });
  } else if ((0, _isref2.default)(b) || (0, _isarray2.default)(b)) {
    return b.map(function (d) {
      return d < a;
    });
  } else {
    return a < b;
  }
}
module.exports = exports['default'];
},{"./isarray":60,"./isref":76}],87:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = lte;

var _isarray = require('./isarray');

var _isarray2 = _interopRequireDefault(_isarray);

var _isref = require('./isref');

var _isref2 = _interopRequireDefault(_isref);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// LT compares two values and returns true when a is less than or equal to b.
// Copyright 2015 WebsiteHQ LLC

function lte(a, b) {
  if ((0, _isref2.default)(a) && (0, _isref2.default)(b)) {
    return error.na;
  } else if ((0, _isarray2.default)(a) && (0, _isarray2.default)(b)) {
    return error.na;
  } else if ((0, _isref2.default)(a) || (0, _isarray2.default)(a)) {
    return a.map(function (d) {
      return d <= b;
    });
  } else if ((0, _isref2.default)(b) || (0, _isarray2.default)(b)) {
    return b.map(function (d) {
      return d <= a;
    });
  } else {
    return a <= b;
  }
}
module.exports = exports['default'];
},{"./isarray":60,"./isref":76}],88:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = map;
// map an array to a new array
function map(arr, f) {
  return arr.map(function (d) {
    return f(d);
  });
}
module.exports = exports["default"];
},{}],89:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = match;

var _isarray = require('./isarray');

var _isarray2 = _interopRequireDefault(_isarray);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// MATCH returns an index in `array_reference` by searching for `lookup_reference`.
// Copyright 2015 WebsiteHQ LLC

function match(lookup_reference, array_reference, matchType) {

  var lookupArray, lookupValue, index, indexValue;

  // Gotta have only 2 arguments folks!
  if (arguments.length === 2) {
    matchType = 1;
  }

  // Find the lookup value inside a worksheet cell, if needed.
  lookupValue = lookup_reference;

  // Find the array inside a worksheet range, if needed.
  if ((0, _isarray2.default)(array_reference)) {
    lookupArray = array_reference;
  } else {
    return _error2.default.na;
  }

  // Gotta have both lookup value and array
  if (!lookupValue && !lookupArray) {
    return _error2.default.na;
  }

  // Bail on weird match types!
  if (matchType !== -1 && matchType !== 0 && matchType !== 1) {
    return _error2.default.na;
  }

  for (var idx = 0; idx < lookupArray.length; idx++) {
    if (matchType === 1) {
      if (lookupArray[idx] === lookupValue) {
        return idx + 1;
      } else if (lookupArray[idx] < lookupValue) {
        if (!indexValue) {
          index = idx + 1;
          indexValue = lookupArray[idx];
        } else if (lookupArray[idx] > indexValue) {
          index = idx + 1;
          indexValue = lookupArray[idx];
        }
      }
    } else if (matchType === 0) {
      if (typeof lookupValue === 'string') {
        // '?' is mapped to the regex '.'
        // '*' is mapped to the regex '.*'
        // '~' is mapped to the regex '\?'
        if (idx === 0) {
          lookupValue = "^" + lookupValue.replace(/\?/g, '.').replace(/\*/g, '.*').replace(/~/g, '\\?') + "$";
        }
        if (typeof lookupArray[idx] !== "undefined") {
          if (String(lookupArray[idx]).toLowerCase().match(String(lookupValue).toLowerCase())) {
            return idx + 1;
          }
        }
      } else {
        if (typeof lookupArray[idx] !== "undefined" && lookupArray[idx] !== null && lookupArray[idx].valueOf() === lookupValue) {
          return idx + 1;
        }
      }
    } else if (matchType === -1) {
      if (lookupArray[idx] === lookupValue) {
        return idx + 1;
      } else if (lookupArray[idx] > lookupValue) {
        if (!indexValue) {
          index = idx + 1;
          indexValue = lookupArray[idx];
        } else if (lookupArray[idx] < indexValue) {
          index = idx + 1;
          indexValue = lookupArray[idx];
        }
      }
    }
  }

  return index ? index : _error2.default.na;
};
module.exports = exports['default'];
},{"./error":40,"./isarray":60}],90:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = max;

var _flatten = require('./flatten');

var _flatten2 = _interopRequireDefault(_flatten);

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// MAX returns the largest number from a `list`.
function max() {
  for (var _len = arguments.length, list = Array(_len), _key = 0; _key < _len; _key++) {
    list[_key] = arguments[_key];
  }

  var values = (0, _flatten2.default)(list);
  if (values.length === 0) return;
  return values.reduce(function (max, next) {
    if ((0, _isblank2.default)(max)) return next;else if ((0, _isnumber2.default)(next)) return Math.max(max, next);else return max;
  });
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./flatten":44,"./isblank":61,"./isnumber":73}],91:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = min;

var _flatten = require('./flatten');

var _flatten2 = _interopRequireDefault(_flatten);

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// MIN returns the smallest number from a `list`.
function min() {
  for (var _len = arguments.length, list = Array(_len), _key = 0; _key < _len; _key++) {
    list[_key] = arguments[_key];
  }

  var values = (0, _flatten2.default)(list);
  if (values.length === 0) return;
  return values.reduce(function (min, next) {
    if ((0, _isblank2.default)(min)) return next;else if ((0, _isnumber2.default)(next)) return Math.min(min, next);else return min;
  });
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./flatten":44,"./isblank":61,"./isnumber":73}],92:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = minute;

var _constants = require('./constants');

var _trunc = require('./trunc');

var _trunc2 = _interopRequireDefault(_trunc);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function minute(value) {
  // calculate total seconds
  var totalSeconds = (value - (0, _trunc2.default)(value)) * _constants.SecondsInDay;
  // calculate number of seconds for hour components
  var hourSeconds = (0, _trunc2.default)(totalSeconds / _constants.SecondsInHour) * _constants.SecondsInHour;
  // calculate the number seconds after remove seconds from the hours and convert to minutes
  return (0, _trunc2.default)((totalSeconds - hourSeconds) / _constants.SecondsInMinute);
}
module.exports = exports['default'];
},{"./constants":25,"./trunc":141}],93:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = month;

var _parsedate = require('./parsedate');

var _parsedate2 = _interopRequireDefault(_parsedate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// MONTH parses a date value and returns the month of the year.
function month(d) {
  return (0, _parsedate2.default)(d).getMonth() + 1;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./parsedate":106}],94:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = multiply;

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// MULTIPLY calculates the product of two numbers.
// Copyright 2015 WebsiteHQ LLC

function multiply() {
  for (var _len = arguments.length, values = Array(_len), _key = 0; _key < _len; _key++) {
    values[_key] = arguments[_key];
  }

  // Return `#NA!` if 2 arguments are not provided.
  if (values.length !== 2) {
    return _error2.default.na;
  }

  // decompose values into a and b.
  var a = values[0],
      b = values[1];

  // Return `#VALUE!` if either a or b is not a number.

  if (!(0, _isnumber2.default)(a) || !(0, _isnumber2.default)(b)) {
    return _error2.default.value;
  }

  // Return the product
  return a * b;
}
module.exports = exports['default'];
},{"./error":40,"./isnumber":73}],95:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = n;

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _iserror = require('./iserror');

var _iserror2 = _interopRequireDefault(_iserror);

var _serial = require('./serial');

var _serial2 = _interopRequireDefault(_serial);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// N converts a `value` to a number. It supports numbers, true, false and dates.
function n(value) {

  // Pass numbers and errors back out.
  if ((0, _isnumber2.default)(value) || (0, _iserror2.default)(value)) {
    return value;
  }

  // Convert dates to serial number.
  if (value instanceof Date) {
    return (0, _serial2.default)(value);
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
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./iserror":67,"./isnumber":73,"./serial":124}],96:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = ne;

var _eq = require('./eq');

var _eq2 = _interopRequireDefault(_eq);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// NE returns true when a is not equal to b.
function ne(a, b) {
  return !(0, _eq2.default)(a, b);
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./eq":39}],97:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = not;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// NOT negates a `value`
function not(value) {
  return value !== true && value !== false && value !== 1 && value !== 0 ? _error2.default.value : !value;
} // Copyright 2015 WebsiteHQ LLC
module.exports = exports['default'];
},{"./error":40}],98:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = now;

var _datevalue = require('./datevalue');

var _datevalue2 = _interopRequireDefault(_datevalue);

var _timevalue = require('./timevalue');

var _timevalue2 = _interopRequireDefault(_timevalue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function now() {
  var d = new Date();
  return (0, _datevalue2.default)(d.toLocaleDateString()) + (0, _timevalue2.default)(d.toLocaleTimeString());
};
module.exports = exports['default'];
},{"./datevalue":29,"./timevalue":138}],99:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = nper;
function nper(rate, pmt, pv, fv, type) {
  var log, result;
  rate = parseFloat(rate || 0);
  pmt = parseFloat(pmt || 0);
  pv = parseFloat(pv || 0);
  fv = fv || 0;
  type = type || 0;

  log = function log(prim) {
    if (Number.isNaN(prim)) {
      return Math.log(0);
    }
    var num = Math.log(prim);
    return num;
  };

  if (rate == 0.0) {
    result = -(pv + fv) / pmt;
  } else if (type > 0.0) {
    result = log(-(rate * fv - pmt * (1.0 + rate)) / (rate * pv + pmt * (1.0 + rate))) / log(1.0 + rate);
  } else {
    result = log(-(rate * fv - pmt) / (rate * pv + pmt)) / log(1.0 + rate);
  }

  if (Number.isNaN(result)) {
    result = 0;
  }

  return result;
}
module.exports = exports["default"];
},{}],100:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = npv;
function npv(rate) {
    rate = rate * 1;
    var factor = 1,
        sum = 0;

    for (var _len = arguments.length, values = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        values[_key - 1] = arguments[_key];
    }

    for (var i = 0; i < values.length; i++) {
        var factor = factor * (1 + rate);
        sum += values[i] / factor;
    }

    return sum;
}
module.exports = exports["default"];
},{}],101:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = numbers;

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function numbers() {
  for (var _len = arguments.length, values = Array(_len), _key = 0; _key < _len; _key++) {
    values[_key] = arguments[_key];
  }

  console.log(values);
  return values.reduce(function (p, v) {
    return (0, _isnumber2.default)(v) ? p.concat(v) : p;
  }, []);
}
module.exports = exports['default'];
},{"./isnumber":73}],102:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = numbervalue;

var _isempty = require('./isempty');

var _isempty2 = _interopRequireDefault(_isempty);

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Convert a text value into a number value.
function numbervalue(text, decimal_separator, group_separator) {
  decimal_separator = decimal_separator || '.';
  group_separator = group_separator || ',';

  // Return `#VALUE!` when text is empty
  if ((0, _isempty2.default)(text)) {
    return _error2.default.value;
  }

  // Return the value when it is already a number.
  if ((0, _isnumber2.default)(text)) {
    return text;
  }

  var foundDecimal = false,
      len = text.length - 1;

  if (text.length === 1) {
    if (text.charCodeAt(0) < 48 || text.charCodeAt(0) > 57) {
      return _error2.default.value;
    }
    return +text;
  }

  return text.split('').reduce(function (acc, item, index) {
    if (acc === _error2.default.value) {
      return _error2.default.value;
    } else if (len === index) {
      if (item === '%') {
        return +acc / 100;
      }
      return +acc.concat(item);
    } else if (item === decimal_separator) {
      if (foundDecimal) return _error2.default.value;
      foundDecimal = true;
      return acc.concat('.');
    } else if (item === group_separator) {
      return acc;
      // check if between 0 and 9 ascii codes
    } else if (item.charCodeAt(0) < 48 || item.charCodeAt(0) > 57) {
      return _error2.default.value;
    }

    return acc.concat(item);
  });
};
module.exports = exports['default'];
},{"./error":40,"./isempty":65,"./isnumber":73}],103:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = oct2dec;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// OCT2DEC converts a octal value into a decimal value.
function oct2dec(octalNumber) {
  // Credits: Based on implementation found in https://gist.github.com/ghalimi/4525876#file-oct2dec-js
  // Return error.when number passed in is not octal or has more than 10 digits
  if (!/^[0-7]{1,10}$/.test(octalNumber)) return _error2.default.num;

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
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40}],104:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = or;

var _isfunction = require('./isfunction');

var _isfunction2 = _interopRequireDefault(_isfunction);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// OR returns true when any of the criter is true or 1.
function or() {
  for (var _len = arguments.length, criteria = Array(_len), _key = 0; _key < _len; _key++) {
    criteria[_key] = arguments[_key];
  }

  return criteria.reduce(function (acc, item) {
    if (acc === true) return true;
    var value = (0, _isfunction2.default)(item) ? item() : item;
    return value === true || value === 1;
  }, false);
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./isfunction":70}],105:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = parsebool;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

  return _error2.default.value;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40}],106:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = parsedate;

var _constants = require('./constants');

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// PARSEDATE converts a value into a Date object.
// Copyright 2015 WebsiteHQ LLC

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
    return convert_date_julian_to_gregorian(Math.floor(val + _constants.JulianOffset));
  } else if (typeof val === 'string') {
    var timestamp = Date.parse(val);
    if (Number.isNaN(timestamp)) {
      return _error2.default.value;
    }
    return new Date(timestamp);
  }

  return _error2.default.value;
}
module.exports = exports['default'];
},{"./constants":25,"./error":40}],107:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = parsequery;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// parse querystring into object
function parsequery() {
  var query = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';


  if (typeof query !== 'string') {
    return _error2.default.na;
  }

  if (query.length === 0) {
    return {};
  }

  return (query[0] === '?' ? query.substr(1) : query).split('&').reduce(function (acc, item) {
    var n = item.split('=');
    var key = decodeURIComponent(n[0]);
    var value = decodeURIComponent(n[1] || '');
    acc[key] = value;
    return acc;
  }, {});
}
module.exports = exports['default'];
},{"./error":40}],108:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = pi;

var _constants = require('./constants');

// PI returns half the universal circle constant
function pi() {
  return _constants.τ / 2;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./constants":25}],109:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = pluck;

var _isarray = require('./isarray');

var _isarray2 = _interopRequireDefault(_isarray);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// pluck a property from a list of objects
function pluck(prop, list) {
  if (!(0, _isarray2.default)(list)) {
    return _error2.default.na;
  }

  return list.map(function (d) {
    return d[prop];
  });
}
module.exports = exports['default'];
},{"./error":40,"./isarray":60}],110:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = pmt;

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// PMT returns a loan payment
// Copyright 2015 WebsiteHQ LLC

function pmt(rate, periods, present) {
  var future = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
  var type = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;


  if (!(0, _isnumber2.default)(rate) || !(0, _isnumber2.default)(periods)) {
    return _error2.default.value;
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
module.exports = exports['default'];
},{"./error":40,"./isnumber":73}],111:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = power;

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// POWER computes the power of a value and nth degree.
// Copyright 2015 WebsiteHQ LLC

function power() {
  for (var _len = arguments.length, values = Array(_len), _key = 0; _key < _len; _key++) {
    values[_key] = arguments[_key];
  }

  // Return `#NA!` if 2 arguments are not provided.
  if (values.length !== 2) {
    return _error2.default.na;
  }

  // decompose values into a and b.
  var val = values[0],
      nth = values[1];

  // Return `#VALUE!` if either a or b is not a number.

  if (!(0, _isnumber2.default)(val) || !(0, _isnumber2.default)(nth)) {
    return _error2.default.value;
  }

  // Compute the power of val to the nth.
  return Math.pow(val, nth);
}
module.exports = exports['default'];
},{"./error":40,"./isnumber":73}],112:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = proper;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// PROPER converts text into proper case.
function proper(text) {
    if (text === undefined || text.length === 0) {
        return _error2.default.value;
    }
    if (text === true) {
        text = 'TRUE';
    }
    if (text === false) {
        text = 'FALSE';
    }
    if (Number.isNaN(text) && typeof text === 'number') {
        return _error2.default.value;
    }
    if (typeof text === 'number') {
        text = '' + text;
    }

    return text.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40}],113:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = pv;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function pv(rate, periods, payment) {
  var future = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
  var type = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;


  // is this error code correct?
  if ((0, _isblank2.default)(rate)) return _error2.default.na;
  if ((0, _isblank2.default)(periods)) return _error2.default.na;
  if ((0, _isblank2.default)(payment)) return _error2.default.na;

  if (rate === 0) {
    return -payment * periods - future;
  } else {
    return ((1 - Math.pow(1 + rate, periods)) / rate * payment * (1 + rate * type) - future) / Math.pow(1 + rate, periods);
  }
};
module.exports = exports['default'];
},{"./error":40,"./isblank":61}],114:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = reduce;
// reduce an array to a value
function reduce(arr, f) {
  return arr.reduce(function (p, v) {
    return f(p, v);
  });
}
module.exports = exports["default"];
},{}],115:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = ref;

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

var _isfunction = require('./isfunction');

var _isfunction2 = _interopRequireDefault(_isfunction);

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _index2col = require('./index2col');

var _index2col2 = _interopRequireDefault(_index2col);

var _index2row = require('./index2row');

var _index2row2 = _interopRequireDefault(_index2row);

var _unique = require('./unique');

var _unique2 = _interopRequireDefault(_unique);

var _columnletter = require('./columnletter');

var _columnletter2 = _interopRequireDefault(_columnletter);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// REF accepts top and bottom and returns a reference object. It encapsulates a cell or a range.
// Copyright 2015 WebsiteHQ LLC

function ref(top, bottom) {

  // The index must be a number
  if (!(0, _isnumber2.default)(top) && !(0, _isfunction2.default)(top)) {
    return _error2.default.value;
  }

  if ((0, _isblank2.default)(bottom)) {
    bottom = top;
  }

  var getTop = function getTop() {
    return (0, _isfunction2.default)(top) ? top() : top;
  };
  var getBottom = function getBottom() {
    return (0, _isfunction2.default)(bottom) ? bottom() : bottom;
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
      return (0, _index2row2.default)(getTop()) + 1;
    },

    // Returns rowIndex (base 0)
    get rowIndex() {
      return (0, _index2row2.default)(getTop());
    },

    // Returns column letter
    get column() {
      return (0, _columnletter2.default)((0, _index2col2.default)(getTop()));
    },

    // Returns column index
    get columnIndex() {
      return (0, _index2col2.default)(getTop());
    },

    // Returns row (rowIndex plus 1)
    get bottomRow() {
      return (0, _index2row2.default)(getBottom()) + 1;
    },

    // Returns rowIndex (base 0)
    get bottomRowIndex() {
      return (0, _index2row2.default)(getBottom());
    },

    // Returns column letter
    get bottomColumn() {
      return (0, _columnletter2.default)((0, _index2col2.default)(getBottom()));
    },

    // Returns column index
    get bottomColumnIndex() {
      return (0, _index2col2.default)(getBottom());
    },

    // The cell id puts the whole table into a single dimension. It simply needs to be between the topLeft and the bottomRight to qualify.
    hit: function hit(index) {

      // Return `#NA!` when index is negative.
      if (index < 0) return _error2.default.na;

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
      return (0, _unique2.default)(Array.apply(getTop(), Array(1 + (getBottom() - getTop()))).map(function (x, y) {
        return (0, _index2row2.default)(y + getTop());
      }));
    }

  };
}
module.exports = exports['default'];
},{"./columnletter":22,"./error":40,"./index2col":57,"./index2row":58,"./isblank":61,"./isfunction":70,"./isnumber":73,"./unique":142}],116:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = replace;

var _iserror = require('./iserror');

var _iserror2 = _interopRequireDefault(_iserror);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// REPLACE returns a new string after replacing with `new_text`.
// Copyright 2015 WebsiteHQ LLC

function replace(text, position, length, new_text) {

  if ((0, _iserror2.default)(position) || (0, _iserror2.default)(length) || typeof text !== 'string' || typeof new_text !== 'string') {
    return _error2.default.value;
  }
  return text.substr(0, position - 1) + new_text + text.substr(position - 1 + length);
}
module.exports = exports['default'];
},{"./error":40,"./iserror":67}],117:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = rept;
// Copyright 2015 WebsiteHQ LLC

// REPT creates string by repeating text a given number of times.
function rept(text, number) {
  var r = '';
  for (var i = 0; i < number; i++) {
    r += text;
  }
  return r;
}
module.exports = exports['default'];
},{}],118:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = right;

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

var _n = require('./n');

var _n2 = _interopRequireDefault(_n);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// RIGHT pulls a given number of character from the right side of `text`.
function right(text, number) {

  if ((0, _isblank2.default)(text)) {
    return '';
  }

  if (!(0, _n2.default)(+number)) {
    return text;
  }

  return text.substring(text.length - number);
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40,"./isblank":61,"./n":95}],119:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = round;
// Copyright 2015 WebsiteHQ LLC

// CONVERT a number to a fixed precision.
function round(number, precision) {
  return +number.toFixed(precision);
}
module.exports = exports["default"];
},{}],120:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = roundup;
// Copyright 2015 WebsiteHQ LLC

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
module.exports = exports["default"];
},{}],121:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = search;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
    return _error2.default.value;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40}],122:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = second;

var _constants = require('./constants');

var _trunc = require('./trunc');

var _trunc2 = _interopRequireDefault(_trunc);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function second(value) {

  // calculate total seconds
  var totalSeconds = (value - (0, _trunc2.default)(value)) * _constants.SecondsInDay;

  // calculate number of seconds for hour component
  var hourSeconds = (0, _trunc2.default)(totalSeconds / _constants.SecondsInHour) * _constants.SecondsInHour;

  // calculate number of seconds in minute component
  var minuteSeconds = (0, _trunc2.default)((totalSeconds - hourSeconds) / _constants.SecondsInMinute) * _constants.SecondsInMinute;

  // remove seconds for hours and minutes and round to nearest value
  return Math.round(totalSeconds - hourSeconds - minuteSeconds);
}
module.exports = exports['default'];
},{"./constants":25,"./trunc":141}],123:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; // Copyright 2015 WebsiteHQ LLC


exports.default = select;

var _isarray = require('./isarray');

var _isarray2 = _interopRequireDefault(_isarray);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// SELECT fields from object
function select(fields, body) {
  // non-json
  if (!body || 'object' != (typeof body === 'undefined' ? 'undefined' : _typeof(body))) return;

  // check for fields
  if (!fields) return;

  // split
  if ('string' == typeof fields) fields = fields.split(/ *, */);

  // fields array
  if ((0, _isarray2.default)(body)) {
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
module.exports = exports['default'];
},{"./isarray":60}],124:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = serial;

var _constants = require('./constants');

var _isdate = require('./isdate');

var _isdate2 = _interopRequireDefault(_isdate);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// SERIAL convert a date object into a serial number.
function serial(date) {
  // Credit: https://github.com/sutoiku/formula.js/
  if (!(0, _isdate2.default)(date)) {
    return _error2.default.na;
  }
  var diff = Math.ceil((date - _constants.d1900) / _constants.MilliSecondsInDay);
  return diff + (diff > 59 ? 2 : 1);
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./constants":25,"./error":40,"./isdate":63}],125:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = sin;

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// SIN calculates the sinine of a value.
// Copyright 2015 WebsiteHQ LLC

function sin(value) {

  if (!(0, _isnumber2.default)(value)) {
    return _error2.default.value;
  }

  return Math.sin(value);
}
module.exports = exports['default'];
},{"./error":40,"./isnumber":73}],126:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = some;

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

var _isarray = require('./isarray');

var _isarray2 = _interopRequireDefault(_isarray);

var _eq = require('./eq');

var _eq2 = _interopRequireDefault(_eq);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// INT returns true when a needle is found in a list.
// Copyright 2015 WebsiteHQ LLC

function some(needle, list) {

  // Return `#NA!` when the needle and list are blank.
  if ((0, _isblank2.default)(needle) && (0, _isblank2.default)(list)) {
    return _error2.default.na;
  }

  // Return `#NA!` when the list is not an array.
  if (!(0, _isarray2.default)(list)) {
    return _error2.default.na;
  }

  // Return true when some of the values match the needle.
  return list.some(function (n) {
    return (0, _eq2.default)(n, needle);
  });
}
module.exports = exports['default'];
},{"./eq":39,"./error":40,"./isarray":60,"./isblank":61}],127:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = sort;

var _isref = require('./isref');

var _isref2 = _interopRequireDefault(_isref);

var _isarray = require('./isarray');

var _isarray2 = _interopRequireDefault(_isarray);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
  for (var _len = arguments.length, criteria = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    criteria[_key - 1] = arguments[_key];
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

  if ((0, _isref2.default)(ref) || (0, _isarray2.default)(ref)) {
    return ref.sort(makeComparer());
  }

  return _error2.default.na;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40,"./isarray":60,"./isref":76}],128:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = split;
// Copyright 2015 WebsiteHQ LLC

// SPLIT `text` given a `delimiter`.
function split(text, delimiter) {
  return text.split(delimiter);
}
module.exports = exports["default"];
},{}],129:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = substitute;
// Copyright 2015 WebsiteHQ LLC

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
module.exports = exports['default'];
},{}],130:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = substituteAll;

var _substitute = require('./substitute');

var _substitute2 = _interopRequireDefault(_substitute);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// substituteAll is a lightweight "substitution tags" engine that implement a global substitute for multiple items.
//
// The key values in your locals object are replaced. Unlike other templating systems it doesn't specify characters that surround your tokens.
//
// The function does not encode HTML entities. Don't use this to generate HTML. There are plently of alternative like underscore.js that do that already.
//
// It is equivalent to:
// ```js
// locals = { '-first-': 'Joe', '-last-': 'Smith' }
// substitute( substitute("-first- -last", '-first-',  locals), '-last-', 'Smith', locals)
// ```
function substituteAll(content, locals) {
  var start = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '-';
  var end = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : start;

  if (!locals) return content;
  return Object.keys(locals).reduce(function (p, v) {
    return (0, _substitute2.default)(p, '' + start + v + end, locals[v]);
  }, content);
} // Copyright 2015 WebsiteHQ LLC
module.exports = exports['default'];
},{"./substitute":129}],131:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = subtract;

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// SUBTRACT calculates the difference of two numbers.
// Copyright 2015 WebsiteHQ LLC

function subtract() {
  for (var _len = arguments.length, values = Array(_len), _key = 0; _key < _len; _key++) {
    values[_key] = arguments[_key];
  }

  // Return `#NA!` if 2 arguments are not provided.
  if (values.length !== 2) {
    return _error2.default.na;
  }

  // decompose values into a and b.
  var a = values[0],
      b = values[1];

  // Return `#VALUE!` if either a or b is not a number.

  if (!(0, _isnumber2.default)(a) || !(0, _isnumber2.default)(b)) {
    return _error2.default.value;
  }

  // Return the difference.
  return a - b;
}
module.exports = exports['default'];
},{"./error":40,"./isnumber":73}],132:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = sum;

var _flatten = require('./flatten');

var _flatten2 = _interopRequireDefault(_flatten);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// SUM a given list of `numbers`
// Copyright 2015 WebsiteHQ LLC

function sum() {
  for (var _len = arguments.length, numbers = Array(_len), _key = 0; _key < _len; _key++) {
    numbers[_key] = arguments[_key];
  }

  return (0, _flatten2.default)((0, _flatten2.default)(numbers)).reduce(function (a, b) {
    if (typeof b !== 'number') {
      return _error2.default.value;
    }
    return a + b;
  });
}
module.exports = exports['default'];
},{"./error":40,"./flatten":44}],133:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = surroundKeys;
// Creates a new object where all of the keys are surrounded by
// start and end delimiters.
function surroundKeys(obj) {
  var start = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '-';
  var end = arguments[2];

  end = end || start;
  return Object.keys(obj).reduce(function (p, v) {
    p['' + start + v + end] = obj[v];
    return p;
  }, {});
}
module.exports = exports['default'];
},{}],134:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = tan;

var _isnumber = require('./isnumber');

var _isnumber2 = _interopRequireDefault(_isnumber);

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// TAN computes the tagent of a value.
// Copyright 2015 WebsiteHQ LLC

function tan(value) {

  if (!(0, _isnumber2.default)(value)) {
    return _error2.default.value;
  }

  return Math.tan(value);
}
module.exports = exports['default'];
},{"./error":40,"./isnumber":73}],135:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = tau;

var _constants = require('./constants');

// TAU returns the universal circle constant
function tau() {
  return _constants.τ;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./constants":25}],136:[function(require,module,exports){
// Copyright 2015 WebsiteHQ LLC
// based heavily on code from socialcalc
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = text;

var _constants = require('./constants');

var _parsedate = require('./parsedate');

var _parsedate2 = _interopRequireDefault(_parsedate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

  currency_char = currency_char || _constants.DefaultCurrency;

  FormatNumber.parse_format_string(scfn.format_definitions, format_string); // make sure format is parsed
  format = scfn.format_definitions[format_string]; // Get format structure

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
    // bad date
    if (rawvalue < 0) {
      return '??-???-?? ??:??:??';
    }
    startval = (rawvalue - Math.floor(rawvalue)) * _constants.SecondsInDay; // get date/time parts
    estartval = rawvalue * _constants.SecondsInDay; // do elapsed time version, too
    hrs = Math.floor(startval / _constants.SecondsInHour);
    ehrs = Math.floor(estartval / _constants.SecondsInHour);
    startval = startval - hrs * _constants.SecondsInHour;
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

    ymd = (0, _parsedate2.default)(rawvalue);
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
            if (hrs > 12) hrs -= 12;
            ampmstr = operandstr.toLowerCase() == 'a/p' ? _constants.PM1 : _constants.PM; // "P" : "PM";
          } else {
            if (hrs === 0) hrs = 12;
            ampmstr = operandstr.toLowerCase() == 'a/p' ? _constants.AM1 : _constants.AM; // "A" : "AM";
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
  separatorchar = _constants.SeparatorChar;
  if (separatorchar.indexOf(' ') >= 0) separatorchar = separatorchar.replace(/ /g, ' ');
  decimalchar = _constants.DecimalChar;
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
        result += _constants.DayNames3[cval];
      } else if (operandstrlc == 'dddd') {
        cval = Math.floor(rawvalue + 6) % 7;
        result += _constants.DayNames[cval];
      } else if (operandstrlc == 'm') {
        result += ymd.month + '';
      } else if (operandstrlc == 'mm') {
        cval = 1000 + ymd.month;
        result += (cval + '').substr(2);
      } else if (operandstrlc == 'mmm') {
        result += _constants.MonthNames3[ymd.month - 1];
      } else if (operandstrlc == 'mmmm') {
        result += _constants.MonthNames[ymd.month - 1];
      } else if (operandstrlc == 'mmmmm') {
        result += _constants.MonthNames[ymd.month - 1].charAt(0);
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
      bracketdata.operand = parts[1] || _constants.DefaultCurrency || '$';
    } else {
      bracketdata.operand = bracketstr.substring(1) || _constants.DefaultCurrency || '$';
    }
  } else if (bracketstr == '?$') {
    bracketdata.operator = scfn.commands.currency;
    bracketdata.operand = '[?$]';
  } else if (_constants.AllowedColors[bracketstr.toUpperCase()]) {
    bracketdata.operator = scfn.commands.color;
    bracketdata.operand = _constants.AllowedColors[bracketstr.toUpperCase()];
  } else if (parts = bracketstr.match(/^style=([^']*)$/)) {
    // [style=...]
    bracketdata.operator = scfn.commands.style;
    bracketdata.operand = parts[1];
  } else if (bracketstr == ',') {
    bracketdata.operator = scfn.commands.separator;
    bracketdata.operand = bracketstr;
  } else if (_constants.AllowedDates[bracketstr.toUpperCase()]) {
    bracketdata.operator = scfn.commands.date;
    bracketdata.operand = _constants.AllowedDates[bracketstr.toUpperCase()];
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
module.exports = exports['default'];
},{"./constants":25,"./parsedate":106}],137:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = time;

var _constants = require('./constants');

function time(hour, minute, second) {
  return +((hour * 3600 + minute * 60 + second) / _constants.SecondsInDay).toFixed(15);
}
module.exports = exports['default'];
},{"./constants":25}],138:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = timevalue;

var _constants = require("./constants");

function timevalue(time_text) {
    // The JavaScript new Date() does not accept only time.
    // To workaround the issue we put 1/1/1900 at the front.

    var date = new Date("1/1/1900 " + time_text);

    if (date instanceof Error) {
        return date;
    }

    return (_constants.SecondsInHour * date.getHours() + _constants.SecondsInMinute * date.getMinutes() + date.getSeconds()) / _constants.SecondsInDay;
};
module.exports = exports["default"];
},{"./constants":25}],139:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = today;

var _datevalue = require('./datevalue');

var _datevalue2 = _interopRequireDefault(_datevalue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function today() {
  var d = new Date();
  return (0, _datevalue2.default)(d.toLocaleDateString());
};
module.exports = exports['default'];
},{"./datevalue":29}],140:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = trim;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// TRIMS returns a string without whitespace at the beginning or end.
function trim(text) {
    if (typeof text !== 'string') {
        return _error2.default.value;
    }
    return text.trim();
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40}],141:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = trunc;
// remove decimal part of number
function trunc(val) {
  return val | 0;
}
module.exports = exports["default"];
},{}],142:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = unique;
// Copyright 2015 WebsiteHQ LLC

// UNIQUE reduces an `array` into an array without duplicate values.
function unique(array) {
  return array.reduce(function (p, c) {
    if (p.indexOf(c) < 0) p.push(c);
    return p;
  }, []);
}
module.exports = exports["default"];
},{}],143:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = upper;
// Copyright 2015 WebsiteHQ LLC

// UPPER converts a string to upper case
function upper(string) {
  return string.toUpperCase();
}
module.exports = exports["default"];
},{}],144:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = vlookup;

var _error = require('./error');

var _error2 = _interopRequireDefault(_error);

var _isblank = require('./isblank');

var _isblank2 = _interopRequireDefault(_isblank);

var _iserror = require('./iserror');

var _iserror2 = _interopRequireDefault(_iserror);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// VLOOKUP find a needle in a table searching vertically.
function vlookup(needle) {
    var table = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    var index = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
    var exactmatch = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;


    if ((0, _iserror2.default)(needle) || (0, _isblank2.default)(needle)) {
        return needle;
    }

    for (var i = 0; i < table.length; i++) {
        var row = table[i];

        if (index > row.length) {
            return _error2.default.ref;
        }

        if (exactmatch && row[0] === needle || row[0] == needle || typeof row[0] === "string" && row[0].toLowerCase().indexOf(needle.toLowerCase()) != -1) {
            return index < row.length + 1 ? row[index - 1] : row[0];
        }
    }

    return _error2.default.na;
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./error":40,"./isblank":61,"./iserror":67}],145:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = xor;

var _flatten = require('./flatten');

var _flatten2 = _interopRequireDefault(_flatten);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// XOR computes the exclusive or for a given set of `values`.
function xor() {
  for (var _len = arguments.length, values = Array(_len), _key = 0; _key < _len; _key++) {
    values[_key] = arguments[_key];
  }

  return !!((0, _flatten2.default)(values).reduce(function (a, b) {
    if (b) {
      return a + 1;
    }
    return a;
  }, 0) & 1);
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./flatten":44}],146:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = year;

var _parsedate = require('./parsedate');

var _parsedate2 = _interopRequireDefault(_parsedate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// YEAR parses a date value and returns the year of the year.
function year(d) {
  return (0, _parsedate2.default)(d).getFullYear();
} // Copyright 2015 WebsiteHQ LLC

module.exports = exports['default'];
},{"./parsedate":106}],147:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = yearfrac;

var _parsedate = require('./parsedate');

var _parsedate2 = _interopRequireDefault(_parsedate);

var _isleapyear = require('./isleapyear');

var _isleapyear2 = _interopRequireDefault(_isleapyear);

var _serial = require('./serial');

var _serial2 = _interopRequireDefault(_serial);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function yearfrac(start_date, end_date, basis) {
  start_date = (0, _parsedate2.default)(start_date);
  if (start_date instanceof Error) {
    return start_date;
  }
  end_date = (0, _parsedate2.default)(end_date);
  if (end_date instanceof Error) {
    return end_date;
  }

  basis = basis || 0;
  var sd = start_date.getDate();
  var sm = start_date.getMonth() + 1;
  var sy = start_date.getFullYear();
  var ed = end_date.getDate();
  var em = end_date.getMonth() + 1;
  var ey = end_date.getFullYear();

  function isLeapYear(year) {
    return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
  }
  function daysBetween(a, b) {
    return (0, _serial2.default)(b) - (0, _serial2.default)(a);
  }

  switch (basis) {
    case 0:
      // US (NASD) 30/360
      if (sd === 31 && ed === 31) {
        sd = 30;
        ed = 30;
      } else if (sd === 31) {
        sd = 30;
      } else if (sd === 30 && ed === 31) {
        ed = 30;
      }
      return (ed + em * 30 + ey * 360 - (sd + sm * 30 + sy * 360)) / 360;
    case 1:
      // Actual/actual
      var feb29Between = function feb29Between(date1, date2) {
        var year1 = date1.getFullYear();
        var mar1year1 = new Date(year1, 2, 1);
        if (isLeapYear(year1) && date1 < mar1year1 && date2 >= mar1year1) {
          return true;
        }
        var year2 = date2.getFullYear();
        var mar1year2 = new Date(year2, 2, 1);
        return isLeapYear(year2) && date2 >= mar1year2 && date1 < mar1year2;
      };
      var ylength = 365;
      if (sy === ey || sy + 1 === ey && (sm > em || sm === em && sd >= ed)) {
        if (sy === ey && isLeapYear(sy) || feb29Between(start_date, end_date) || em === 1 && ed === 29) {
          ylength = 366;
        }
        return daysBetween(start_date, end_date) / ylength;
      }
      var years = ey - sy + 1;
      var days = (new Date(ey + 1, 0, 1) - new Date(sy, 0, 1)) / 1000 / 60 / 60 / 24;
      var average = days / years;
      return daysBetween(start_date, end_date) / average;
    case 2:
      // Actual/360
      return daysBetween(start_date, end_date) / 360;
    case 3:
      // Actual/365
      return daysBetween(start_date, end_date) / 365;
    case 4:
      // European 30/360
      return (ed + em * 30 + ey * 360 - (sd + sm * 30 + sy * 360)) / 360;
  }
};
module.exports = exports['default'];
},{"./isleapyear":71,"./parsedate":106,"./serial":124}],148:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],149:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],150:[function(require,module,exports){
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
},{"_process":151}],151:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
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
    var timeout = runTimeout(cleanUpNextTick);
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
    runClearTimeout(timeout);
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
        runTimeout(drainQueue);
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
