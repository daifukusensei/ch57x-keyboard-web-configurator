const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-config-editor.html'),'utf8');
const core=html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const api=new Function(core+';return {parseYaml,toYaml,fromObj,EXAMPLE,makeUploadScript};')();
const y=api.toYaml(api.fromObj(api.parseYaml(api.EXAMPLE)));
fs.writeFileSync((process.argv[3]||require('path').join(__dirname,'up'))+'/upload.sh',api.makeUploadScript(y,'sh',"./it's-tool",false));
fs.writeFileSync((process.argv[3]||require('path').join(__dirname,'up'))+'/upload.ps1',api.makeUploadScript(y,'ps1','.\\tool.exe',false));
fs.writeFileSync((process.argv[3]||require('path').join(__dirname,'up'))+'/expected.yaml',y);
