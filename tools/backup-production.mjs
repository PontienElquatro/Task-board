// Read-only remote backup. No migration, restore, or credential storage.
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
if(process.argv.slice(2).some(arg=>arg!=='--check'))throw new Error('Unknown option');
const bin='C:/Users/DELL/Documents/pgsql/bin';
const backupRoot='C:/Users/DELL/Documents/Ma-at-backups';
const project='nzdfuhozeiexvtrryndk';
// Use the exact production Session Pooler parameters copied from Supabase.
// The direct endpoint currently fails through the workstation's OS resolver.
const databaseHost='aws-1-eu-west-3.pooler.supabase.com';
const databasePort='5432';
const databaseUser='postgres.nzdfuhozeiexvtrryndk';
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^PG/i.test(key)));
function run(name,args){
 const result=spawnSync(join(bin,name+'.exe'),args,{env,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(name+' failed; no verified backup declared');
}
for(const name of ['pg_dump','pg_restore']){
 if(!existsSync(join(bin,name+'.exe')))throw new Error('Missing PostgreSQL tool: '+name);
 run(name,['--version']);
}
if(process.argv.includes('--check')){
 console.log('PASS backup tools available; no connection or file created');
 process.exit(0);
}
const timestamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const dir=join(backupRoot,timestamp+'-'+randomUUID().slice(0,8));
mkdirSync(dir,{recursive:true});
const archive=join(dir,'MyTaskBoard.dump');
console.log('Production read-only backup: '+project);
console.log('Enter the production database password only at the PostgreSQL prompt.');
run('pg_dump',[
 '--dbname=host='+databaseHost+' port='+databasePort+' dbname=postgres user='+databaseUser+' sslmode=require connect_timeout=20',
 '--password','--format=custom','--file='+archive,
]);
if(statSync(archive).size===0)throw new Error('Empty archive; stop');
console.log('Checking complete archive readability (no database restore)...');
// No --dbname: extraction to the Windows null device cannot restore a database.
run('pg_restore',['--exit-on-error','--file=NUL',archive]);
const sha256=createHash('sha256').update(readFileSync(archive)).digest('hex');
const manifest={project,createdAt:new Date().toISOString(),archive,
 bytes:statSync(archive).size,sha256,validation:'complete SQL extraction to NUL; not a restore rehearsal',
 exclusions:'Storage file contents, Edge code, secrets and platform configuration are not in pg_dump'};
writeFileSync(join(dir,'backup-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log('PASS fresh production backup; complete archive readable');
console.log('Archive: '+archive);
console.log('Bytes: '+manifest.bytes);
console.log('SHA-256: '+sha256);
console.log('No migration applied. Do not share the archive or database password.');
