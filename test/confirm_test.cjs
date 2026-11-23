// The in-page confirmation dialog (askConfirm) that replaced window.confirm: discard prompts, and the dialog's
// own behaviour — Enter = OK, Esc = cancel, click on the faded backdrop = cancel, focus kept inside and restored.
const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-keyboard-web-configurator.html'),'utf8');
const errors=[], nativeAsked=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',beforeParse(w){
  w.confirm=m=>{nativeAsked.push(m);return true;}; w.alert=m=>nativeAsked.push(m); w.addEventListener('error',e=>errors.push(e.message)); }});
const w=dom.window,d=w.document,$=id=>d.getElementById(id);
const click=el=>(typeof el==='string'?$(el):el).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const down=el=>el.dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true}));
const key=(k,o={})=>d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},o)));
const tick=()=>new Promise(r=>setTimeout(r,0));
const open=()=>!$('confirmDlg').hidden;
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };
(async()=>{
  ok('no script errors '+errors.join(';'),errors.length===0);
  ok('dialog starts hidden, marked as a modal alert dialog',!open()&&$('confirmDlg').querySelector('[role="alertdialog"][aria-modal="true"]'));
  // make a change
  click(d.querySelector('.cell'));
  const inp=$('action'); inp.value='ctrl-z'; inp.dispatchEvent(new w.Event('input',{bubbles:true}));
  const before=$('yamlOut').value;

  $('btnLoad').focus(); click('btnLoad');
  ok('Load config opens the dialog (not window.confirm)',open()&&nativeAsked.length===0);
  ok('title, message and a red "Choose file" button',/Load a config file\?/.test($('confirmTitle').textContent)&&/replaces the current mapping/.test($('confirmMsg').textContent)
    &&$('confirmOk').textContent==='Choose file'&&$('confirmOk').classList.contains('danger'));
  ok('focus moves to OK',d.activeElement===$('confirmOk'));
  ok('page behind does not scroll',d.body.classList.contains('modal-open'));
  key('Tab'); ok('Tab moves to Cancel',d.activeElement===$('confirmCancel'));
  key('Tab'); ok('Tab wraps back to OK (focus stays in the dialog)',d.activeElement===$('confirmOk'));
  key('Tab',{shiftKey:true}); ok('Shift+Tab wraps to Cancel',d.activeElement===$('confirmCancel'));
  key('Escape'); await tick();
  ok('Esc cancels: closed, edits kept',!open()&&$('yamlOut').value===before&&/ctrl-z/.test(before));
  ok('focus returns to the button that opened it',d.activeElement===$('btnLoad')&&!d.body.classList.contains('modal-open'));

  click('btnLoad'); down($('confirmDlg')); click('confirmDlg'); await tick();
  ok('click on the faded backdrop cancels',!open()&&$('yamlOut').value===before);
  click('btnLoad'); down(d.querySelector('.modal-box')); click(d.querySelector('.modal-box')); await tick();
  ok('click inside the box does not close it',open());
  down($('confirmMsg')); click('confirmDlg'); await tick();
  ok('a drag from inside the box to the backdrop does not cancel',open());
  click('confirmCancel'); await tick(); ok('Cancel button cancels',!open()&&$('yamlOut').value===before);

  click('btnBlank'); ok('New blank asks too',open()&&$('confirmOk').textContent==='Start blank');
  $('confirmCancel').focus(); key('Enter'); await tick();
  ok('Enter on a focused Cancel cancels',!open()&&/ctrl-z/.test($('yamlOut').value));
  click('btnBlank'); key('Enter'); await tick();
  ok('Enter = OK: blank mapping',!open()&&!/ctrl-z/.test($('yamlOut').value)&&!/"a"/.test($('yamlOut').value));
  click('btnSave'); ok('Save config asks too',open()&&$('confirmOk').textContent==='Save'&&!$('confirmOk').classList.contains('danger'));
  click('confirmCancel'); await tick(); ok('Cancel closes it',!open());
  ok('window.confirm/alert never used',nativeAsked.length===0);
  console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
})();
