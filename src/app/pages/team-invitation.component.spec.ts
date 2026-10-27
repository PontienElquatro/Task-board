import { beforeEach, describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TeamComponent } from './workspace-pages.component';
import { TeamService } from '../services/team.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

describe('Team invitation sharing', () => {
  let user = signal<any>({id:'owner'});
  let teams: any, router: any, snapshot: any;
  let page: TeamComponent;
  const link = {id:'invitation',email:'friend@example.invalid',expiresAt:'2099-01-01',url:'https://maat.example/team#invitation=invitation&token=secret'};
  beforeEach(() => {
    user = signal<any>({id:'owner'});
    teams = { load:vi.fn().mockResolvedValue(undefined), accept:vi.fn().mockResolvedValue('team'), cancel:vi.fn().mockResolvedValue(undefined) };
    router = {navigate:vi.fn().mockResolvedValue(true)};
    snapshot = {fragment:'invitation=invitation&token=secret',queryParamMap:convertToParamMap({})};
    TestBed.configureTestingModule({providers:[
      {provide:TeamService,useValue:teams},
      {provide:AuthService,useValue:{user,initializing:signal(true)}},
      {provide:ActivatedRoute,useValue:{snapshot}},
      {provide:Router,useValue:router},
      {provide:ToastService,useValue:{success:vi.fn()}},
    ]});
    page = TestBed.runInInjectionContext(() => new TeamComponent());
    TestBed.flushEffects();
  });
  it('accepts fragment links through the server and removes the secret after success', async () => {
    await page.load();
    expect(teams.accept).toHaveBeenCalledWith('invitation','secret');
    expect(router.navigate).toHaveBeenCalledWith(['/team']);
  });
  it('asks signed-out recipients to connect and reopen the link without accepting', async () => {
    user.set(null);
    await page.load();
    expect(teams.accept).not.toHaveBeenCalled();
    expect(page.message).toContain('adresse invitée');
    expect(page.message).toContain('rouvrez');
  });
  it('shows server rejections without reporting success', async () => {
    teams.accept.mockRejectedValue(new Error('Cette invitation a expiré.'));
    await page.load();
    expect(page.message).toContain('expiré');
    expect(router.navigate).not.toHaveBeenCalled();
  });
  it('clears the displayed link on cancellation', async () => {
    page.sharedInvitation=link;
    await page.cancelInvitation(link.id);
    expect(page.sharedInvitation).toBeNull();
  });
  it('clears the displayed link when switching accounts', () => {
    page.sharedInvitation=link;
    user.set({id:'other'});
    TestBed.flushEffects();
    expect(page.sharedInvitation).toBeNull();
  });
});
