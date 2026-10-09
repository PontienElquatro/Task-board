import { validNotice, withWorkspaceLock } from './tab-coordinator';
describe('Tab coordination',()=>{
  it('uses an account-scoped exclusive lock',async()=>{
    const work=jasmine.createSpy('work').and.resolveTo('done');
    const request=jasmine.createSpy('request').and.callFake((_name,_options,callback)=>callback());
    expect(await withWorkspaceLock('account-a',work,{request} as unknown as LockManager)).toBe('done');
    expect(request.calls.mostRecent().args[0]).toBe('maat-cloud-sync:account-a');
    expect(request.calls.mostRecent().args[1]).toEqual({mode:'exclusive'});
  });
  it('keeps the CAS workflow usable when Web Locks are unavailable',async()=>{
    expect(await withWorkspaceLock('account-a',async()=>42,null)).toBe(42);
  });
  it('accepts only well-formed account notifications',()=>{
    expect(validNotice({account:'a',writer:'b'})).toBeTrue();
    expect(validNotice({account:1,writer:'b'})).toBeFalse();
    expect(validNotice(null)).toBeFalse();
  });
});
