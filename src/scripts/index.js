
import LRPARSER from './LRPARSER';

document.addEventListener('DOMContentLoaded', () => {

  const lr1ParserVis = new LRPARSER(document);

  const grammarText = document.getElementById('grammar-text');
  const inputText = document.getElementById('input-text');
  const containers = {
    grammar: document.getElementById('grammar-container'),
    collection: document.getElementById('collection-container'),
    parseTable: document.getElementById('parse-table-container'),
    parseSteps: document.getElementById('parse-steps-container'),
  };

  const emptyContainers = () => {
    Object.keys(containers).forEach(key => {
      containers[key].innerHTML = '';
    });
  };

  const createParser = () => {
    emptyContainers();
    lr1ParserVis.createParser(grammarText.value);
    lr1ParserVis.renderGrammar(containers.grammar);
    lr1ParserVis.renderCollection(containers.collection);
    lr1ParserVis.renderParseTable(containers.parseTable);
  };

  const parse = () => {
    lr1ParserVis.parse(inputText.value);
    lr1ParserVis.renderParseSteps(containers.parseSteps);
  };

  const showExample = () => {
    grammarText.value = lr1ParserVis.sampleGrammar();
    createParser();
    inputText.value = lr1ParserVis.sampleInput();
    parse();
  };
  const showExample1 = () => {
    grammarText.value = lr1ParserVis.sampleGrammar1();
    createParser();
    inputText.value = lr1ParserVis.sampleInput1();
    parse();
  };
  const clear = () => {
    grammarText.value = '';
    inputText.value = '';
    emptyContainers();
    lr1ParserVis.clear();
  };

  document.getElementById('create-parser').addEventListener('click', createParser);
  document.getElementById('parse').addEventListener('click', parse);
  document.getElementById('show-example').addEventListener('click', showExample);
  document.getElementById('show-example1').addEventListener('click', showExample1);

});
