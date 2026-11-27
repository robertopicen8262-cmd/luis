import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {Router} from '@angular/router';
import {getStatusLabel, MachineStatus} from '../../models/tpm.models';
import {TpmData} from '../../services/tpm-data';

interface MachineComplianceRow {
  machineId: string;
  code: string;
  name: string;
  reportCount: number;
  compliancePct: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-[1360px] space-y-5">
      <!-- Encabezado del Dashboard -->
      <div class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-300 bg-white px-5 py-4 shadow-sm">
        <div>
          <h1 class="font-display text-xl font-bold tracking-tight text-slate-900">
            Dashboard General de Mantenimiento (TPM)
          </h1>
          <p class="mt-0.5 text-sm text-slate-600">
            Resumen operativo de maquinaria y cumplimiento de mantenimiento preventivo autónomo
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            type="button"
            (click)="goTo('/maquinaria')"
            class="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">precision_manufacturing</mat-icon>
            <span>Ver Maquinaria</span>
          </button>
          <button
            type="button"
            (click)="goTo('/bitacora')"
            class="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#D1851B] px-4 py-2 text-xs font-bold text-white hover:bg-[#B87314] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">assignment</mat-icon>
            <span>Ir a Bitácora</span>
          </button>
        </div>
      </div>

      <!-- 5 Indicadores Generales (KPIs) -->
      <section aria-label="Indicadores generales" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div class="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-xs font-bold tracking-wider uppercase">Total de Máquinas</span>
            <mat-icon class="!text-[20px] !w-5 !h-5 text-slate-700">precision_manufacturing</mat-icon>
          </div>
          <p class="mt-3 font-mono-tabular text-3xl font-bold text-slate-900">
            {{ totalMachines() }}
          </p>
          <p class="mt-1 text-xs text-slate-500">Equipos registrados</p>
        </div>

        <div class="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-xs font-bold tracking-wider uppercase">Máquinas Operando</span>
            <mat-icon class="!text-[20px] !w-5 !h-5 text-emerald-600">check_circle</mat-icon>
          </div>
          <p class="mt-3 font-mono-tabular text-3xl font-bold text-emerald-700">
            {{ operatingCount() }}
          </p>
          <p class="mt-1 text-xs text-slate-500">En producción normal</p>
        </div>

        <div class="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-xs font-bold tracking-wider uppercase">Máquinas Detenidas</span>
            <mat-icon class="!text-[20px] !w-5 !h-5 text-red-600">cancel</mat-icon>
          </div>
          <p class="mt-3 font-mono-tabular text-3xl font-bold text-red-700">
            {{ stoppedCount() }}
          </p>
          <p class="mt-1 text-xs text-slate-500">Fuera de servicio</p>
        </div>

        <div class="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-xs font-bold tracking-wider uppercase">Mant. Pendientes</span>
            <mat-icon class="!text-[20px] !w-5 !h-5 text-[#D1851B]">build_circle</mat-icon>
          </div>
          <p class="mt-3 font-mono-tabular text-3xl font-bold text-amber-700">
            {{ pendingMaintenanceCount() }}
          </p>
          <p class="mt-1 text-xs text-slate-500">Requieren atención</p>
        </div>

        <div class="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-xs font-bold tracking-wider uppercase">Reportes Realizados</span>
            <mat-icon class="!text-[20px] !w-5 !h-5 text-[#D1851B]">fact_check</mat-icon>
          </div>
          <p class="mt-3 font-mono-tabular text-3xl font-bold text-slate-900">
            {{ totalReports() }}
          </p>
          <p class="mt-1 text-xs text-slate-500">Bitácoras guardadas</p>
        </div>
      </section>

      <!-- Gráficas de estado de equipos y cumplimiento preventivo -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <!-- Gráfica 1: Estado operativo de equipos -->
        <section
          aria-labelledby="chart-status-title"
          class="lg:col-span-5 rounded-2xl border border-slate-300 bg-white p-5 sm:p-6 shadow-sm"
        >
          <h2 id="chart-status-title" class="font-display text-base font-bold text-slate-900">
            Estado Operativo de Equipos
          </h2>
          <p class="mt-0.5 text-xs text-slate-500">
            Distribución actual de la flota registrada
          </p>

          @if (totalMachines() === 0) {
            <div class="py-12 text-center text-sm text-slate-500">
              Registra máquinas para visualizar la distribución operativa.
            </div>
          } @else {
            <div class="mt-6 flex flex-col sm:flex-row items-center gap-6">
              <!-- Donut SVG -->
              <div class="relative h-44 w-44 shrink-0">
                <svg viewBox="0 0 120 120" class="h-full w-full -rotate-90" aria-hidden="true">
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#E2E8F0"
                    stroke-width="16"
                  />
                  <!-- Operando (Verde) -->
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#16A34A"
                    stroke-width="16"
                    [attr.stroke-dasharray]="donutSegments().operandoDash"
                    stroke-dashoffset="0"
                  />
                  <!-- Mantenimiento (Amarillo/Ámbar) -->
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#E3AA22"
                    stroke-width="16"
                    [attr.stroke-dasharray]="donutSegments().mantenimientoDash"
                    [attr.stroke-dashoffset]="donutSegments().mantenimientoOffset"
                  />
                  <!-- Detenido (Rojo) -->
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#DC2626"
                    stroke-width="16"
                    [attr.stroke-dasharray]="donutSegments().detenidoDash"
                    [attr.stroke-dashoffset]="donutSegments().detenidoOffset"
                  />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span class="font-mono-tabular text-2xl font-bold text-slate-900">
                    {{ operatingPct() }}%
                  </span>
                  <span class="text-[11px] font-semibold text-slate-500 uppercase">
                    Operando
                  </span>
                </div>
              </div>

              <!-- Leyenda numérica -->
              <div class="flex-1 w-full space-y-3">
                <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div class="flex items-center gap-2.5">
                    <span class="h-3 w-3 rounded-sm bg-[#16A34A]" aria-hidden="true"></span>
                    <span class="text-sm font-semibold text-slate-800">Operando</span>
                  </div>
                  <span class="font-mono-tabular text-sm font-bold text-slate-900">
                    {{ operatingCount() }} ({{ operatingPct() }}%)
                  </span>
                </div>

                <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div class="flex items-center gap-2.5">
                    <span class="h-3 w-3 rounded-sm bg-[#E3AA22]" aria-hidden="true"></span>
                    <span class="text-sm font-semibold text-slate-800">Mantenimiento</span>
                  </div>
                  <span class="font-mono-tabular text-sm font-bold text-slate-900">
                    {{ maintenanceStatusCount() }} ({{ maintenancePct() }}%)
                  </span>
                </div>

                <div class="flex items-center justify-between pb-1">
                  <div class="flex items-center gap-2.5">
                    <span class="h-3 w-3 rounded-sm bg-[#DC2626]" aria-hidden="true"></span>
                    <span class="text-sm font-semibold text-slate-800">Detenido</span>
                  </div>
                  <span class="font-mono-tabular text-sm font-bold text-slate-900">
                    {{ stoppedCount() }} ({{ stoppedPct() }}%)
                  </span>
                </div>
              </div>
            </div>
          }
        </section>

        <!-- Gráfica 2: Cumplimiento de mantenimiento preventivo -->
        <section
          aria-labelledby="chart-compliance-title"
          class="lg:col-span-7 rounded-2xl border border-slate-300 bg-white p-5 sm:p-6 shadow-sm"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="chart-compliance-title" class="font-display text-base font-bold text-slate-900">
                Cumplimiento de Mantenimiento Preventivo
              </h2>
              <p class="mt-0.5 text-xs text-slate-500">
                Porcentaje promedio de actividades completadas por equipo según bitácoras registradas
              </p>
            </div>
            <div class="text-right">
              <span class="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                Promedio Global
              </span>
              <p class="font-mono-tabular text-xl font-bold text-[#D1851B]">
                {{ overallCompliancePct() }}%
              </p>
            </div>
          </div>

          <div class="mt-5 space-y-4">
            @for (row of complianceByMachine(); track row.machineId) {
              <div>
                <div class="flex items-center justify-between gap-3 text-sm">
                  <div class="min-w-0 truncate">
                    <span class="font-mono-tabular font-bold text-slate-900">{{ row.code }}</span>
                    <span class="text-slate-500"> · {{ row.name }}</span>
                  </div>
                  <div class="font-mono-tabular text-xs font-bold text-slate-800 whitespace-nowrap shrink-0">
                    {{ row.compliancePct }}%
                    <span class="font-normal text-slate-500">({{ row.reportCount }} rep.)</span>
                  </div>
                </div>
                <div class="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    class="h-full rounded-full transition-all duration-300"
                    [style.width.%]="row.compliancePct"
                    [class]="complianceBarClass(row.compliancePct)"
                  ></div>
                </div>
              </div>
            }
          </div>
        </section>
      </div>

      <!-- Últimos reportes registrados -->
      <section class="rounded-2xl border border-slate-300 bg-white p-5 sm:p-6 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="font-display text-base font-bold text-slate-900">
              Actividad Reciente de Bitácoras
            </h2>
            <p class="mt-0.5 text-xs text-slate-500">
              Últimos reportes autónomos registrados en el sistema
            </p>
          </div>
          <button
            type="button"
            (click)="goTo('/historial')"
            class="inline-flex items-center gap-1.5 text-xs font-bold text-[#D1851B] hover:underline cursor-pointer"
          >
            <span>Ver historial completo</span>
            <mat-icon class="!text-[16px] !w-4 !h-4">arrow_forward</mat-icon>
          </button>
        </div>

        @if (recentReports().length === 0) {
          <p class="text-sm text-slate-500 py-4">
            Aún no hay reportes registrados.
          </p>
        } @else {
          <div class="divide-y divide-slate-200">
            @for (r of recentReports(); track r.id) {
              <div class="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 text-xs text-slate-500">
                    <span class="font-mono-tabular font-bold text-slate-900">{{ r.folio }}</span>
                    <span aria-hidden="true">·</span>
                    <span class="font-mono-tabular">{{ r.date }}</span>
                    <span aria-hidden="true">·</span>
                    <span>{{ r.operator }}</span>
                  </div>
                  <p class="mt-0.5 font-semibold text-slate-900">
                    {{ r.machineCode }} — {{ r.machineName }}
                  </p>
                </div>

                <div class="flex items-center gap-4 shrink-0">
                  <span class="font-mono-tabular text-xs font-semibold text-slate-700">
                    {{ r.completedTaskIds.length }} / {{ r.totalTasks }} tareas
                  </span>
                  <span
                    class="text-xs font-bold uppercase"
                    [class]="statusTextClass(r.status)"
                  >
                    {{ statusLabel(r.status) }}
                  </span>
                </div>
              </div>
            }
          </div>
        }
      </section>
    </div>
  `,
})
export class Dashboard {
  private readonly tpmData = inject(TpmData);
  private readonly router = inject(Router);

  readonly machines = this.tpmData.sortedMachines;
  readonly reports = this.tpmData.sortedReports;

  readonly totalMachines = computed(() => this.machines().length);
  readonly operatingCount = computed(
    () => this.machines().filter((m) => m.status === 'operando').length,
  );
  readonly stoppedCount = computed(
    () => this.machines().filter((m) => m.status === 'detenido').length,
  );
  readonly maintenanceStatusCount = computed(
    () => this.machines().filter((m) => m.status === 'mantenimiento').length,
  );
  readonly pendingMaintenanceCount = computed(
    () =>
      this.machines().filter(
        (m) => m.maintenancePending || m.status === 'mantenimiento',
      ).length,
  );
  readonly totalReports = computed(() => this.reports().length);

  readonly operatingPct = computed(() => {
    const total = this.totalMachines();
    return total ? Math.round((this.operatingCount() / total) * 100) : 0;
  });

  readonly maintenancePct = computed(() => {
    const total = this.totalMachines();
    return total
      ? Math.round((this.maintenanceStatusCount() / total) * 100)
      : 0;
  });

  readonly stoppedPct = computed(() => {
    const total = this.totalMachines();
    return total ? Math.round((this.stoppedCount() / total) * 100) : 0;
  });

  readonly donutSegments = computed(() => {
    const circumference = 2 * Math.PI * 46; // ~289.027
    const total = this.totalMachines() || 1;
    const opLen = (this.operatingCount() / total) * circumference;
    const maintLen = (this.maintenanceStatusCount() / total) * circumference;
    const stopLen = (this.stoppedCount() / total) * circumference;

    return {
      operandoDash: `${opLen} ${circumference}`,
      mantenimientoDash: `${maintLen} ${circumference}`,
      mantenimientoOffset: `-${opLen}`,
      detenidoDash: `${stopLen} ${circumference}`,
      detenidoOffset: `-${opLen + maintLen}`,
    };
  });

  readonly overallCompliancePct = computed(() => {
    const list = this.reports();
    if (list.length === 0) return 0;
    const sum = list.reduce(
      (acc, r) =>
        acc +
        (r.totalTasks > 0 ? (r.completedTaskIds.length / r.totalTasks) * 100 : 0),
      0,
    );
    return Math.round(sum / list.length);
  });

  readonly complianceByMachine = computed<MachineComplianceRow[]>(() => {
    const reps = this.reports();
    return this.machines().map((m) => {
      const mReps = reps.filter(
        (r) => r.machineId === m.id || r.machineCode === m.code,
      );
      if (mReps.length === 0) {
        return {
          machineId: m.id,
          code: m.code,
          name: m.name,
          reportCount: 0,
          compliancePct: 0,
        };
      }
      const avg =
        mReps.reduce(
          (acc, r) =>
            acc +
            (r.totalTasks > 0
              ? (r.completedTaskIds.length / r.totalTasks) * 100
              : 0),
          0,
        ) / mReps.length;
      return {
        machineId: m.id,
        code: m.code,
        name: m.name,
        reportCount: mReps.length,
        compliancePct: Math.round(avg),
      };
    });
  });

  readonly recentReports = computed(() => this.reports().slice(0, 5));

  goTo(path: string): void {
    void this.router.navigate([path]);
  }

  complianceBarClass(pct: number): string {
    if (pct >= 80) return 'bg-emerald-600';
    if (pct >= 50) return 'bg-[#E3AA22]';
    return 'bg-red-600';
  }

  statusLabel(status: MachineStatus): string {
    return getStatusLabel(status);
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
