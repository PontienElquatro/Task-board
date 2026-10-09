import { TestBed } from '@angular/core/testing';
import { LoaderComponent } from './loader.component';

describe('Loader Ma’at',()=>{
  it('affiche les trois colonnes et la plume fournies',()=>{
    const fixture=TestBed.createComponent(LoaderComponent);
    fixture.detectChanges();
    const element=fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.maat-loader__col').length).toBe(3);
    expect(element.querySelector('.maat-loader__feather path')).toBeTruthy();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Chargement de Ma’at');
  });
  it('permet un libellé de chargement explicite',()=>{
    const fixture=TestBed.createComponent(LoaderComponent);
    fixture.componentRef.setInput('label','Chargement du calendrier');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Chargement du calendrier');
  });
});
