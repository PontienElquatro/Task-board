import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from './auth.service';
export interface PlatformSettings {support_email:string;announcement:string;version:number;updated_at:string;}
@Injectable({providedIn:'root'})
export class PlatformSettingsService {
  readonly settings=signal<PlatformSettings|null>(null);
  private readonly auth=inject(AuthService);
  private readonly browser=isPlatformBrowser(inject(PLATFORM_ID));
  constructor(){if(this.browser)void this.refresh();}
  async refresh(){if(!this.browser)return;try{const {data,error}=await this.auth.client.from('taskboard_platform_settings').select('support_email,announcement,version,updated_at').eq('singleton',true).single();if(!error&&data)this.settings.set(data);}catch{/* A missing public banner must not block account navigation. */}}
}
