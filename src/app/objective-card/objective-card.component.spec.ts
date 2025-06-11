import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ObjectiveCardComponent } from './objective-card.component';

describe('ObjectiveCardComponent', () => {
  let component: ObjectiveCardComponent;
  let fixture: ComponentFixture<ObjectiveCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObjectiveCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ObjectiveCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
