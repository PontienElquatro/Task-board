import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const adminRouteGuard:CanActivateFn=async()=>{
  const auth=inject(AuthService);const router=inject(Router);
  const initialized=toObservable(auth.initializing);
  await firstValueFrom(initialized.pipe(filter(value=>!value),take(1)));
  if(!auth.user())return router.createUrlTree(['/login']);
  return await auth.isAdmin()?true:router.createUrlTree(['/access-denied']);
};
