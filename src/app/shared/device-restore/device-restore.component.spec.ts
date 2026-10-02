import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DeviceRestoreComponent } from './device-restore.component';
import { CloudStorageProvider } from '../../providers/cloud-storage.provider';
import { TaskService } from '../../services/task.service';
import { normalizeTasks } from '../../models/task-utils';
describe('Guided restoration',()=>{
  const recovered=normalizeTasks([{id:'a',title:'Existing backup',status:'todo'},{id:'b',title:'Missing task',status:'done'}]);
  let component:DeviceRestoreComponent;
  let user:ReturnType<typeof signal<{id:string}|null>>;
  let imported:jasmine.Spy;
  let conflict:ReturnType<typeof signal<boolean>>;
  beforeEach(async()=>{
    user=signal<{id:string}|null>(null); conflict=signal(false); imported=jasmine.createSpy('importTasks');
    TestBed.configureTestingModule({providers:[
      {provide:CloudStorageProvider,useValue:{auth:{user},ready:signal(true),conflict}},
      {provide:TaskService,useValue:{tasks:signal(normalizeTasks([{id:'a',title:'Keep current',status:'todo'}])),loadFailed:signal(false),importTasks:imported}}
    ]});
    component=TestBed.createComponent(DeviceRestoreComponent).componentInstance;
    // Match the initial template evaluation before a file has been loaded.
    expect(component.current()).toBeUndefined();
    const content={app:'Maat',version:3,kind:'device-copies',accountId:'__local__',copies:[],journals:[{data:{mytaskboard_tasks:recovered}}]};
    const input={files:[{size:100,text:async()=>JSON.stringify(content)}],value:'archive.json'};
    await component.load({target:input} as unknown as Event);
  });
  afterEach(()=>TestBed.resetTestingModule());
  it('previews and imports only absent identifiers',()=>{
    expect(component.additions().map(task=>task.id)).toEqual(['b']);component.apply();
    expect(imported.calls.mostRecent().args[0].map((task:{id:string})=>task.id)).toEqual(['b']);
  });
  it('invalidates the preview after an account change',()=>{
    user.set({id:'other'});component.apply();expect(component.current()).toBeUndefined();expect(imported).not.toHaveBeenCalled();
  });
  it('does not restore while a sync conflict is unresolved',()=>{
    conflict.set(true);component.apply();expect(imported).not.toHaveBeenCalled();
  });
});
