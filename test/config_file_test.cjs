// Load config / Save config buttons: each asks first; Load opens the file picker, Save downloads the mapping
// under the loaded file's name with its line endings (the user's files are CRLF).
const autoConfirm=require('./lib/autoconfirm.cjs');
const {JSDOM}=require('jsdom'); const fs=require('fs'), path=require('path');
const html=fs.readFileSync(process.argv[2]||path.join(__dirname,'../ch57x-keyboard-web-configurator.html'),'utf8');
const userYaml=fs.readFileSync(path.join(__dirname,'fixtures/user-notes.yaml'),'utf8').replace(/\r?\n/g,'\r\n');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };
const errors=[], saved=[]; let picks=0;
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){
  w.addEventListener('error',e=>errors.push(e.message));
  const blobs={}; let n=0;
  w.URL.createObjectURL=b=>{ const u='blob:t'+(n++); blobs[u]=b; return u; }; w.URL.revokeObjectURL=()=>{};
  const click=w.HTMLElement.prototype.click;
  w.HTMLElement.prototype.click=function(){
    if(this.id==='fileIn'){ picks++; return; }
    if(this.tagName==='A'&&this.download){ saved.push({name:this.download,blob:blobs[this.href]}); return; }
    return click.call(this);
  };
}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id); const c=autoConfirm(w);
const click=id=>$(id).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const text=b=>new Promise(r=>{ const f=new w.FileReader(); f.onload=()=>r(String(f.result)); f.readAsText(b); });
(async()=>{
  await sleep(30);
  ok('no script errors '+errors.join(';'),errors.length===0);
  ok('Load config and Save config come before New blank; no repo-example button',(()=>{ const b=[...d.querySelectorAll('#settingsCard button')].map(x=>x.id);
    return b.indexOf('btnLoad')>=0&&b.indexOf('btnLoad')<b.indexOf('btnSave')&&b.indexOf('btnSave')<b.indexOf('btnBlank')&&!$('btnExample'); })());
  ok('file input hidden; YAML drawer has no download or file chooser',$('fileIn').hidden&&!$('btnDownload')&&!$('yamlDrawer').querySelector('input[type=file]'));
  ok('tagline',/^Visual editor for ch57x-keyboard-tool mapping files\. By daifuku\.$/.test($('tagline').textContent));

  c.answer=false; click('btnLoad'); await c.tick();
  ok('Load: asks first; Cancel opens no picker',/replaces the current mapping/.test(c.last)&&picks===0);
  c.answer=true; click('btnLoad'); await c.tick();
  ok('Load: OK opens the file picker',picks===1);
  const fi=$('fileIn'); Object.defineProperty(fi,'files',{value:[new w.File([userYaml],'daise_514C-8850.yaml')],configurable:true});
  fi.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(60);
  ok('file loaded: '+$('toast').textContent,/^Loaded daise_514C-8850\.yaml/.test($('toast').textContent));

  c.answer=false; click('btnSave'); await c.tick();
  ok('Save: asks first, naming the file; Cancel saves nothing',/"daise_514C-8850\.yaml"/.test(c.last)&&saved.length===0);
  c.answer=true; click('btnSave'); await c.tick();
  ok('Save: downloads under the loaded name',saved.length===1&&saved[0].name==='daise_514C-8850.yaml');
  const out=await text(saved[0].blob);
  ok('saved file keeps CRLF and matches the YAML view',/\r\n/.test(out)&&!/[^\r]\n/.test(out)&&out.replace(/\r\n/g,'\n')===$('yamlOut').value.replace(/\r\n/g,'\n'));
  ok('saved file keeps the #@ comments',/^#@ L1 R\d+ C\d+: /m.test(out));

  click('btnBlank'); await c.tick(); click('btnSave'); await c.tick();
  const out2=await text(saved[1].blob);
  ok('after New blank: default name and LF',saved[1].name==='mapping.yaml'&&!/\r/.test(out2));
  ok('no script errors '+errors.join(';'),errors.length===0);
  console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
})();
