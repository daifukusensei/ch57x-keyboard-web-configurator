// The CLI-fallback upload.sh (for browsers without WebHID) runs end to end against a stub tool
// whose name contains a quote: it writes the exact YAML, validates, then uploads; a failed
// validate stops before upload. upload.ps1 is only checked for content (no PowerShell here).
const fs=require('fs'), path=require('path'), os=require('os'), {spawnSync}=require('child_process');
const html=fs.readFileSync(process.argv[2]||path.join(__dirname,'../ch57x-keyboard-web-configurator.html'),'utf8');
const core=html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const api=new Function(core+';return {parseYaml,toYaml,fromObj,EXAMPLE,makeUploadScript};')();
let fail=0; const ok=(n,c,extra)=>{ if(!c) fail++; console.log(c?'ok  ':'FAIL',n,c||extra===undefined?'':'\n      '+extra); };

const yaml=api.toYaml(api.fromObj(api.parseYaml(api.EXAMPLE)));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch57x-up-'));
const stub="it's-tool";
fs.copyFileSync(path.join(__dirname,'fixtures',stub),path.join(dir,stub)); fs.chmodSync(path.join(dir,stub),0o755);
fs.writeFileSync(path.join(dir,'upload.sh'),api.makeUploadScript(yaml,'sh','./'+stub,false));
const ps1=api.makeUploadScript(yaml,'ps1','.\\tool.exe',false);
ok('ps1 embeds the YAML', ps1.includes(yaml.split('\n')[1]));
ok('ps1 validates before uploading', ps1.indexOf('validate')>-1 && ps1.indexOf('validate')<ps1.lastIndexOf('upload'));

const bash=spawnSync('bash',['--version']);
if(bash.error){ console.log('skip upload.sh run: bash not available'); }
else {
  const run=env=>spawnSync('bash',['upload.sh'],{cwd:dir,encoding:'utf8',env:{...process.env,...env}});
  const r=run({FAILV:''});
  ok('upload.sh exits 0', r.status===0, r.stderr);
  ok('validate then upload, in order', /STUB validate mapping\.yaml\nSTUB upload mapping\.yaml\nUploaded\./.test(r.stdout), r.stdout);
  ok('mapping.yaml is the exact YAML', fs.readFileSync(path.join(dir,'mapping.yaml'),'utf8')===yaml);
  const f=run({FAILV:'1'});
  ok('failed validate -> non-zero exit', f.status!==0);
  ok('failed validate -> no upload', !/STUB upload/.test(f.stdout), f.stdout);
}
fs.rmSync(dir,{recursive:true,force:true});
console.log(fail?fail+' FAILED':'ALL PASSED');
process.exit(fail?1:0);
