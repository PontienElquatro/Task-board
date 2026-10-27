import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from './auth.service';
import { TeamService } from './team.service';
describe('TeamService reliability', () => {
    let service: TeamService;
    let user = signal<any>({ id: 'owner' });
    let client: any;
    const team = { id: 'team', owner_id: 'owner', name: 'Equipe', created_at: '2026-10-12' };
    beforeEach(() => {
        user = signal<any>({ id: 'owner' });
        client = { from: vi.fn().mockName('from'), rpc: vi.fn().mockName('rpc').mockResolvedValue({ data: [], error: null }) };
        TestBed.configureTestingModule({ providers: [TeamService, { provide: AuthService, useValue: { user, client } }] });
        service = TestBed.inject(TeamService);
        TestBed.flushEffects();
    });
    function rows(data: any[]) { return { select: () => ({ order: () => Promise.resolve({ data, error: null }), in: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }; }
    it('ignores a response from the previous account', async () => {
        let resolve: any;
        client.from.mockReturnValue({ select: () => ({ order: () => new Promise(r => resolve = r) }) });
        const loading = service.load();
        user.set({ id: 'other' });
        TestBed.flushEffects();
        resolve({ data: [], error: null });
        await loading;
        expect(service.teams()).toEqual([]);
        expect(service.members()).toEqual([]);
    });
    it('the latest load wins even for the same account', async () => {
        let resolve: any;
        let calls = 0;
        client.from.mockImplementation((table: string) => {
            if (table !== 'taskboard_teams')
                return rows([]);
            if (++calls === 1)
                return { select: () => ({ order: () => new Promise(r => resolve = r) }) };
            return rows([team]);
        });
        const old = service.load();
        await service.load();
        resolve({ data: [], error: null });
        await old;
        expect(service.teams()).toEqual([team]);
    });
    it('clears cached team data on sign-out', () => {
        service.teams.set([team]);
        user.set(null);
        TestBed.flushEffects();
        expect(service.teams()).toEqual([]);
    });
    it('creates the team without a second membership insertion', async () => {
        const insert = vi.fn().mockName('insert').mockReturnValue({ select: () => ({ single: async () => ({ data: team, error: null }) }) });
        client.from.mockImplementation((table: string) => table === 'taskboard_teams' ? { ...rows([team]), insert } : rows([]));
        await service.create('Equipe');
        expect(insert).toHaveBeenCalledTimes(1);
        expect(client.from.mock.calls.some(([table]: string[]) => table === 'taskboard_team_members')).toBe(false);
    });
    it('rejects invalid names without a network request', async () => {
        await expect(service.create('x'.repeat(101)).then(() => false, () => true)).resolves.toBe(true);
        expect(client.from).not.toHaveBeenCalled();
    });
    it('does not publish partial state when the roster fails', async () => {
        client.from.mockReturnValue(rows([team]));
        client.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });
        await expect(service.load().then(() => false, () => true)).resolves.toBe(true);
        expect(service.teams()).toEqual([]);
    });
    it('creates a private fragment link without sending email or exposing the token in history', async () => {
        const invitation = { id: 'invite', team_id: 'team', email: 'recipient@example.invalid', role: 'member', expires_at: '2099-01-01', created_at: '2026-10-12' };
        const insert = vi.fn().mockReturnValue({ select: () => ({ single: async () => ({ data: invitation, error: null }) }) });
        client.from.mockReturnValue({ insert });
        client.functions = { invoke: vi.fn() };
        const result = await service.invite('team', ' Recipient@example.invalid ', 'member');
        const url = new URL(result!.url);
        expect(url.search).toBe('');
        expect(url.pathname).toBe('/team');
        const params = new URLSearchParams(url.hash.slice(1));
        expect(params.get('invitation')).toBe('invite');
        expect(params.get('token')).toBe(insert.mock.calls[0][0].token_hash);
        expect(params.get('token')!.length).toBeGreaterThanOrEqual(64);
        expect(insert.mock.calls[0][0].email).toBe(invitation.email);
        expect(client.functions.invoke).not.toHaveBeenCalled();
        expect(service.invitations()).toEqual([invitation]);
        expect(service.invitations()[0]).not.toHaveProperty('token_hash');
    });
    it('does not return a secret when the account changes during creation', async () => {
        client.from.mockReturnValue({ insert: () => ({ select: () => ({ single: async () => {
            user.set({id:'other'});
            return {data:{id:'invite'},error:null};
        } }) }) });
        expect(await service.invite('team','recipient@example.invalid','member')).toBeUndefined();
        expect(service.invitations()).toEqual([]);
    });
    it('does not create a link if insertion is rejected', async () => {
        client.from.mockReturnValue({ insert: () => ({ select: () => ({ single: async () => ({data:null,error:{message:'denied'}}) }) }) });
        await expect(service.invite('team','recipient@example.invalid','member')).rejects.toThrow('Invitation impossible');
        expect(service.invitations()).toEqual([]);
    });
});
