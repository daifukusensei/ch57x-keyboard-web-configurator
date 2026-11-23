const autoConfirm=require('./lib/autoconfirm.cjs');
const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-keyboard-web-configurator.html'),'utf8');
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){
  w.alert=()=>{}; w.addEventListener('error',e=>errors.push(e.message));
}});
const w=dom.window,d=w.document; const c=autoConfirm(w);
const click=el=>(typeof el==='string'?d.querySelector(el):el).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const key=k=>d.querySelector('#pane-basic [data-key="'+k+'"]');
let mod=m=>d.querySelector('#kbBoard [data-mod="'+m+'"]');   // Basic tab: the keyboard's own modifier keys
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
  const names=[...d.querySelectorAll('#pane-basic [data-key]:not(#kbNumpad *), #pane-media [data-key]')].map(b=>b.dataset.key);
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
  ok('summary reflects the action',!/No problems/.test(d.getElementById('summary').textContent));
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
  click('#ptab-mouse'); mod=m=>d.querySelector('#modChips [data-mod="'+m+'"]');
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
  ok('blank has exactly 3 layers, layer 1 active',tabs().length===3&&tabs()[0].classList.contains('active'));
  ok('no add / duplicate / remove layer tools',!d.querySelector('#tabs .layertools, #tabs [aria-label="Add layer"], #tabs [aria-label="Remove layer"], #tabs [aria-label="Duplicate layer"]'));
  click(tabs()[2]); ok('switching to layer 3',tabs()[2].classList.contains('active')&&/^Layer 3/.test(d.getElementById('editTitle').textContent));
  ok('YAML always lists 3 layers',(d.getElementById('yamlOut').value.match(/^  - buttons:/gm)||[]).length===3);
  d.getElementById('yamlIn').value=d.getElementById('yamlOut').value.replace(/^layers:\n/m,'layers:\n  - buttons:\n      - ["a"]\n')
    .replace(/^rows: \d+/m,'rows: 1').replace(/^columns: \d+/m,'columns: 1').replace(/^knobs: \d+/m,'knobs: 0');
  click('#btnImport');
  ok('import of 4 layers keeps the first 3 and says so: '+d.getElementById('toast').textContent,tabs().length===3&&/only the first 3 layers kept/.test(d.getElementById('toast').textContent));
  d.getElementById('yamlIn').value='orientation: normal\nrows: 1\ncolumns: 2\nknobs: 0\nlayers:\n  - buttons:\n      - ["a", "b"]\n';
  click('#btnImport'); ok('import of 1 layer pads to 3',tabs().length===3&&!/only the first/.test(d.getElementById('toast').textContent));
  click('#btnBlank'); await c.tick();

  // ---- knobs drawn as dials ----
  const k=d.getElementById('knobs'); k.value='4'; k.dispatchEvent(new w.Event('change',{bubbles:true}));
  ok('4 knobs -> 4 dials with ccw/press/cw each',d.querySelectorAll('.dial').length===4&&d.querySelectorAll('.dial .cell').length===12&&d.querySelectorAll('.dial .cell.round').length===4);
  click(d.querySelectorAll('.dial')[3].querySelector('.cell.round'));
  ok('selecting the 4th knob press shows its title: '+d.getElementById('editTitle').textContent,/Knob 4 — press/.test(d.getElementById('editTitle').textContent));
  click('#ptab-basic'); click(key('space')); ok('assign to a knob',act()==='space');

  // ---- drawers and help ----
  ok('YAML and help drawers start closed, no CLI-script drawer',!d.getElementById('cliDrawer')&&['yamlDrawer','help'].every(id=>!d.getElementById(id).open));
  { const a=d.getElementById('action'); a.value='notakey'; a.dispatchEvent(new w.Event('input',{bubbles:true})); }
  const jump=d.querySelector('#actionMsg a.helpjump');
  ok('unknown-key warning ends with a Help link: '+d.getElementById('actionMsg').textContent,
    /"notakey" is not a key name this editor recognises\. Check the spelling, pick the key from the keycode palette, or see Help$/.test(d.getElementById('actionMsg').textContent.trim())&&jump&&jump.getAttribute('href')==='#help-actions');
  click(jump); ok('the warning link opens Help',d.getElementById('help').open);
  d.getElementById('help').open=false;
  ok('labels-and-outlines explanation is a dropdown under the keypad, not in Help',d.querySelector('.legendrow details.legend summary').textContent==='What do the labels and outlines mean?'
    &&/Amber outline = warning/.test(d.querySelector('details.legend').textContent)&&!d.getElementById('help-keypad')&&!/Amber outline/.test(d.getElementById('help').textContent));
  { const by=[...d.querySelectorAll('a')].filter(a=>a.textContent==='daifuku');
    ok('both "daifuku" mentions link to the repo',by.length===2&&by.every(a=>a.href==='https://github.com/daifukusensei/ch57x-keyboard-web-configurator'&&a.target==='_blank')); }
  click('#helpLink'); ok('Help link opens the help drawer',d.getElementById('help').open);
  { const b=d.querySelector('#help .body'), leads=[...b.children].slice(0,2).map(e=>e.textContent.trim());
    ok('Help starts with the tagline, then "Build a layout" on its own line',leads[0]==='Visual editor for ch57x-keyboard-tool mapping files. By daifuku.'&&/^Build a layout/.test(leads[1]));
    ok('Help sections in order, each its own block',[...b.querySelectorAll('section.hsec')].map(x=>x.id+':'+x.querySelector('h3').textContent).join('|')
      ==='help-actions:Actions|help-comments:Comments on keys|help-webhid:Direct upload (WebHID)|help-cli:Without WebHID: the command-line tool'); }
  ok('YAML still generated while its drawer is closed',/knobs: 4/.test(d.getElementById('yamlOut').value));
  console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
})();
