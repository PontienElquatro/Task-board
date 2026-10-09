import { RenderMode, ServerRoute } from '@angular/ssr';
// Local data is available only in the browser.
export const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Client }];
