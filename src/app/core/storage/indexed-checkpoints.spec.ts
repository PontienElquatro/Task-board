import { IndexedCheckpoints } from './indexed-checkpoints';
describe('IndexedDB device checkpoints',()=>{
  let store:IndexedCheckpoints;
  beforeEach(()=>{store=new IndexedCheckpoints('maat-test-'+crypto.randomUUID());});
  afterEach(async()=>{await store.close();});
  it('keeps two writers independent and isolates accounts',async()=>{
    await store.put('a','one',{revision:1,data:{items:['one']},pending:true});
    await store.put('a','two',{revision:1,data:{items:['two']},pending:true});
    await store.put('b','one',{revision:9,data:{items:['private']},pending:false});
    const copies=await store.list('a');
    expect(copies.length).toBe(2);
    expect(copies.every(copy=>copy.account==='a')).toBeTrue();
    expect((await store.list('b'))[0].envelope.revision).toBe(9);
  });
  it('updates only the snapshot for its own writer and does not mutate input',async()=>{
    const envelope={revision:1,data:{items:['one']},pending:true};
    await store.put('a','one',envelope);
    envelope.data.items.push('later');
    expect((await store.list('a'))[0].envelope.data['items']).toEqual(['one']);
    await store.put('a','one',{revision:2,data:{},pending:false});
    expect((await store.list('a')).length).toBe(1);
    expect((await store.list('a'))[0].envelope.revision).toBe(2);
  });
  it('reports unavailable storage without claiming a successful backup',async()=>{
    const unavailable=new IndexedCheckpoints('unused',null as unknown as IDBFactory);
    await expectAsync(unavailable.put('a','one',{revision:0,data:{},pending:true})).toBeRejected();
  });
});
