// core.js must stay free of DOM/browser globals: the suites run it with new Function() in plain Node.
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8')
  .replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'')            // comments
  .replace(/`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g,'""'); // strings
const banned=['document','window','localStorage','navigator','alert','confirm'];
const hits=banned.filter(w=>new RegExp('\\b'+w+'\\b').test(src));
console.log(hits.length?'FAIL core.js references: '+hits.join(', '):'ALL PASSED');
process.exit(hits.length?1:0);
