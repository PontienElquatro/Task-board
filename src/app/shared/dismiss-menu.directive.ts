import { Directive, ElementRef, HostListener, inject } from '@angular/core';

/** Native details keeps keyboard semantics; no business state is changed. */
@Directive({selector:'details[appDismissMenu]',standalone:true})
export class DismissMenuDirective {
  private readonly element=inject<ElementRef<HTMLDetailsElement>>(ElementRef);
  @HostListener('document:click',['$event'])
  outside(event:MouseEvent) {
    const menu=this.element.nativeElement;
    if(menu.open && event.target instanceof Node && !menu.contains(event.target)) menu.open=false;
  }
  @HostListener('keydown.escape',['$event'])
  escape(event:Event) {
    const menu=this.element.nativeElement;
    if(!menu.open)return;
    event.preventDefault();event.stopPropagation();menu.open=false;
    menu.querySelector('summary')?.focus();
  }
}
