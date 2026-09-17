'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
let babel;
try{babel=require('@babel/core');}catch{console.error('Install dependencies before the JSX syntax check.');process.exit(1);}
for(const file of ['App.js',...fs.readdirSync(path.join(root,'src')).filter(x=>/\.(js|cjs)$/.test(x)).map(x=>'src/'+x)]) {
  babel.parseSync(fs.readFileSync(path.join(root,file),'utf8'),{filename:file,configFile:false,babelrc:false,parserOpts:{sourceType:'unambiguous',plugins:['jsx']}});
}
console.log('VOOM JSX/JavaScript syntax check passed.');
