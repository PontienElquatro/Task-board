import { mergeWorkspace, resolveWorkspaceMerge } from './workspace-merge';
describe('Three-way workspace merge',()=>{
  const key='mytaskboard_tasks';
  const a={id:'a',title:'A',order:0}, b={id:'b',title:'B',order:1};
  it('combines changes to different tasks without mutating its inputs',()=>{
    const base={[key]:[a,b]},local={[key]:[{...a,title:'Local'},b]},remote={[key]:[a,{...b,title:'Cloud'}]};
    const result=mergeWorkspace(base,local,remote);
    expect(result.conflicts.length).toBe(0);
    expect(result.data[key]).toEqual([{...a,title:'Local'},{...b,title:'Cloud'}]);
    expect(base[key]).toEqual([a,b]);
  });
  it('requires a choice for two changes to the same task',()=>{
    const result=mergeWorkspace({[key]:[a]},{[key]:[{...a,title:'Local'}]},{[key]:[{...a,title:'Cloud'}]});
    expect(result.conflicts.length).toBe(1);
    expect(()=>resolveWorkspaceMerge(result,{})).toThrow();
    expect(resolveWorkspaceMerge(result,{[result.conflicts[0].token]:'remote'})[key]).toEqual([{...a,title:'Cloud'}]);
  });
  it('merges independent additions and deletes unchanged records',()=>{
    const result=mergeWorkspace({[key]:[a,b]},{[key]:[b,{id:'c',title:'C'}]},{[key]:[a,b,{id:'d',title:'D'}]});
    expect(result.conflicts.length).toBe(0);
    expect((result.data[key] as Array<{id:string}>).map(x=>x.id)).toEqual(['b','c','d']);
  });
  it('does not silently resurrect a task deleted on one side and edited on the other',()=>{
    const result=mergeWorkspace({[key]:[a]},{[key]:[]},{[key]:[{...a,title:'Cloud'}]});
    expect(result.conflicts.length).toBe(1);
    expect(resolveWorkspaceMerge(result,{[result.conflicts[0].token]:'local'})[key]).toEqual([]);
  });
  it('treats unknown arrays conservatively and compares object keys independently of order',()=>{
    expect(mergeWorkspace({x:{a:1,b:2}},{x:{b:2,a:1}},{x:{a:3,b:2}}).conflicts.length).toBe(0);
    expect(mergeWorkspace({x:[1]},{x:[2]},{x:[3]}).conflicts.length).toBe(1);
  });
});
