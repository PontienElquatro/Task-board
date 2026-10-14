import { Directive, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

/** Shared presentation only; the existing form remains responsible for validation. */
@Directive({selector:'input[appUiField],select[appUiField],textarea[appUiField]',standalone:true,host:{
 class:'min-h-11 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none',
 '[attr.aria-invalid]':'invalid ? "true" : null',
 '[class.ring-2]':'invalid',
 '[class.ring-red-500]':'invalid'
}})
export class UiFieldDirective {
 private readonly control=inject(NgControl,{optional:true,self:true});
 get invalid(){return !!(this.control?.invalid&&(this.control.touched||this.control.dirty));}
}
