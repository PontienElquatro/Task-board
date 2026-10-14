import { InjectionToken } from '@angular/core';
import { DeviceCheckpoint, WorkspaceEnvelope } from './workspace-envelope';
export interface CheckpointStore {
  put(account:string,writer:string,envelope:WorkspaceEnvelope):Promise<void>;
  list(account:string):Promise<DeviceCheckpoint[]>;
}
/** Secondary snapshots, separated by account and writer. Transaction completion is the acknowledgement. */
export class IndexedCheckpoints implements CheckpointStore {
  private connection?:Promise<IDBDatabase>;
  constructor(private readonly name='maat-device-checkpoints',private readonly factory:IDBFactory|undefined=globalThis.indexedDB) {}
  private open():Promise<IDBDatabase> {
    if (this.connection) return this.connection;
    if (!this.factory) return Promise.reject(new Error('IndexedDB indisponible'));
    this.connection=new Promise<IDBDatabase>((resolve,reject)=>{
      const request=this.factory!.open(this.name,1);
      let settled=false;
      const timer=setTimeout(()=>{settled=true;reject(new Error('Ouverture IndexedDB trop longue'));},5000);
      request.onupgradeneeded=()=>{
        const store=request.result.createObjectStore('checkpoints',{keyPath:['account','writer']});
        store.createIndex('account','account');
      };
      request.onsuccess=()=>{
        clearTimeout(timer);
        if(settled){request.result.close();return;}
        settled=true;
        request.result.onversionchange=()=>{request.result.close();this.connection=undefined;};
        resolve(request.result);
      };
      request.onerror=()=>{clearTimeout(timer);settled=true;reject(request.error);};
    }).catch(error=>{this.connection=undefined;throw error;});
    return this.connection;
  }
  async put(account:string,writer:string,envelope:WorkspaceEnvelope):Promise<void> {
    const snapshot:DeviceCheckpoint={account,writer,updatedAt:new Date().toISOString(),envelope:JSON.parse(JSON.stringify(envelope))};
    const database=await this.open();
    await new Promise<void>((resolve,reject)=>{
      const transaction=database.transaction('checkpoints','readwrite');
      transaction.objectStore('checkpoints').put(snapshot);
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error ?? new Error('Copie IndexedDB annulée'));
    });
  }
  async list(account:string):Promise<DeviceCheckpoint[]> {
    const database=await this.open();
    return new Promise((resolve,reject)=>{
      const transaction=database.transaction('checkpoints','readonly');
      const request=transaction.objectStore('checkpoints').index('account').getAll(account);
      transaction.oncomplete=()=>resolve((request.result as DeviceCheckpoint[]).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error);
    });
  }
  async close() {if(this.connection){(await this.connection).close();this.connection=undefined;}}
}
export const DEVICE_CHECKPOINTS=new InjectionToken<CheckpointStore>('DeviceCheckpoints',{providedIn:'root',factory:()=>new IndexedCheckpoints()});
