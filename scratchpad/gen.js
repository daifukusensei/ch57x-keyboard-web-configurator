const fs=require('fs');
const html=fs.readFileSync(process.argv[2],'utf8');
const core=html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const api=new Function(core+';return {parseYaml,toYaml,fromObj,EXAMPLE,makeUploadScript};')();
const y=api.toYaml(api.fromObj(api.parseYaml(api.EXAMPLE)));
fs.writeFileSync(process.argv[3]+'/upload.sh',api.makeUploadScript(y,'sh',"./it's-tool",false));
fs.writeFileSync(process.argv[3]+'/upload.ps1',api.makeUploadScript(y,'ps1','.\\tool.exe',false));
fs.writeFileSync(process.argv[3]+'/expected.yaml',y);
