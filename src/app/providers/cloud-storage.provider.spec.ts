import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CloudStorageProvider } from './cloud-storage.provider';
import { AuthService } from '../services/auth.service';
import { DEVICE_CHECKPOINTS } from '../core/storage/indexed-checkpoints';
import { WORKSPACE_LOCKS } from '../core/storage/tab-coordinator';

describe('Cloud recovery safety', () => {
  let cloud: CloudStorageProvider;
  let user: ReturnType<typeof signal<{id:string}|null>>;
  let read: jasmine.Spy;
  let write: jasmine.Spy;
  let checkpoint: jasmine.Spy;
  const id = 'maat-unit-test';
  const cacheKey = 'mytaskboard_cloud_' + id;
  const backupKey = 'maat_recovery_' + id;
  async function settle() { for (let i=0;i<8;i++) await Promise.resolve(); }
  beforeEach(async () => {
    localStorage.removeItem(cacheKey); localStorage.removeItem(backupKey);
    user = signal<{id:string}|null>(null);
    read = jasmine.createSpy('read').and.resolveTo({data:{revision:1,data:{items:['original']}},error:null});
    write = jasmine.createSpy('rpc').and.resolveTo({data:3,error:null});
    checkpoint=jasmine.createSpy('checkpoint').and.resolveTo(undefined);
    const query = {select:()=>query,eq:()=>query,maybeSingle:()=>read()};
    TestBed.configureTestingModule({providers:[
      {provide:DEVICE_CHECKPOINTS,useValue:{put:checkpoint,list:()=>Promise.resolve([])}},
      {provide:WORKSPACE_LOCKS,useValue:null},
      {provide:AuthService,useValue:{
      initializing:signal(false),user,client:{from:()=>query,rpc:write}
    }}]});
    cloud = TestBed.inject(CloudStorageProvider);
    TestBed.flushEffects(); user.set({id}); TestBed.flushEffects(); await settle();
    spyOn(window,'confirm').and.returnValue(true);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem(cacheKey); localStorage.removeItem(backupKey);
    for(const key of Object.keys(localStorage)) if(key.startsWith(cacheKey+'_draft_')) localStorage.removeItem(key);
  });
  it('retains an independent pending journal before the cloud write', () => {
    cloud.setItem('items',['draft']);
    const journals=Object.keys(localStorage).filter(key=>key.startsWith(cacheKey+'_draft_'));
    expect(journals.length).toBe(1);
    expect(JSON.parse(localStorage.getItem(journals[0])!).data.items).toEqual(['draft']);
    expect(JSON.parse(localStorage.getItem(journals[0])!).pending).toBeTrue();
  });
  it('ignores a delayed read after signing out', async()=>{
    let finish!:(value:unknown)=>void;
    read.and.returnValue(new Promise(resolve=>finish=resolve));
    const syncing=cloud.sync();
    await settle();
    user.set(null);TestBed.flushEffects();
    finish({data:{revision:99,data:{items:['private old account']}},error:null});
    await syncing;
    expect(cloud.getItem('items')).toBeNull();expect(cloud.status()).toBe('Mode local');
  });
  it('does not acknowledge pending data on a rejected CAS write',async()=>{
    cloud.setItem('items',['pending']);
    write.and.resolveTo({data:null,error:{code:'40001'}});
    await cloud.sync();
    expect(cloud.getItem('items')).toEqual(['pending']);
    expect(JSON.parse(localStorage.getItem(cacheKey)!).pending).toBeTrue();
    expect(cloud.status()).toContain('nouvelle comparaison');
  });
  it('retains pending changes on a PostgREST PT409 conflict',async()=>{
    cloud.setItem('items',['pending']);
    write.and.resolveTo({data:null,error:{code:'PT409'}});
    await cloud.sync();
    expect(cloud.getItem('items')).toEqual(['pending']);
    expect(JSON.parse(localStorage.getItem(cacheKey)!).pending).toBeTrue();
    expect(cloud.status()).toContain('nouvelle comparaison');
  });
  it('does not send simultaneous writes from the same provider',async()=>{
    let finish!:(value:unknown)=>void;
    cloud.setItem('items',['pending']);
    write.and.returnValue(new Promise(resolve=>finish=resolve));
    const first=cloud.sync();await settle();await cloud.sync();
    expect(write.calls.count()).toBe(1);
    finish({data:2,error:null});await first;
  });
  it('keeps normal storage usable when IndexedDB fails', async () => {
    checkpoint.and.rejectWith(new Error('IndexedDB unavailable'));
    cloud.setItem('items',['safe']);
    for(let i=0;i<30;i++) await Promise.resolve();
    expect(cloud.getItem('items')).toEqual(['safe']);
    expect(cloud.localBackupStatus()).toContain('indisponible');
  });
  it('rejects stale local edits instead of overwriting another tab', () => {
    user.set(null); TestBed.flushEffects();
    const key='maat-local-stale-test';
    try {
      localStorage.removeItem(key); cloud.getItem(key);
      localStorage.setItem(key,JSON.stringify(['other tab']));
      expect(()=>cloud.setItem(key,['stale form'])).toThrowError(/autre version/);
      expect(JSON.parse(localStorage.getItem(key)!)).toEqual(['other tab']);
    } finally {localStorage.removeItem(key);}
  });
  it('keeps the local version and conflict when recovery fetch fails', async () => {
    cloud.setItem('items',['unsynchronised']); cloud.conflict.set(true);
    read.and.resolveTo({data:null,error:{message:'offline'}});
    await cloud.reloadCloud();
    expect(cloud.getItem('items')).toEqual(['unsynchronised']);
    expect(cloud.conflict()).toBeTrue();
    const backup = JSON.parse(localStorage.getItem(backupKey)!);
    expect(backup.data.items).toEqual(['unsynchronised']);
  });
  it('backs up pending changes before replacing them with the cloud version', async () => {
    cloud.setItem('items',['unsynchronised']); cloud.conflict.set(true);
    read.and.resolveTo({data:{revision:2,data:{items:['remote']}},error:null});
    await cloud.reloadCloud();
    expect(cloud.getItem('items')).toEqual(['remote']);
    expect(cloud.conflict()).toBeFalse();
    expect(JSON.parse(localStorage.getItem(backupKey)!).data.items).toEqual(['unsynchronised']);
  });
  it('does not fetch or replace anything if the safety backup cannot be stored', async () => {
    cloud.setItem('items',['unsynchronised']); cloud.conflict.set(true);
    spyOn(Storage.prototype,'setItem').and.throwError('quota');
    read.calls.reset();
    await cloud.reloadCloud();
    expect(read).not.toHaveBeenCalled();
    expect(cloud.getItem('items')).toEqual(['unsynchronised']);
    expect(cloud.conflict()).toBeTrue();
  });
  it('automatically combines edits to separate tasks and writes against the latest revision', async () => {
    const a={id:'a',title:'A'},b={id:'b',title:'B'};
    read.and.resolveTo({data:{revision:1,data:{mytaskboard_tasks:[a,b]}},error:null});
    await cloud.sync();
    cloud.setItem('mytaskboard_tasks',[{...a,title:'Local'},b]);
    read.and.resolveTo({data:{revision:2,data:{mytaskboard_tasks:[a,{...b,title:'Remote'}]}},error:null});
    await cloud.sync();
    expect(cloud.conflict()).toBeFalse();
    expect(cloud.getItem('mytaskboard_tasks')).toEqual([{...a,title:'Local'},{...b,title:'Remote'}]);
    expect(write.calls.mostRecent().args[1].expected_revision).toBe(2);
    expect(JSON.parse(localStorage.getItem(backupKey)!).data.mytaskboard_tasks[0].title).toBe('Local');
  });
  it('blocks a same-task conflict until a choice is made, preserving the local backup', async () => {
    const a={id:'a',title:'A'};
    read.and.resolveTo({data:{revision:1,data:{mytaskboard_tasks:[a]}},error:null}); await cloud.sync();
    cloud.setItem('mytaskboard_tasks',[{...a,title:'Local'}]);
    read.and.resolveTo({data:{revision:2,data:{mytaskboard_tasks:[{...a,title:'Remote'}]}},error:null});
    await cloud.sync();
    expect(cloud.conflict()).toBeTrue(); expect(write).not.toHaveBeenCalled();
    const token=cloud.conflictItems()[0].token;
    await cloud.resolveConflicts({[token]:'remote'});
    expect(cloud.conflict()).toBeFalse();
    expect(cloud.getItem('mytaskboard_tasks')).toEqual([{...a,title:'Remote'}]);
    expect(JSON.parse(localStorage.getItem(backupKey)!).data.mytaskboard_tasks[0].title).toBe('Local');
  });
});
