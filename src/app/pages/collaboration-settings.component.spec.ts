import {beforeEach,describe,it,expect,vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {TeamSettingsComponent,ProjectSettingsComponent} from './collaboration-settings.component';
import {TeamService,Team} from '../services/team.service';
import {AuthService} from '../services/auth.service';

describe('Collaboration settings',()=>{
 const team:Team={id:'team',owner_id:'owner',name:'Equipe',created_at:'2026-10-22',settings_version:1};
 let user=signal<any>({id:'owner'}),teams:any,client:any;
 beforeEach(()=>{
  user=signal<any>({id:'owner'});
  teams={settings:vi.fn().mockResolvedValue(undefined),canManage:(t:Team)=>t.owner_id===user()?.id,members:signal([{team_id:'team',user_id:'member',role:'member',display_name:'Membre'}])};
  client={rpc:vi.fn().mockResolvedValue({error:null}),from:vi.fn().mockReturnValue({select:()=>({eq:()=>Promise.resolve({data:[],error:null})})})};
  TestBed.configureTestingModule({imports:[TeamSettingsComponent,ProjectSettingsComponent],providers:[{provide:TeamService,useValue:teams},{provide:AuthService,useValue:{user,client}}]});
 });
 it('asks for confirmation before closing an owner team',()=>{
  const f=TestBed.createComponent(TeamSettingsComponent);f.componentRef.setInput('team',team);f.detectChanges();
  const button=Array.from(f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(b=>b.textContent?.includes('Clore'))!;
  button.click();f.detectChanges();expect(teams.settings).not.toHaveBeenCalled();expect(f.nativeElement.textContent).toContain('lecture seule');
 });
 it('a non-owner can leave but cannot close or transfer ownership',()=>{
  user.set({id:'member'});const f=TestBed.createComponent(TeamSettingsComponent);f.componentRef.setInput('team',team);f.detectChanges();
  expect(f.nativeElement.textContent).toContain('Quitter l’équipe');expect(f.nativeElement.textContent).not.toContain('Préparer le transfert');
 });
 it('preserves the page on a rejected action',async()=>{
  teams.settings.mockRejectedValue(new Error('Les paramètres ont changé.'));const f=TestBed.createComponent(TeamSettingsComponent);f.componentRef.setInput('team',team);
  const changed=vi.fn();f.componentInstance.changed.subscribe(changed);await f.componentInstance.act('close');
  expect(changed).not.toHaveBeenCalled();expect(f.componentInstance.message).toContain('changé');expect(f.componentInstance.busy).toBe(false);
 });
 it('submits a version-checked team transfer',async()=>{
  const f=TestBed.createComponent(TeamSettingsComponent);f.componentRef.setInput('team',team);f.componentInstance.successor='member';await f.componentInstance.act('transfer');
  expect(teams.settings).toHaveBeenCalledWith(team,'transfer',{successor:'member'});
 });
 it('closes and reopens projects without a delete request',async()=>{
  const f=TestBed.createComponent(ProjectSettingsComponent);f.componentRef.setInput('team',team);f.componentRef.setInput('project',{id:'project',team_id:'team',title:'Projet',settings_version:2});
  await f.componentInstance.act('close');expect(client.rpc).toHaveBeenCalledWith('taskboard_project_settings',expect.objectContaining({pid:'project',operation:'close',expected_version:2}));
  expect(client.from).not.toHaveBeenCalledWith('taskboard_shared_tasks');
 });
 it('disables project edits when the parent team is closed',async()=>{
  const f=TestBed.createComponent(ProjectSettingsComponent);f.componentRef.setInput('team',{...team,archived_at:'2026-10-22'});f.componentRef.setInput('project',{id:'project',team_id:'team',title:'Projet',settings_version:2});f.detectChanges();
  // NgModel applies its disabled state in a microtask after form registration.
  await f.whenStable();f.detectChanges();
  expect(f.componentInstance.locked()).toBe(true);
  for(const control of f.nativeElement.querySelectorAll('input,textarea,select') as NodeListOf<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)expect(control.disabled).toBe(true);
  f.componentRef.setInput('team',{...team,archived_at:null});f.detectChanges();await f.whenStable();f.detectChanges();
  expect(f.componentInstance.locked()).toBe(false);
  expect((f.nativeElement.querySelector('input') as HTMLInputElement).disabled).toBe(false);
 });
 it('removes project access explicitly rather than deleting the account',async()=>{
  const f=TestBed.createComponent(ProjectSettingsComponent);f.componentRef.setInput('team',team);f.componentRef.setInput('project',{id:'project',team_id:'team',title:'Projet',settings_version:2});await f.componentInstance.setMember('member','');
  expect(client.rpc).toHaveBeenCalledWith('taskboard_project_settings',expect.objectContaining({operation:'member',target:'member',new_role:null}));
 });
});
