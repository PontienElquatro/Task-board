import { Workspace } from './workspace-merge';
export interface WorkspaceEnvelope {revision:number;data:Workspace;pending:boolean;base?:Workspace;}
export interface DeviceCheckpoint {
  account:string; writer:string; updatedAt:string; envelope:WorkspaceEnvelope;
}
