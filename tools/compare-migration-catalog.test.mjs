import test from 'node:test';
import assert from 'node:assert/strict';
import {compareMigrationCatalog} from './compare-migration-catalog.mjs';
test('catalog order and object key order do not create false differences',()=>{
 const reference={tables:[{name:'public.a',rls:true},{name:'public.b',rls:true}]};
 const actual={tables:[{rls:true,name:'public.b'},{rls:true,name:'public.a'}]};
 assert.equal(compareMigrationCatalog(reference,actual).matches,true);
});
test('missing objects, unexpected grants and weakened RLS are reported, not accepted',()=>{
 const reference={tables:[{name:'a',rls:true},{name:'b',rls:true}],grants:[]};
 const local={tables:[{name:'a',rls:false}],grants:[{name:'a|anon|SELECT'}]};
 const report=compareMigrationCatalog(reference,local);
 assert.equal(report.matches,false);
 assert.deepEqual(report.totals,{missing:1,extra:1,changed:1});
 assert.deepEqual(report.differences.tables.changed[0].fields,['rls']);
});
test('incomplete or duplicate inventories fail closed',()=>{
 assert.throws(()=>compareMigrationCatalog({tables:[]},{}),/category/);
 assert.throws(()=>compareMigrationCatalog({tables:[{name:'a'},{name:'a'}]},{tables:[]}),/duplicate/);
});
