const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../../ch57x-config-editor.html'),'utf8');
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){
  w.confirm=()=>true; w.alert=()=>{}; w.addEventListener('error',e=>errors.push(e.message));
}});
const w=dom.window,d=w.document;
const click=el=>(typeof el==='string'?d.querySelector(el):el).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const key=k=>d.querySelector('#pane-basic [data-key="'+k+'"]');
const mod=m=>d.querySelector('#modChips [data-mod="'+m+'"]');
const act=()=>d.getElementById('action').value;
const cells=()=>d.querySelectorAll('.cell');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };
(async()=>{
  await sleep(30);
  ok('no script errors '+errors.join(';'),errors.length===0);
  // new blank so we start from known empty cells
  click('#btnBlank'); await sleep(10);
  ok('blank: R1C1 selected and empty',act()===''&&cells()[0].classList.contains('sel'));

  // ---- every keycap on the palette is a name the editor accepts without warnings ----
  const names=[...d.querySelectorAll('#pane-basic [data-key], #pane-media [data-key]')].map(b=>b.dataset.key);
  const val=w.eval('validateAction');
  const bad=names.filter(n=>val(n).level!=='ok');
  ok('all '+names.length+' palette keycodes validate cleanly'+(bad.length?' — bad: '+bad.join(','):''),names.length>100&&bad.length===0);
  ok('palette keycodes are unique',new Set(names).size===names.length);

  // ---- basic: replace, one-shot modifiers, sequence mode ----
  click(key('a')); ok('click A -> a',act()==='a');
  click(mod('ctrl')); ok('ctrl toggle shows pressed',mod('ctrl').getAttribute('aria-pressed')==='true');
  click(key('c')); ok('ctrl + C -> ctrl-c (replaces)',act()==='ctrl-c');
  ok('modifier is one-shot',mod('ctrl').getAttribute('aria-pressed')==='false');
  click(key('v')); ok('next click has no modifier -> v',act()==='v');
  click('#seqMode'); click(mod('ctrl')); click(mod('shift')); click(key('z'));
  ok('sequence mode appends a chord with modifiers',act()==='v,ctrl-shift-z');
  click(key('f13')); ok('F13 appended',act()==='v,ctrl-shift-z,f13');
  click('#seqMode');
  ok('summary reflects the action',/No problems|warning|error/.test(d.getElementById('summary').textContent));
  ok('cell legend shows the action',cells()[0].textContent.includes('v,ctrl-shift-z,f13'));

  // ---- selecting another key edits that key only ----
  click(cells()[1]); ok('second key selected, empty',act()===''&&cells()[1].classList.contains('sel'));
  click(key('enter')); ok('Enter -> enter',act()==='enter'&&cells()[0].textContent.includes('v,ctrl-shift-z,f13'));

  // ---- media ----
  click('#ptab-media');
  ok('media pane shown, basic hidden, modifier row hidden',!d.getElementById('pane-media').hidden&&d.getElementById('pane-basic').hidden&&d.getElementById('modRow').hidden);
  click(d.querySelector('#pane-media [data-key="volumeup"]')); ok('Vol + -> volumeup',act()==='volumeup');
  ok('media keys offered: '+d.querySelectorAll('#pane-media [data-key]').length,d.querySelectorAll('#pane-media [data-key]').length===15);

  // ---- mouse ----
  click('#ptab-mouse');
  ok('mouse pane shown with modifier row',!d.getElementById('pane-mouse').hidden&&!d.getElementById('modRow').hidden);
  click(d.querySelector('#mouseClicks [title="click(left)"]')); ok('Left click',act()==='click(left)');
  click(mod('ctrl')); click(d.querySelector('#mouseWheels [title="wheelup"]')); ok('ctrl + wheel up -> ctrl-wheelup',act()==='ctrl-wheelup');
  click(mod('win')); click(mod('shift')); click(d.querySelector('#mouseClicks [title="click(right)"]'));
  ok('win dropped for mouse, shift kept: '+act(),act()==='shift-click(right)');
  ok('toast tells which modifier was left out',/left out: win/.test(d.getElementById('toast').textContent));
  d.getElementById('mx').value='500'; d.getElementById('my').value='-300'; click('#msMove');
  ok('move is clamped to -127..127: '+act(),act()==='move(127,-127)');
  d.getElementById('mx').value='-5'; d.getElementById('my').value='12'; d.getElementById('mbtn').value='left+right'; click('#msDrag');
  ok('drag: '+act(),act()==='drag(left+right,-5,12)');
  d.getElementById('mn').value='-3'; click('#msWheel'); ok('scroll amount: '+act(),act()==='wheel(-3)');
  ok('mouse action is valid',val(act()).level==='ok');

  // ---- advanced ----
  click('#ptab-advanced');
  d.getElementById('bhid').value='101'; click('#hidCodeSet'); ok('raw HID code -> <101>',act()==='<101>');
  d.getElementById('bhid').value='300'; click('#hidCodeSet'); ok('out-of-range raw code rejected, action kept',act()==='<101>'&&/0 to 255/.test(d.getElementById('toast').textContent));
  d.getElementById('delay').value='50'; click('#btnDelay'); ok('delay applied from the Advanced tab',act()==='{delay(50)}<101>'&&d.getElementById('btnDelay').textContent==='Remove delay option');
  click('#btnDelay'); ok('delay removed again',act()==='<101>');

  // ---- layers ----
  const tabs=()=>d.querySelectorAll('#tabs .tab');
  ok('blank starts with one layer, which cannot be removed',tabs().length===1&&d.querySelector('#tabs [aria-label="Remove layer"]').disabled);
  click('#tabs [aria-label="Add layer"]'); ok('add layer selects the new one',tabs().length===2&&tabs()[1].classList.contains('active'));
  click('#tabs [aria-label="Duplicate layer"]'); ok('duplicate layer',tabs().length===3&&tabs()[2].classList.contains('active'));
  click('#tabs [aria-label="Remove layer"]'); click('#tabs [aria-label="Remove layer"]'); click('#tabs [aria-label="Remove layer"]');
  ok('remove layers down to one, last one cannot be removed',tabs().length===1&&d.querySelector('#tabs [aria-label="Remove layer"]').disabled);
  click('#tabs [aria-label="Add layer"]'); click('#tabs [aria-label="Add layer"]');

  // ---- knobs drawn as dials ----
  const k=d.getElementById('knobs'); k.value='4'; k.dispatchEvent(new w.Event('change',{bubbles:true}));
  ok('4 knobs -> 4 dials with ccw/press/cw each',d.querySelectorAll('.dial').length===4&&d.querySelectorAll('.dial .cell').length===12&&d.querySelectorAll('.dial .cell.round').length===4);
  click(d.querySelectorAll('.dial')[3].querySelector('.cell.round'));
  ok('selecting the 4th knob press shows its title: '+d.getElementById('editTitle').textContent,/Knob 4 — press/.test(d.getElementById('editTitle').textContent));
  click('#ptab-basic'); click(key('space')); ok('assign to a knob',act()==='space');

  // ---- drawers and help ----
  ok('YAML, CLI and help drawers start closed',['yamlDrawer','cliDrawer','help'].every(id=>!d.getElementById(id).open));
  click('#helpLink'); ok('Help link opens the help drawer',d.getElementById('help').open);
  ok('YAML still generated while its drawer is closed',/knobs: 4/.test(d.getElementById('yamlOut').value));
  console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
})();
