import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PremiumAccessComponent } from './premium-access.component';
import { AuthService } from '../services/auth.service';

describe('Premium access', () => {
  const trial = {
    trialStartedAt: '2026-10-01T00:00:00Z', trialEndsAt: '2026-10-31T00:00:00Z',
    trialActive: true, paidUntil: null, paidActive: false, active: true,
    pendingRequest: false, requestStatus: null, requestedTariff: null, requestCreatedAt: null,
  };
  const expired = { ...trial, trialActive: false, active: false };
  const pending = { ...expired, pendingRequest: true, requestStatus: 'pending', requestedTariff: 'Equipe', requestCreatedAt: '2026-10-25T00:00:00Z' };
  let user: ReturnType<typeof signal<any>>;
  let initializing: ReturnType<typeof signal<boolean>>;
  let rpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    user = signal<any>({ id: 'user-1' });
    initializing = signal(false);
    rpc = vi.fn().mockResolvedValue({ data: trial, error: null });
    TestBed.configureTestingModule({
      imports: [PremiumAccessComponent],
      providers: [{ provide: AuthService, useValue: { user, initializing, client: { rpc } } }],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(PremiumAccessComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('explains the 30-day trial and does not show a payment request during it', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('essai de 30 jours');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(rpc).toHaveBeenCalledWith('taskboard_premium_status');
  });

  it('lets an expired user submit a manual-payment request, without activating access', async () => {
    rpc.mockResolvedValueOnce({ data: expired, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    rpc.mockResolvedValueOnce({ data: pending, error: null });
    const fixture = await render();
    const component = fixture.componentInstance;
    component.requestedTariff = 'Equipe';
    component.paymentReference = 'MM-123';
    component.requestNote = 'Paiement envoyé';
    await component.submit();
    fixture.detectChanges();
    expect(rpc).toHaveBeenCalledWith('taskboard_request_premium_access', {
      requested_tariff: 'Equipe', payment_reference: 'MM-123', request_note: 'Paiement envoyé',
    });
    expect(component.status()?.active).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Demande en attente');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('keeps a pending request read-only and makes clear that it is not an approval', async () => {
    rpc.mockResolvedValue({ data: pending, error: null });
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('L’administrateur vérifiera le paiement');
    expect(fixture.nativeElement.textContent).toContain('Demande en attente');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('shows a safe error when the request is rejected by the server', async () => {
    rpc.mockResolvedValueOnce({ data: expired, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'request rejected' } });
    const fixture = await render();
    fixture.componentInstance.requestedTariff = 'Equipe';
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Demande non envoyée');
    expect(fixture.componentInstance.status()?.active).toBe(false);
  });
});
