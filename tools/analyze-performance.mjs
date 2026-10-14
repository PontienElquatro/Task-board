// Local diagnostic; dependencies are read from the isolated verification copy.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir,realpath} from 'node:fs/promises';
import {dirname,resolve,sep,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const stage=await realpath(resolve(root,process.argv[2]||'tmp/security-verification-fd0657523e554d5db7a87d8bb3fd81f6'));
assert.ok(stage.startsWith(root+sep+'tmp'+sep),'Use an isolated verification copy');
const require=createRequire(resolve(stage,'package.json'));
const postcss=require('postcss'),tailwind=require('@tailwindcss/postcss');
const browser=resolve(stage,process.argv[3]||'dist/security-check/browser');
assert.ok(browser.startsWith(stage+sep+'dist'+sep),'Use build outputs from the verification copy');
const current=await readFile(resolve(stage,'src/styles.css'),'utf8');
const css=current.replace('@import "tailwindcss" source(none);','@import "tailwindcss";');
const candidate=css.replace('@import "tailwindcss";','@import "tailwindcss" source(none);')
  .replace('@source "./app";','@source "./app";\n@source "./index.html";');
const measure=content=>({bytes:Buffer.byteLength(content),gzipBytes:gzipSync(content).length});
for(const[name,input]of process.argv.includes('--graph-only')?[]:[['automatic',css],['explicit',candidate]]){
 const result=await postcss([tailwind({base:stage,optimize:{minify:true}})]).process(input,{from:resolve(stage,'src',`performance-${name}.css`)});
 for(const selector of ['.grid-cols-7','.min-h-11','.dark\\:bg-gray-900'])assert.ok(result.css.includes(selector),`Missing ${selector} in ${name}`);
 console.log(JSON.stringify({cssMode:name,...measure(result.css)}));
}
const{init,parse}=require('es-module-lexer');await init;
const index=await readFile(resolve(browser,'index.csr.html'),'utf8');
const entries=[...index.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]);
const seen=new Set(),chunks=[];
async function visit(name){name=basename(name);if(seen.has(name)||!name.endsWith('.js'))return;seen.add(name);const code=await readFile(resolve(browser,name),'utf8');chunks.push({name,...measure(code)});for(const item of parse(code)[0])if(item.d===-1&&item.n?.startsWith('./'))await visit(item.n)}
for(const name of entries)await visit(name);
for(const name of await readdir(browser))if(/^styles(?:-[\w]+)?\.css$/.test(name))chunks.push({name,...measure(await readFile(resolve(browser,name),'utf8'))});
chunks.sort((a,b)=>b.bytes-a.bytes);
console.log(JSON.stringify({initialGraph:chunks,totalBytes:chunks.reduce((sum,item)=>sum+item.bytes,0)},null,2));
try {
 const stats=JSON.parse(await readFile(resolve(browser,'../stats.json'),'utf8'));
 for(const chunk of chunks.filter(item=>item.name.endsWith('.js')).slice(0,3)){
  const output=Object.entries(stats.outputs||{}).find(([name])=>basename(name)===chunk.name)?.[1];
  if(!output)continue;
  const modules=Object.entries(output.inputs||{}).map(([name,details])=>({name,bytes:details.bytesInOutput})).sort((a,b)=>b.bytes-a.bytes).slice(0,12);
  console.log(JSON.stringify({chunk:chunk.name,modules},null,2));
 }
}catch(error){if(error.code==='ENOENT')console.log('No stats.json; build with --stats-json for module attribution.');else throw error;}
