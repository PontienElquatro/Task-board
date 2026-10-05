import { Injectable, inject, signal, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from './auth.service';
import { guideAlreadySeen } from '../core/onboarding';

/** This is an appearance preference, never an authorization claim. */
@Injectable({providedIn:'root'})
export class OnboardingService {
 private readonly auth=inject(AuthService);
 private readonly platform=inject(PLATFORM_ID);
 readonly hidden=signal(true);
 readonly error=signal('');
 private account:string|undefined;
 private pending=new Set<string>();
 constructor(){effect(()=>{
  const id=this.auth.user()?.id??'local';
  if(this.account!==undefined&&this.account!==id){this.account=undefined;this.hidden.set(true);this.error.set('');}
 });}
 private key(id:string){return 'maat-guide-hidden:'+id;}
 enter(){
  if(this.auth.initializing()||!isPlatformBrowser(this.platform))return;
  const user=this.auth.user(),id=user?.id??'local';
  if(this.account===id)return;
  this.account=id;this.error.set('');
  let cached=false;
  try{cached=localStorage.getItem(this.key(id))==='true';}catch{/* Optional local fallback. */}
  const seen=guideAlreadySeen(user?.user_metadata,cached);
  this.hidden.set(seen);
  // Mark this first visit on the account, while leaving the guide open in this session.
  if(user&&!guideAlreadySeen(user.user_metadata,false))void this.persist(id);
 }
 dismiss(){
  this.hidden.set(true);
  const id=this.auth.user()?.id??'local';
  try{localStorage.setItem(this.key(id),'true');}catch{/* In-memory dismissal still works. */}
  if(id!=='local')void this.persist(id);
 }
 retry(){const id=this.auth.user()?.id;if(id)void this.persist(id);}
 private async persist(id:string){
  if(this.pending.has(id)||this.auth.user()?.id!==id)return;
  if(guideAlreadySeen(this.auth.user()?.user_metadata,false)){this.error.set('');return;}
  this.pending.add(id);
  try{
   const result=await this.auth.client.auth.updateUser({data:{maat_guide_seen:true}});
   if(result.error)throw result.error;
   if(this.auth.user()?.id!==id)return;
   if(result.data.user)this.auth.user.set(result.data.user);
   try{localStorage.setItem(this.key(id),'true');}catch{/* The account remains authoritative. */}
   this.error.set('');
  }catch{
   if(this.auth.user()?.id===id)this.error.set('La préférence du guide n’a pas été sauvegardée dans le compte. Réessayez pour éviter son retour sur un autre appareil.');
  }finally{this.pending.delete(id);}
 }
}
