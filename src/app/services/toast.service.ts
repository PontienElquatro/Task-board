import { Injectable, signal } from '@angular/core';
@Injectable({providedIn:'root'})
export class ToastService {
 readonly message=signal('');
 private timer?:ReturnType<typeof setTimeout>;
 success(message:string){
  clearTimeout(this.timer);
  this.message.set(message);
  this.timer=setTimeout(()=>this.dismiss(),3000);
 }
 dismiss(){clearTimeout(this.timer);this.message.set('');}
}
