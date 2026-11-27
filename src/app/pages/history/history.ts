import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {Router} from '@angular/router';
import {
  getShiftLabel,
  getStatusLabel,
  MachineStatus,
  MaintenanceReport,
  PREVENTIVE_TASKS,
  ShiftType,
  TaskId,
} from '../../models/tpm.models';
import {TpmData} from '../../services/tpm-data';

@Component({
  selector: 'app-history',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-[1360px] space-y-5">
      <!-- Encabezado -->
      <div class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-300 bg-white px-5 py-4 shadow-sm">
        <div>
          <h1 class="font-display text-xl font-bold tracking-tight text-slate-900">
            Historial de Mantenimiento
          </h1>
          <p class="mt-0.5 text-sm text-slate-600">
            Consulta, filtrado y auditoría de bitácoras de mantenimiento autónomo registradas
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            type="button"
            (click)="exportCsv()"
            [disabled]="filteredReports().length === 0"
            class="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">download</mat-icon>
            <span>Exportar CSV</span>
          </button>
          <button
            type="button"
            (click)="goToNewReport()"
            class="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#D1851B] px-4 py-2 text-xs font-bold text-white hover:bg-[#B87314] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">add_task</mat-icon>
            <span>Nuevo Reporte</span>
          </button>
        </div>
      </div>

      <!-- Filtros por máquina, fecha y operador -->
      <div class="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label
              for="hist-machine"
              class="block text-[11px] font-bold tracking-wider text-slate-600 uppercase"
            >
              Filtrar por Máquina
            </label>
            <select
              id="hist-machine"
              [value]="machineFilter()"
              (change)="onMachineFilterChange($event)"
              class="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#D1851B] focus:outline-none"
            >
              <option value="">Todas las máquinas</option>
              @for (m of machines(); track m.id) {
                <option [value]="m.code">{{ m.code }} — {{ m.name }}</option>
              }
            </select>
          </div>

          <div>
            <label
              for="hist-date"
              class="block text-[11px] font-bold tracking-wider text-slate-600 uppercase"
            >
              Filtrar por Fecha
            </label>
            <input
              id="hist-date"
              type="date"
              [value]="dateFilter()"
              (input)="onDateFilterInput($event)"
              class="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono-tabular text-sm text-slate-900 focus:border-[#D1851B] focus:outline-none"
            />
          </div>

          <div>
            <label
              for="hist-operator"
              class="block text-[11px] font-bold tracking-wider text-slate-600 uppercase"
            >
              Filtrar por Operador
            </label>
            <input
              id="hist-operator"
              type="search"
              [value]="operatorFilter()"
              (input)="onOperatorFilterInput($event)"
              placeholder="Nombre del operador..."
              class="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#D1851B] focus:outline-none"
            />
          </div>

          <div class="flex items-center justify-between gap-2">
            <span class="font-mono-tabular text-xs font-semibold text-slate-600">
              {{ filteredReports().length }} reporte(s)
            </span>
            <button
              type="button"
              (click)="clearFilters()"
              [disabled]="!hasActiveFilters()"
              class="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <mat-icon class="!text-[16px] !w-4 !h-4">filter_alt_off</mat-icon>
              <span>Limpiar filtros</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla de historial -->
      @if (filteredReports().length === 0) {
        <div class="rounded-2xl border border-slate-300 bg-white p-10 text-center shadow-sm">
          <mat-icon class="!text-[40px] !w-10 !h-10 text-slate-400">assignment_late</mat-icon>
          <h2 class="mt-3 font-display text-lg font-bold text-slate-900">
            No hay reportes que coincidan
          </h2>
          <p class="mt-1 text-sm text-slate-600">
            Modifica los filtros aplicados o registra una nueva bitácora de mantenimiento.
          </p>
        </div>
      } @else {
        <div class="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr class="border-b border-slate-300 bg-slate-50 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                  <th class="px-4 py-3.5">Folio</th>
                  <th class="px-4 py-3.5">Fecha</th>
                  <th class="px-4 py-3.5">Máquina</th>
                  <th class="px-4 py-3.5">Operador</th>
                  <th class="px-4 py-3.5">Turno</th>
                  <th class="px-4 py-3.5 text-right">Actividades</th>
                  <th class="px-4 py-3.5">Estado</th>
                  <th class="px-4 py-3.5">Observaciones</th>
                  <th class="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 text-sm">
                @for (r of filteredReports(); track r.id) {
                  <tr class="hover:bg-slate-50/80 transition-colors">
                    <td class="px-4 py-3 font-mono-tabular text-xs font-bold text-slate-900 whitespace-nowrap">
                      {{ r.folio }}
                    </td>
                    <td class="px-4 py-3 font-mono-tabular text-xs text-slate-700 whitespace-nowrap">
                      {{ r.date }}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap">
                      <span class="font-mono-tabular font-bold text-slate-900">{{ r.machineCode }}</span>
                      <span class="block text-xs text-slate-500 truncate max-w-[160px]">
                        {{ r.machineName }}
                      </span>
                    </td>
                    <td class="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {{ r.operator }}
                    </td>
                    <td class="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {{ shiftLabel(r.shift) }}
                    </td>
                    <td class="px-4 py-3 text-right font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                      {{ r.completedTaskIds.length }} / {{ r.totalTasks }}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap">
                      <span
                        class="inline-flex items-center gap-1.5 text-xs font-bold uppercase"
                        [class]="statusTextClass(r.status)"
                      >
                        <mat-icon class="!text-[16px] !w-4 !h-4">{{ statusIcon(r.status) }}</mat-icon>
                        <span>{{ statusLabel(r.status) }}</span>
                      </span>
                    </td>
                    <td class="px-4 py-3 max-w-[240px]">
                      <p class="truncate text-xs text-slate-600" [title]="r.observations">
                        {{ r.observations || 'Sin observaciones' }}
                      </p>
                    </td>
                    <td class="px-4 py-3 text-right whitespace-nowrap">
                      <div class="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          (click)="selectedReport.set(r)"
                          class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
                        >
                          <mat-icon class="!text-[15px] !w-[15px] !h-[15px]">visibility</mat-icon>
                          <span>Detalle</span>
                        </button>
                        <button
                          type="button"
                          (click)="editInLogbook(r)"
                          class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          aria-label="Editar reporte"
                        >
                          <mat-icon class="!text-[15px] !w-[15px] !h-[15px]">edit</mat-icon>
                        </button>
                        @if (confirmDeleteId() === r.id) {
                          <button
                            type="button"
                            (click)="deleteReport(r.id)"
                            class="inline-flex items-center rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            (click)="confirmDeleteId.set(null)"
                            class="inline-flex items-center rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 cursor-pointer"
                          >
                            No
                          </button>
                        } @else {
                          <button
                            type="button"
                            (click)="confirmDeleteId.set(r.id)"
                            class="inline-flex items-center rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                            aria-label="Eliminar reporte"
                          >
                            <mat-icon class="!text-[15px] !w-[15px] !h-[15px]">delete_outline</mat-icon>
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Modal de Detalle de Reporte -->
      @if (selectedReport(); as rep) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-detail-title"
        >
          <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-300 bg-white shadow-xl">
            <div class="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <p class="font-mono-tabular text-xs font-bold text-[#D1851B]">
                  {{ rep.folio }}
                </p>
                <h2 id="report-detail-title" class="font-display text-lg font-bold text-slate-900">
                  Detalle de Bitácora TPM — {{ rep.machineCode }}
                </h2>
              </div>
              <button
                type="button"
                (click)="selectedReport.set(null)"
                class="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-100 cursor-pointer"
                aria-label="Cerrar detalle"
              >
                <mat-icon class="!text-[20px] !w-5 !h-5">close</mat-icon>
              </button>
            </div>

            <div class="space-y-5 p-6">
              <!-- Metadatos -->
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 border-b border-slate-200 pb-4 text-sm">
                <div>
                  <p class="text-[11px] font-bold text-slate-500 uppercase">Máquina</p>
                  <p class="mt-0.5 font-semibold text-slate-900">
                    {{ rep.machineCode }} · {{ rep.machineName }}
                  </p>
                </div>
                <div>
                  <p class="text-[11px] font-bold text-slate-500 uppercase">Operador</p>
                  <p class="mt-0.5 font-semibold text-slate-900">{{ rep.operator }}</p>
                </div>
                <div>
                  <p class="text-[11px] font-bold text-slate-500 uppercase">Fecha y Turno</p>
                  <p class="mt-0.5 font-mono-tabular font-semibold text-slate-900">
                    {{ rep.date }} · {{ shiftLabel(rep.shift) }}
                  </p>
                </div>
                <div>
                  <p class="text-[11px] font-bold text-slate-500 uppercase">Estado</p>
                  <p class="mt-0.5 font-bold uppercase" [class]="statusTextClass(rep.status)">
                    {{ statusLabel(rep.status) }}
                  </p>
                </div>
                <div>
                  <p class="text-[11px] font-bold text-slate-500 uppercase">Firma Responsable</p>
                  <p class="mt-0.5 font-semibold text-slate-900">{{ rep.signature }}</p>
                </div>
              </div>

              <!-- Lecturas registradas -->
              <div>
                <h3 class="text-xs font-bold tracking-wider text-slate-600 uppercase mb-2.5">
                  Indicadores Registrados
                </h3>
                <div class="grid grid-cols-3 gap-3">
                  <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p class="text-[11px] font-bold text-slate-500 uppercase">Temperatura</p>
                    <p class="mt-1 font-mono-tabular text-xl font-bold text-slate-900">
                      {{ rep.temperature }} °C
                    </p>
                  </div>
                  <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p class="text-[11px] font-bold text-slate-500 uppercase">Presión</p>
                    <p class="mt-1 font-mono-tabular text-xl font-bold text-slate-900">
                      {{ rep.pressure }} PSI
                    </p>
                  </div>
                  <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p class="text-[11px] font-bold text-slate-500 uppercase">Vibración</p>
                    <p class="mt-1 font-mono-tabular text-xl font-bold text-slate-900">
                      {{ rep.vibration }} MM/S
                    </p>
                  </div>
                </div>
              </div>

              <!-- Checklist -->
              <div>
                <h3 class="text-xs font-bold tracking-wider text-slate-600 uppercase mb-2.5">
                  Actividades Preventivas ({{ rep.completedTaskIds.length }} / {{ rep.totalTasks }})
                </h3>
                <ul class="space-y-1.5">
                  @for (t of tasks; track t.id) {
                    @let done = hasTask(rep, t.id);
                    <li class="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2 text-sm">
                      <span class="font-medium text-slate-800">{{ t.label }}</span>
                      <span
                        class="inline-flex items-center gap-1 text-xs font-bold"
                        [class]="done ? 'text-emerald-700' : 'text-slate-400'"
                      >
                        <mat-icon class="!text-[16px] !w-4 !h-4">
                          {{ done ? 'check_box' : 'check_box_outline_blank' }}
                        </mat-icon>
                        <span>{{ done ? 'Completada' : 'No realizada' }}</span>
                      </span>
                    </li>
                  }
                </ul>
              </div>

              <!-- Observaciones -->
              <div>
                <h3 class="text-xs font-bold tracking-wider text-slate-600 uppercase mb-1.5">
                  Observaciones
                </h3>
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-800">
                  {{ rep.observations || 'Sin anomalías ni observaciones registradas.' }}
                </div>
              </div>
            </div>

            <div class="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                (click)="editInLogbook(rep)"
                class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <mat-icon class="!text-[16px] !w-4 !h-4">edit</mat-icon>
                <span>Editar en Bitácora</span>
              </button>
              <button
                type="button"
                (click)="selectedReport.set(null)"
                class="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class History {
  private readonly tpmData = inject(TpmData);
  private readonly router = inject(Router);

  readonly machines = this.tpmData.sortedMachines;
  readonly reports = this.tpmData.sortedReports;
  readonly tasks = PREVENTIVE_TASKS;

  readonly machineFilter = signal<string>('');
  readonly dateFilter = signal<string>('');
  readonly operatorFilter = signal<string>('');
  readonly selectedReport = signal<MaintenanceReport | null>(null);
  readonly confirmDeleteId = signal<string | null>(null);

  readonly hasActiveFilters = computed(
    () =>
      this.machineFilter() !== '' ||
      this.dateFilter() !== '' ||
      this.operatorFilter().trim() !== '',
  );

  readonly filteredReports = computed(() => {
    const mCode = this.machineFilter();
    const date = this.dateFilter();
    const op = this.operatorFilter().trim().toLowerCase();

    return this.reports().filter((r) => {
      if (mCode && r.machineCode !== mCode) return false;
      if (date && r.date !== date) return false;
      if (op && !r.operator.toLowerCase().includes(op)) return false;
      return true;
    });
  });

  onMachineFilterChange(event: Event): void {
    this.machineFilter.set((event.target as HTMLSelectElement).value);
  }

  onDateFilterInput(event: Event): void {
    this.dateFilter.set((event.target as HTMLInputElement).value);
  }

  onOperatorFilterInput(event: Event): void {
    this.operatorFilter.set((event.target as HTMLInputElement).value);
  }

  clearFilters(): void {
    this.machineFilter.set('');
    this.dateFilter.set('');
    this.operatorFilter.set('');
  }

  hasTask(report: MaintenanceReport, taskId: TaskId): boolean {
    return report.completedTaskIds.includes(taskId);
  }

  editInLogbook(report: MaintenanceReport): void {
    this.selectedReport.set(null);
    this.tpmData.editingReportId.set(report.id);
    this.tpmData.activeLogbookMachineId.set(report.machineId);
    void this.router.navigate(['/bitacora']);
  }

  goToNewReport(): void {
    this.tpmData.editingReportId.set(null);
    void this.router.navigate(['/bitacora']);
  }

  async deleteReport(id: string): Promise<void> {
    await this.tpmData.deleteReport(id);
    this.confirmDeleteId.set(null);
  }

  exportCsv(): void {
    const rows = this.filteredReports();
    if (rows.length === 0) return;

    const header = [
      'Folio',
      'Fecha',
      'Maquina',
      'Operador',
      'Turno',
      'Actividades Completadas',
      'Estado',
      'Temperatura (°C)',
      'Presion (PSI)',
      'Vibracion (MM/S)',
      'Observaciones',
      'Firma',
    ];

    const escape = (val: string | number): string =>
      `"${String(val).replace(/"/g, '""')}"`;

    const lines = [
      header.map(escape).join(','),
      ...rows.map((r) =>
        [
          r.folio,
          r.date,
          `${r.machineCode} - ${r.machineName}`,
          r.operator,
          getShiftLabel(r.shift),
          `${r.completedTaskIds.length}/${r.totalTasks}`,
          getStatusLabel(r.status),
          r.temperature,
          r.pressure,
          r.vibration,
          r.observations,
          r.signature,
        ]
          .map(escape)
          .join(','),
      ),
    ];

    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tpm-historial-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  shiftLabel(shift: ShiftType): string {
    return getShiftLabel(shift);
  }

  statusLabel(status: MachineStatus): string {
    return getStatusLabel(status);
  }

  statusIcon(status: MachineStatus): string {
    switch (status) {
      case 'operando':
        return 'check_circle';
      case 'mantenimiento':
        return 'build_circle';
      case 'detenido':
        return 'cancel';
    }
  }

  statusTextClass(status: MachineStatus): string {
    switch (status) {
      case 'operando':
        return 'text-emerald-700';
      case 'mantenimiento':
        return 'text-amber-800';
      case 'detenido':
        return 'text-red-700';
    }
  }
}
