// Isolated local validation; never installs packages or changes the live backend.
import {cpSync,existsSync,mkdtempSync,symlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const dependencies=join(root,'tmp/security-verification-fd0657523e554d5db7a87d8bb3fd81f6/node_modules');
if(!existsSync(dependencies))throw new Error('Reviewed Angular 21 dependencies unavailable.');
const work=mkdtempSync(join(root,'tmp/team-settings-validation-'));
for(const name of ['src','public','angular.json','package.json','package-lock.json','tsconfig.json','tsconfig.app.json','tsconfig.spec.json','vitest.config.mjs','ngsw-config.json','.postcssrc.json']){
 if(existsSync(join(root,name)))cpSync(join(root,name),join(work,name),{recursive:true});
}
symlinkSync(dependencies,join(work,'node_modules'),'junction');
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
if(!existsSync(chrome))throw new Error('Chrome required for local UI tests.');
const env={...process.env,CHROME_BIN:chrome,NG_CLI_ANALYTICS:'false'};
function run(args){const r=spawnSync(process.execPath,args,{cwd:work,env,windowsHide:true,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw new Error('Validation failed; snapshot: '+work);}
console.log('Local validation snapshot: '+work);
run([resolve(dependencies,'typescript/bin/tsc'),'--noEmit','-p','tsconfig.spec.json']);
run([resolve(dependencies,'@angular/cli/bin/ng.js'),'test','--watch=false','--browsers=ChromiumHeadless','--include=src/app/pages/collaboration-settings.component.spec.ts','--include=src/app/services/team.service.spec.ts','--include=src/app/pages/team-invitation.component.spec.ts','--include=src/app/shared/premium-access.component.spec.ts']);
run([resolve(dependencies,'@angular/cli/bin/ng.js'),'build','--output-path=dist/team-settings-check']);
console.log('PASS settings TypeScript, targeted browser tests and build. No deployment.');
