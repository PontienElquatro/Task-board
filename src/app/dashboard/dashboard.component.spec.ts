import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { DashboardService } from '../services/dashboard.service';

describe('Vue d’ensemble — état vide',()=>{
 it('propose une prochaine action plutôt que des graphiques à zéro',()=>{
  TestBed.configureTestingModule({imports:[DashboardComponent],providers:[provideRouter([]),{provide:DashboardService,useValue:{stats:signal({total:0,completed:0,late:0,progressPercentage:0}),distribution:signal([]),priorities:signal([]),goalsProgress:signal([])}}]});
  const fixture=TestBed.createComponent(DashboardComponent);fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('Votre progression commence ici.');
  expect(fixture.nativeElement.querySelector('[aria-label="Indicateurs"]')).toBeNull();
  expect(fixture.nativeElement.querySelector('a[href="/board"]')).toBeTruthy();
 });
});
