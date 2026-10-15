// Explicit, scoped commit and push. Run in the user's normal terminal.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const args=process.argv.slice(2);
if(args.some(arg=>arg!=='--check'))throw new Error('Unknown option');
function git(args,inherit=false){
 const result=spawnSync('git',args,{cwd:root,encoding:'utf8',stdio:inherit?'inherit':'pipe'});
 if(result.error)throw result.error;
 if(result.status!==0){
  if(!inherit)process.stderr.write(result.stderr??'');
  throw new Error('Git failed; stop and review. No automatic reset or retry.');
 }
 return (result.stdout??'').trim();
}
if(git(['branch','--show-current'])!=='codex/cloud-admin')throw new Error('Unexpected branch');
if(git(['remote','get-url','origin'])!=='https://github.com/PontienElquatro/Task-board.git')
 throw new Error('Unexpected remote');
if(git(['diff','--cached','--name-only']))throw new Error('Existing staged changes; not mixed into this commit');
if(args.includes('--check')){
 console.log('PASS branch, remote and empty index; no commit or push performed');
 process.exit(0);
}
const files=[
 '.gitattributes','.gitignore','database/candidates','supabase/migrations',
 'docs/production-migration-preflight.md','docs/production-parity-review.md',
 'docs/production-release-freeze.md','docs/production-rollback-plan.md',
 ...['admin-lifecycle-candidate','collaboration-core-candidate','compare-migration-catalog',
 'invitation-candidate','notification-candidate','release-candidate'].flatMap(name=>
  ['tools/'+name+'.mjs','tools/'+name+'.test.mjs']),
 ...['backup-production','prepare-release-migration','rehearse-production-restore',
 'commit-production-preparation'].map(name=>'tools/'+name+'.mjs'),
];
git(['add','--',...files],true);
console.log(git(['diff','--cached','--stat']));
git(['commit','-m','chore: figer et verifier la migration de production gratuite'],true);
console.log('Commit created: '+git(['rev-parse','--short','HEAD']));
git(['push','origin','HEAD:refs/heads/codex/cloud-admin'],true);
console.log('PASS production preparation committed and pushed; database unchanged');
