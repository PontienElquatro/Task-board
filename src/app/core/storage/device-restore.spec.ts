import { readDeviceArchive } from './device-restore';
describe('Device archive restoration',()=>{
  const task={id:'a',title:'À récupérer',status:'todo'};
  const envelope={data:{mytaskboard_tasks:[task]}};
  const archive={app:'Maat',version:3,kind:'device-copies',accountId:'a',copies:[{account:'a',envelope}],journals:[envelope]};
  it('reads copies and journals using task validation',()=>{
    const copies=readDeviceArchive(archive,'a');
    expect(copies.length).toBe(2);expect(copies[0].tasks[0].title).toBe('À récupérer');
  });
  it('rejects another account',()=>expect(()=>readDeviceArchive(archive,'b')).toThrowError(/autre compte/));
  it('rejects an inconsistent nested account',()=>expect(()=>readDeviceArchive({...archive,copies:[{account:'b',envelope}]},'a')).toThrowError(/incohérent/));
  it('rejects invalid task data',()=>expect(()=>readDeviceArchive({...archive,journals:[{data:{mytaskboard_tasks:[{...task,status:'bad'}]}}]},'a')).toThrowError(/Statut/));
  it('rejects empty archives',()=>expect(()=>readDeviceArchive({...archive,copies:[],journals:[]},'a')).toThrowError(/aucune/));
});
