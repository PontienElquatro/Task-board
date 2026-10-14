import {DOCUMENT,isPlatformBrowser} from '@angular/common';
import {Directive,DestroyRef,PLATFORM_ID,inject,Injectable} from '@angular/core';

@Injectable({providedIn:'root'})
export class ModalScrollLock {
 private readonly document=inject(DOCUMENT);
 private readonly browser=isPlatformBrowser(inject(PLATFORM_ID));
 private count=0;
 private restore=()=>{};
 acquire():()=>void {
  if(!this.browser)return ()=>{};
  if(this.count++===0){
   const html=this.document.documentElement,body=this.document.body;
   const htmlOverflow=html.style.overflow,bodyOverflow=body.style.overflow;
   html.style.overflow='hidden';body.style.overflow='hidden';
   this.restore=()=>{html.style.overflow=htmlOverflow;body.style.overflow=bodyOverflow;};
  }
  let released=false;
  return ()=>{if(released)return;released=true;if(--this.count===0)this.restore();};
 }
}
@Directive({selector:'[appModalScrollLock]',standalone:true})
export class ModalScrollLockDirective {
 constructor(){const release=inject(ModalScrollLock).acquire();inject(DestroyRef).onDestroy(release);}
}
