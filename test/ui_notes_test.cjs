// Per-key comments in the UI, driven with the user's own (CRLF) file.
const {JSDOM}=require('jsdom'); const fs=require('fs'), path=require('path');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-config-editor.html'),'utf8');
const userYaml=fs.readFileSync(path.join(__dirname,'fixtures/user.yaml'),'utf8');   // CRLF, as attached
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };

function boot(seed){
  const errors=[];
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){
    w.confirm=()=>true; w.alert=()=>{}; w.addEventListener('error',e=>errors.push(e.message));
    if(seed) for(const [k,v] of Object.entries(seed)) w.localStorage.setItem(k,v);
  }});
  const w=dom.window,d=w.document;
  return {w,d,errors,
    click:el=>(typeof el==='string'?d.querySelector(el):el).dispatchEvent(new w.MouseEvent('click',{bubbles:true})),
    type:(id,v)=>{ const e=d.getElementById(id); e.value=v; e.dispatchEvent(new w.Event('input',{bubbles:true})); },
    cells:()=>[...d.querySelectorAll('#device .cell')],
    yaml:()=>d.getElementById('yamlOut').value,
    toast:()=>d.getElementById('toast').textContent};
}

(async()=>{
  const A=boot(); const {w,d}=A; await sleep(30);
  ok('no script errors '+A.errors.join(';'),A.errors.length===0);
  ok('comments view is off by default, no dots, note box empty',!d.getElementById('device').classList.contains('notes')&&!d.getElementById('showNotes').checked&&!A.cells().some(c=>c.classList.contains('hasnote'))&&d.getElementById('note').value==='');

  // ---- import the user's file by pasting ----
  d.getElementById('yamlIn').value=userYaml; A.click('#btnImport'); await sleep(10);
  ok('toast reports the comment count: '+A.toast(),/Imported YAML · 30 comments on keys/.test(A.toast()));
  ok('comments view switched on after importing a commented file',d.getElementById('device').classList.contains('notes')&&d.getElementById('showNotes').checked);
  let cells=A.cells();
  ok('layer 1: 12 keys + 4 knobs x 3 = 24 keycaps',cells.length===24);
  const noteOf=c=>c.querySelector('.note').textContent;
  ok('R1 C1 has no comment, R2 C1 shows "IntelliJ split"',noteOf(cells[0])===''&&!cells[0].classList.contains('hasnote')&&noteOf(cells[3])==='IntelliJ split'&&cells[3].classList.contains('hasnote'));
  ok('R3 C3 / R4 C2',noteOf(cells[8])==='vscode markdown view side-by-side'&&noteOf(cells[10])==='vscode zen');
  ok('action still shown on the key under the comment',cells[3].querySelector('.val').textContent==='shift-f4');
  ok('layer 1 has 15 keys with comments',cells.filter(c=>c.classList.contains('hasnote')).length===15);
  ok('knob 1 ccw / press / cw comments land on the right caps',
    noteOf(cells[12])==='decrease zoom (Edge browser & vscode))'&&noteOf(cells[13])==='default zoom (Edge browser & vscode)'&&noteOf(cells[14])==='increase zoom (Edge browser & vscode))');
  ok('knob 2 has no comments; knob 4 does',[15,16,17].every(i=>noteOf(cells[i])==='')&&noteOf(cells[21])==='volume down'&&noteOf(cells[22])==='mute'&&noteOf(cells[23])==='volume up');
  ok('keycap tooltip carries action and comment',/shift-f4/.test(cells[3].title)&&/IntelliJ split/.test(cells[3].title));
  ok('summary still has no problems (comments do not affect validation)',/No problems found/.test(d.getElementById('summary').textContent));

  // ---- selecting a key shows its comment in the box ----
  A.click(cells[4]);
  ok('selecting R2 C2 fills the Comment box',d.getElementById('note').value==='IntelliJ zen'&&d.getElementById('action').value==='ctrl-grave,4,2');
  A.click(A.cells()[12]); ok('selecting knob 1 ccw fills the box',d.getElementById('note').value==='decrease zoom (Edge browser & vscode))');

  // ---- editing comments ----
  A.click(A.cells()[4]);
  A.type('note','zen mode; fullscreen');
  ok('typing updates the keycap live',noteOf(A.cells()[4])==='zen mode; fullscreen'&&A.cells()[4].classList.contains('sel'));
  ok('focus-safe: the box keeps what was typed',d.getElementById('note').value==='zen mode; fullscreen');
  ok('YAML row comment: ";" inside a note is saved as ","',/\["shift-f4", "ctrl-grave,4,2", "alt-4"\]\s+# IntelliJ split; zen mode, fullscreen; IntelliJ hide tools/.test(A.yaml()));
  A.click(A.cells()[0]); A.type('note','launcher');
  ok('a comment on a key in a previously uncommented row',/\["f", "click", "shift-n"\]\s+# launcher\n/.test(A.yaml()));
  A.click(A.cells()[1]); A.type('note','mouse click');
  ok('second key of the row: first one stays empty',/\["f", "click", "shift-n"\]\s+# launcher; mouse click\n/.test(A.yaml()));
  A.click(A.cells()[2]); A.type('note','new');
  A.click(A.cells()[0]); A.type('note','');
  ok('clearing the first note keeps the others in position',/\["f", "click", "shift-n"\]\s+# ; mouse click; new\n/.test(A.yaml()));
  A.click(A.cells()[1]); A.type('note',''); A.click(A.cells()[2]); A.type('note','');
  ok('row with all notes cleared has no comment at all',/\["f", "click", "shift-n"\]\n/.test(A.yaml()));
  A.click(A.cells()[16]); A.type('note','play / pause');
  ok('knob comment on the press line',/press: "play"\s+# play \/ pause\n/.test(A.yaml()));
  ok('knob notes with ";" are kept as typed',(A.click(A.cells()[15]),A.type('note','back; rewind'),/ccw: "left"\s+# back; rewind\n/.test(A.yaml())));
  A.click(A.cells()[15]); A.type('note','');

  // Clear only clears the action
  A.click(A.cells()[3]); A.click('#btnClear');
  ok('Clear removes the action, not the comment',d.getElementById('action').value===''&&d.getElementById('note').value==='IntelliJ split'&&noteOf(A.cells()[3])==='IntelliJ split'&&A.cells()[3].querySelector('.val').textContent==='—');
  A.type('action','shift-f4');

  // ---- toggle ----
  A.click('#showNotes');
  ok('toggle off: plain keycaps, dot still marks commented keys',!d.getElementById('device').classList.contains('notes')&&A.cells()[3].classList.contains('hasnote'));
  ok('preference stored',w.localStorage.getItem('ch57x-editor-notes')==='0');
  A.click('#showNotes');
  ok('toggle on again',d.getElementById('device').classList.contains('notes')&&w.localStorage.getItem('ch57x-editor-notes')==='1');

  // ---- layers ----
  A.click('#tabs .tab:nth-of-type(2)');
  cells=A.cells();
  ok('layer 2 comments (row 4, knob 1)',noteOf(cells[9])==='vs 2022 split'&&noteOf(cells[12])==='decrease zoom (Edge browser & vscode)'&&noteOf(cells[3])==='');
  A.click('#tabs [aria-label="Duplicate layer"]');
  ok('duplicating a layer copies its comments',A.cells().length===24&&noteOf(A.cells()[10])==='vs 2022 full-screen');
  A.click(A.cells()[10]); A.type('note','changed on the copy'); A.click('#tabs .tab:nth-of-type(2)');
  ok('editing the copy leaves the original alone',noteOf(A.cells()[10])==='vs 2022 full-screen');
  A.click('#tabs [aria-label="Add layer"]');
  ok('a new layer starts without comments',A.cells().every(c=>noteOf(c)===''));
  A.click('#tabs [aria-label="Remove layer"]');

  // ---- round trip through the exported YAML ----
  A.click('#tabs .tab:nth-of-type(1)');
  const exported=A.yaml();
  const B=boot(); await sleep(30);
  B.d.getElementById('yamlIn').value=exported; B.click('#btnImport'); await sleep(10);
  ok('re-importing the exported YAML restores every comment: '+B.toast(),/· \d+ comments on keys/.test(B.toast())&&B.yaml()===exported);

  // ---- resize keeps comments on their keys ----
  const r=A.d.getElementById('rows'); r.value='5'; r.dispatchEvent(new w.Event('change',{bubbles:true}));
  ok('adding a row keeps comments, new keys are empty',A.cells().length===27&&noteOf(A.cells()[3])==='IntelliJ split'&&noteOf(A.cells()[12])==='');
  r.value='4'; r.dispatchEvent(new w.Event('change',{bubbles:true}));

  // ---- saved state and preference survive a reload ----
  const seed={}; for(const k of ['ch57x-editor-v1','ch57x-editor-notes']) seed[k]=w.localStorage.getItem(k);
  const C=boot(seed); await sleep(30);
  ok('reload: comments restored and view still on',C.cells()[3].querySelector('.note').textContent==='IntelliJ split'&&C.d.getElementById('showNotes').checked&&C.d.getElementById('device').classList.contains('notes')&&C.errors.length===0);

  // ---- file import path, and unchanged behaviour without comments ----
  const D=boot(); await sleep(30);
  const fi=D.d.getElementById('fileIn'); Object.defineProperty(fi,'files',{value:[new D.w.File([userYaml],'daise_514C-8850.yaml')]});
  fi.dispatchEvent(new D.w.Event('change',{bubbles:true})); await sleep(60);
  ok('file import: '+D.toast(),/Loaded daise_514C-8850\.yaml · 30 comments on keys/.test(D.toast())&&D.cells().length===24);
  D.click('#btnExample'); await sleep(10);
  ok('repo example has no comments: no dots, no count in the toast, view stays as the user left it',!D.cells().some(c=>c.classList.contains('hasnote'))&&D.toast()==='Loaded repo example'&&D.d.getElementById('showNotes').checked);
  D.click('#btnBlank');
  ok('new blank: comments gone',D.cells().every(c=>c.querySelector('.note').textContent===''));

  // ---- 1-line examples in the help ----
  ok('help and drawer mention comments',/Comments on keys/.test(d.getElementById('help').textContent)&&/Per-key comments are kept/.test(d.getElementById('yamlDrawer').textContent));
  ok('legend mentions the dot',/small dot/.test(d.querySelector('details.legend').textContent));
  ok('no script errors at the end',A.errors.length===0&&B.errors.length===0&&D.errors.length===0);
  console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
})();
