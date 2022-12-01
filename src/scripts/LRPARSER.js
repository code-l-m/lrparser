export default function (document) {

  const _startSymbol = 0;
  let _symbol;
  let _sTerminalOffset;
  let _endMarker;
  let _rules;
  let _collection;
  let _parseTable;
  let _parseTableHasConflict;
  let _parseSteps;


  const top = stack => (
    stack[stack.length - 1]
  );

  const itemsEqual = (i1, i2) => (
    i1.rule === i2.rule && i1.position === i2.position && i1.lookahead === i2.lookahead
  );

  const setsEqual = (s1, s2) => {
    if (s1.length !== s2.length) {
      return false;
    }
    let v = [];
    for (let state = 0; state < s1.length; ++state) {
      for (let j = 0; j < s1.length; ++j) {
        if (!v.includes(j) && itemsEqual(s1[state], s2[j])) {
          v.push(j);
        }
      }
    }
    return v.length === s1.length;
  };

  const actionsEqual = (a1, a2) => {
    if (a1.type !== a2.type) {
      return false;
    }
    switch (a1.type) {
      case 'accept':
        return true;
      case 'shift':
        return a1.state === a2.state;
      case 'reduce':
        return a1.rule === a2.rule;
      case 'conflict':
        return false;
    }
  };

  const isNonTerminal = symbol => (
    symbol < _sTerminalOffset && symbol > 0
  );

  const isTerminal = symbol => (
    symbol >= _sTerminalOffset && symbol < _symbol.length - 1
  );

  const isTerminalOrEndMarker = symbol => (
    symbol >= _sTerminalOffset && symbol < _symbol.length
  );

  const first = symbol => {
    if (isTerminalOrEndMarker(symbol)) {
      return [symbol];
    }
    let f = [];
    for (let i = 0; i < _rules.length; ++i) {
      if (_rules[i].lhs === symbol && _rules[i].rhs[0] !== symbol) {
        let fn = first(_rules[i].rhs[0]);
        for (let j = 0; j < fn.length; ++j) {
          f.push(fn[j]);
        }
      }
    }
    return f;
  };

  const closure = set => {
    let closureSet = set.slice(0);
    let newItemAdded = true;
    while (newItemAdded) {
      newItemAdded = false;
      for (let i = 0; i < closureSet.length; ++i) {
        let symbol = closureSet[i].rule.rhs[closureSet[i].position];
        for (let j = 0; j < _rules.length; ++j) {
          if (_rules[j].lhs === symbol) {
            let f = first(
              closureSet[i].position + 1 < closureSet[i].rule.rhs.length ?
                closureSet[i].rule.rhs[closureSet[i].position + 1] :
                closureSet[i].lookahead);
            for (let k = 0; k < f.length; ++k) {
              let item = {
                rule: _rules[j],
                position: 0,
                lookahead: f[k]
              };
              let newItem = true;
              for (let m = 0; m < closureSet.length; ++m) {
                if (itemsEqual(closureSet[m], item)) {
                  newItem = false;
                  break;
                }
              }
              if (newItem) {
                closureSet.push(item);
                newItemAdded = true;
              }
            }
          }
        }
      }
    }
    return closureSet;
  };

  const goTo = (set, symbol) => {
    let gotoSet = [];
    for (let i = 0; i < set.length; ++i) {
      if (set[i].rule.rhs[set[i].position] === symbol) {
        gotoSet.push({
          rule: set[i].rule,
          position: set[i].position + 1,
          lookahead: set[i].lookahead
        });
      }
    }
    return closure(gotoSet);
  };

  const scan = input => {
    let s = input.trim().split(/\s+/);
    let r = [];
    for (let i = 0; i < s.length; ++i) {
      let t = _symbol.indexOf(s[i]);
      if (!isTerminal(t)) {
        return false;
      }
      r.push(t);
    }
    r.push(_endMarker);
    return r;
  };

  const createCollection = () => {
    _collection = [
      closure([{
        rule: _rules[0],
        position: 0,
        lookahead: _endMarker
      }])
    ];
    let newSetAdded = true;
    while (newSetAdded) {
      newSetAdded = false;
      for (let i = 0; i < _collection.length; ++i) {
        for (let symbol = 1; symbol < _symbol.length - 1; ++symbol) {
          let set = goTo(_collection[i], symbol);
          if (set.length !== 0) {
            let newSet = true;
            for (let j = 0; j < _collection.length; ++j) {
              if (setsEqual(_collection[j], set)) {
                newSet = false;
                break;
              }
            }
            if (newSet) {
              _collection.push(set);
              newSetAdded = true;
            }
          }
        }
      }
    }
  };

  const addActionToParseTable = (state, symbol, action) => {
    if (_parseTable[state][symbol] === undefined) {
      _parseTable[state][symbol] = action;
    } else if (_parseTable[state][symbol].type === 'conflict') {
      let newAction = true;
      for (let i = 0; i < _parseTable[state][symbol].actions.length; ++i) {
        if (actionsEqual(_parseTable[state][symbol].actions[i], action)) {
          newAction = false;
          break;
        }
      }
      if (newAction) {
        _parseTable[state][symbol].actions.push(action);
      }
    } else if (!actionsEqual(_parseTable[state][symbol], action)) {
      _parseTable[state][symbol] = {
        type: 'conflict',
        actions: [_parseTable[state][symbol], action]
      };
      _parseTableHasConflict = true;
    }
  };

  const createParseTable = () => {
    _parseTable = new Array(_collection.length);
    _parseTableHasConflict = false;
    for (let i = 0; i < _collection.length; ++i) {
      _parseTable[i] = new Array(_symbol.length);
      for (let j = 0; j < _collection[i].length; ++j) {
        let symbol = _collection[i][j].rule.rhs[_collection[i][j].position];
        if (isTerminal(symbol)) {
          let gotoSet = goTo(_collection[i], symbol);
          for (let k = 0; k < _collection.length; ++k) {
            if (setsEqual(_collection[k], gotoSet)) {
              addActionToParseTable(i, symbol, {
                type: 'shift',
                state: k
              });
            }
          }
        }
        if (_collection[i][j].position === _collection[i][j].rule.rhs.length) {
          if (_collection[i][j].rule.lhs !== _startSymbol) {
            addActionToParseTable(i, _collection[i][j].lookahead, {
              type: 'reduce',
              rule: _collection[i][j].rule
            });
          } else if (_collection[i][j].lookahead === _endMarker) {
            _parseTable[i][_endMarker] = { type: 'accept' };
          }
        }
      }
      for (let symbol = 1; symbol < _sTerminalOffset; ++symbol) {
        let gotoSet = goTo(_collection[i], symbol);
        for (let k = 0; k < _collection.length; ++k) {
          if (setsEqual(_collection[k], gotoSet)) {
            _parseTable[i][symbol] = k;
          }
        }
      }
    }
  };

  // Public API for parsing

  this.createParser = grammarStr => {
    _symbol = [];
    let lines = grammarStr.trim().split(/[\r\n]+/);
    let rulesSymbols = [];
    for (let i = 0; i < lines.length; ++i) {
      rulesSymbols[i] = lines[i].trim().split(/\s+/);
      if (!_symbol.includes(rulesSymbols[i][0])) {
        _symbol.push(rulesSymbols[i][0]);
      }
    }
    _sTerminalOffset = _symbol.length;
    for (let i = 0; i < rulesSymbols.length; ++i) {
      for (let j = 0; j < rulesSymbols[i].length; ++j) {
        if (!_symbol.includes(rulesSymbols[i][j])) {
          _symbol.push(rulesSymbols[i][j]);
        }
      }
    }
    _endMarker = _symbol.length;
    _symbol.push('$');
    _rules = [];
    for (let i = 0; i < rulesSymbols.length; ++i) {
      _rules[i] = {
        index: i,
        rhs: []
      };
      for (let j = 0; j < rulesSymbols[i].length; ++j) {
        if (j === 0) {
          _rules[i].lhs = _symbol.indexOf(rulesSymbols[i][j]);
        } else {
          _rules[i].rhs.push(_symbol.indexOf(rulesSymbols[i][j]));
        }
      }
    }
    createCollection();
    createParseTable();
  };

  this.parse = inputStr => {
    if (_parseTable === undefined) {
      return;
    }
    _parseSteps = [];
    if (_parseTableHasConflict) {
      _parseSteps.push({
        stateStack: [],
        symbolStack: [],
        input: [],
        action: {
          type: 'error',
          error: 'conflict in parse table'
        }
      });
      return;
    }
    let input = scan(inputStr);
    if (input === false) {
      _parseSteps.push({
        stateStack: [],
        symbolStack: [],
        input: [],
        action: {
          type: 'error',
          error: 'syntax error'
        }
      });
      return;
    }
    let stateStack = [0];
    let symbolStack = [];
    while (true) {
      let action = _parseTable[top(stateStack)][input[0]];
      if (action === undefined) {
        action = {
          type: 'error',
          error: 'parse error'
        };
      }

      _parseSteps.push({
        stateStack: stateStack.slice(0),
        symbolStack: symbolStack.slice(0),
        input: input.slice(0),
        action: action
      });
      switch (action.type) {
        case 'shift':
          symbolStack.push(input.shift());
          stateStack.push(action.state);
          break;
        case 'reduce':
          for (let i = 0; i < action.rule.rhs.length; ++i) {
            symbolStack.pop();
            stateStack.pop();
          }
          symbolStack.push(action.rule.lhs);
          stateStack.push(_parseTable[top(stateStack)][action.rule.lhs]);
          break;
        case 'accept':
        case 'error':
          return;
      }
    }
  };

  this.clear = () => {
    _symbol =
      _sTerminalOffset =
      _endMarker =
      _rules =
      _collection =
      _parseTable =
      _parseTableHasConflict =
      _parseSteps =
      undefined;
  };

  // Private functions for rendering

  const actionStr = action => {
    switch (action.type) {
      case 'accept':
        return 'acc';
      case 'shift':
        return 's' + action.state;
      case 'reduce':
        return 'r' + action.rule.index;
      case 'error':
        return 'error: ' + action.error;
      case 'conflict':
        let str = actionStr(action.actions[0]);
        for (let state = 1; state < action.actions.length; ++state) {
          str += ',' + actionStr(action.actions[state]);
        }
        return str;
    }
  };

  const symbolClass = symbol => {
    if (symbol === _startSymbol) {
      return 'start-symbol';
    }
    if (symbol === _endMarker) {
      return 'end-marker';
    }
    if (isNonTerminal(symbol)) {
      return 'non-terminal';
    }
    if (isTerminal(symbol)) {
      return 'terminal';
    }
  };

  const arrowNode = () => (
    document.createTextNode(' \u2192 ')
  );

  const bulletNode = () => (
    document.createTextNode('\u2022')
  );

  const element = (tag, content, classes, attrs) => {
    let node = document.createElement(tag);
    let contentItems;
    if (content === undefined) {
      contentItems = [];
    } else if (Array.isArray(content)) {
      contentItems = content;
    } else {
      contentItems = [content];
    }
    contentItems.forEach(contentItem => {
      if (typeof contentItem === 'object') {
        node.appendChild(contentItem);
      } else {
        node.appendChild(document.createTextNode(contentItem));
      }
    });
    if (classes !== undefined) {
      if (Array.isArray(classes)) {
        node.classList.add(...classes);
      } else {
        node.classList.add(classes);
      }
    }
    if (attrs !== undefined) {
      Object.keys(attrs).forEach(key => {
        node[key] = attrs[key];
      });
    }
    return node;
  };

  const symbolNode = (symbol, additionalClass) => {
    let classes = [symbolClass(symbol)];
    if (additionalClass !== undefined) {
      classes.push(additionalClass);
    }
    return element('b', _symbol[symbol], classes);
  };

  const symbolsNodes = symbols => (
    symbols.map(symbol => (
      symbolNode(symbol)
    ))
  );

  const ruleNodes = rule => [
    symbolNode(rule.lhs),
    arrowNode(),
    ...symbolsNodes(rule.rhs)
  ];

  const itemNodes = item => {
    let nodes = [
      symbolNode(item.rule.lhs),
      arrowNode()
    ];
    item.rule.rhs.forEach((rhsSymbol, i) => {
      if (item.position === i) {
        nodes.push(bulletNode());
      }
      nodes.push(symbolNode(rhsSymbol));
    });
    if (item.position === item.rule.rhs.length) {
      nodes.push(bulletNode());
    }
    nodes.push(document.createTextNode(','));
    nodes.push(symbolNode(item.lookahead, 'lookahead'));
    return nodes;
  };


  // Public API for rendering

  this.renderGrammar = container => {
    container.innerHTML = '';
    if (_symbol === undefined) {
      return;
    }
    let preNode = document.createElement('pre');
    _rules.forEach((rule, i) => {
      preNode.appendChild(element('i', i + ' '));
      ruleNodes(rule).forEach(ruleNode => {
        preNode.appendChild(ruleNode);
      });
      if (i !== _rules.length - 1) {
        preNode.appendChild(document.createElement('br'));
      }
    });
    container.appendChild(preNode);
  };

  this.renderCollection = container => {
    container.innerHTML = '';
    if (_collection === undefined) {
      return;
    }
    let preNode = document.createElement('pre');
    _collection.forEach((set, setIndex) => {
      set.forEach((item, itemIndex) => {
        preNode.appendChild(element('i',
          itemIndex === 0 ?
            ['I', element('sub', setIndex), ' '] :
            undefined
        ));
        itemNodes(item).forEach(itemNode => {
          preNode.appendChild(itemNode);
        });
        if (itemIndex !== set.length - 1) {
          preNode.appendChild(document.createElement('br'));
        }
      });
      if (setIndex !== _collection.length - 1) {
        preNode.appendChild(document.createElement('br'));
        preNode.appendChild(document.createElement('br'));
      }
    });
    container.appendChild(preNode);
  };

  this.renderParseTable = container => {
    container.innerHTML = '';
    if (_parseTable === undefined) {
      return;
    }
    let tableNode = document.createElement('table');
    let theadNode = document.createElement('thead');
    tableNode.appendChild(theadNode);
    let theadTr1Node = document.createElement('tr');
    theadNode.appendChild(theadTr1Node);
    let theadTr2Node = document.createElement('tr');
    theadNode.appendChild(theadTr2Node);
    let tbodyNode = document.createElement('tbody');
    tableNode.appendChild(tbodyNode);
    theadTr1Node.appendChild(element('th', 'state', undefined, { rowSpan: 2 }));
    theadTr1Node.appendChild(element('th', 'action', undefined, { colSpan: _symbol.length - _sTerminalOffset }));
    theadTr1Node.appendChild(element('th', 'goto', undefined, { colSpan: _sTerminalOffset - 1 }));
    for (let s = _sTerminalOffset; s < _symbol.length; ++s) {
      let classes = ['action'];
      if (s === _endMarker) {
        classes.push('end-marker');
      }
      theadTr2Node.appendChild(element('th', _symbol[s], classes));
    }
    for (let s = 1; s < _sTerminalOffset; ++s) {
      theadTr2Node.appendChild(element('th', _symbol[s], 'goto'));
    }
    for (let i = 0; i < _parseTable.length; ++i) {
      let trNode = document.createElement('tr');
      tbodyNode.appendChild(trNode);
      trNode.appendChild(element('td', i));
      for (let s = _sTerminalOffset; s < _symbol.length; ++s) {
        if (_parseTable[i][s] === undefined) {
          trNode.appendChild(element('td', undefined, 'error'));
        } else {
          trNode.appendChild(element('td', actionStr(_parseTable[i][s]), _parseTable[i][s].type));
        }
      }
      for (let s = 1; s < _sTerminalOffset; ++s) {
        trNode.appendChild(element('td', _parseTable[i][s]));
      }
    }
    container.appendChild(tableNode);
  };

  this.renderParseSteps = container => {
    container.innerHTML = '';
    if (_parseSteps === undefined) {
      return;
    }
    let tableNode = document.createElement('table');
    let theadNode = document.createElement('thead');
    tableNode.appendChild(theadNode);
    let theadTrNode = document.createElement('tr');
    theadNode.appendChild(theadTrNode);
    let tbodyNode = document.createElement('tbody');
    tableNode.appendChild(tbodyNode);
    theadTrNode.appendChild(element('th', 'state stack'));
    theadTrNode.appendChild(element('th', 'symbol stack'));
    theadTrNode.appendChild(element('th', 'input'));
    theadTrNode.appendChild(element('th', 'action'));
    theadTrNode.appendChild(element('th', 'output'));
    _parseSteps.forEach(step => {
      let trNode = document.createElement('tr');
      tbodyNode.appendChild(trNode);
      trNode.appendChild(element('td', document.createTextNode(step.stateStack.join(' '))));
      trNode.appendChild(element('td', symbolsNodes(step.symbolStack)));
      trNode.appendChild(element('td', symbolsNodes(step.input)));
      trNode.appendChild(element('td', actionStr(step.action), step.action.type));
      trNode.appendChild(element('td',
        step.action.type === 'reduce' ?
          ruleNodes(step.action.rule) :
          undefined
      ));
    });
    container.appendChild(tableNode);
  };

  this.sampleGrammar = () => (
    "E' E\n" +
    'E E + T\n' +
    'E T\n' +
    'T T * F\n' +
    'T F\n' +
    'F ( E )\n' +
    'F id'
  );

  this.sampleInput = () => (
    'id + id * id'
  );
  this.sampleGrammar1 = () => (
    "E' E\n" +
    'E E + T\n' +
    'E T\n' +
    'T id'
    
  );

  this.sampleInput1 = () => (
    'id + id + id'
  );
  

};
