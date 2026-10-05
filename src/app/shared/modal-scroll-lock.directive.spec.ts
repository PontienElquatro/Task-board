import {TestBed} from '@angular/core/testing';
import {DOCUMENT} from '@angular/common';
import {PLATFORM_ID} from '@angular/core';
import {ModalScrollLock} from './modal-scroll-lock.directive';

describe('ModalScrollLock',()=>{
 it('bloque et restaure les styles sans libérer une autre fenêtre',()=>{
  const document={documentElement:{style:{overflow:'auto'}},body:{style:{overflow:'scroll'}}};
  TestBed.configureTestingModule({providers:[{provide:DOCUMENT,useValue:document},{provide:PLATFORM_ID,useValue:'browser'}]});
  const lock=TestBed.inject(ModalScrollLock),first=lock.acquire(),second=lock.acquire();
  expect(document.documentElement.style.overflow).toBe('hidden');
  first();first();
  expect(document.body.style.overflow).toBe('hidden');
  second();
  expect(document.documentElement.style.overflow).toBe('auto');
  expect(document.body.style.overflow).toBe('scroll');
 });
 it('ne modifie pas le document côté serveur',()=>{
  const document={documentElement:{style:{overflow:'auto'}},body:{style:{overflow:''}}};
  TestBed.configureTestingModule({providers:[{provide:DOCUMENT,useValue:document},{provide:PLATFORM_ID,useValue:'server'}]});
  TestBed.inject(ModalScrollLock).acquire()();
  expect(document.documentElement.style.overflow).toBe('auto');
 });
});
