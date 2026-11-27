import {Routes} from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'bitacora',
  },
  {
    path: 'bitacora',
    loadComponent: () =>
      import('./pages/logbook/logbook').then((m) => m.Logbook),
    title: 'Bitácora TPM | TPM SmartAssist',
  },
  {
    path: 'maquinaria',
    loadComponent: () =>
      import('./pages/machinery/machinery').then((m) => m.Machinery),
    title: 'Maquinaria | TPM SmartAssist',
  },
  {
    path: 'historial',
    loadComponent: () =>
      import('./pages/history/history').then((m) => m.History),
    title: 'Historial | TPM SmartAssist',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
    title: 'Dashboard | TPM SmartAssist',
  },
  {
    path: '**',
    redirectTo: 'bitacora',
  },
];
