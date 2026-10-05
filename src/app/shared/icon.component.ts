import { Component, Input } from '@angular/core';
const paths: Record<string,string> = {
 'arrow-right':'M4 12h16 M14 6l6 6-6 6',
 user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2',
 search:'M21 21l-5-5 M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14',
 undo:'M8 4 3 9l5 5 M3 9h11a7 7 0 0 1 7 7v3',
 filter:'M4 6h16 M7 12h10 M10 18h4 M8 4v4 M16 10v4',
 shield:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z M9 12l2 2 4-4',
 cloud:'M7 19h11a4 4 0 0 0 1-7.9A7 7 0 0 0 5.2 9.2 5 5 0 0 0 7 19',
 'cloud-check':'M7 19h11a4 4 0 0 0 1-7.9A7 7 0 0 0 5.2 9.2 5 5 0 0 0 7 19 M9 13l2 2 4-4',
 'cloud-error':'M7 19h11a4 4 0 0 0 1-7.9A7 7 0 0 0 5.2 9.2 5 5 0 0 0 7 19 M10 11l4 4 M14 11l-4 4',
 bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
 logout:'M9 4H4v16h5 M14 8l4 4-4 4 M8 12h10',
 chevron:'m6 9 6 6 6-6', close:'m6 6 12 12 M18 6 6 18',
 check:'m5 12 4 4L19 6', plus:'M12 5v14 M5 12h14',
 board:'M3 4h18v16H3z M9 4v16 M15 4v16',
 folder:'M3 7V4h7l2 3h9v13H3z',
 calendar:'M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4',
 chart:'M4 20h16 M6 16V9 M12 16V4 M18 16v-4',
 team:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M12 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M22 21v-3a4 4 0 0 0-3-4 M16 3a3 3 0 0 1 0 6',
 settings:'M4 6h16 M4 12h16 M4 18h16 M8 4v4 M16 10v4 M10 16v4',
 help:'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 18h.01 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
 refresh:'M20 7V3l-4 4 M4 17v4l4-4 M20 7a9 9 0 0 0-15-2 M4 17a9 9 0 0 0 15 2',
 moon:'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11',
 sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1',
 more:'M5 12h.01 M12 12h.01 M19 12h.01',
 archive:'M3 4h18v4H3z M5 8v12h14V8 M10 12h4',
 copy:'M9 9h12v12H9z M15 9V3H3v12h6'
};
@Component({selector:'app-icon',standalone:true,template:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path [attr.d]="path" /></svg>`,host:{class:'inline-flex shrink-0 items-center justify-center'}})
export class IconComponent {
 @Input() name='board';
 get path(){return paths[this.name]??paths['board'];}
}
