import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {Router} from '@angular/router';
import {
  ConditionLevel,
  evaluatePressure,
  evaluateTemperature,
  evaluateVibration,
  getConditionLabel,
  getStatusLabel,
  Machine,
  MachineStatus,
  TPM_LIMITS,
} from '../../models/tpm.models';
import {TpmData} from '../../services/tpm-data';

type StatusFilter = 'todas' | MachineStatus;

@Component({
  selector: 'app-machinery',
  imports: [ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-[1360px] space-y-5">
      <!-- Barra superior de control -->
      <div class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-300 bg-white px-5 py-4 shadow-sm">
        <div>
          <h1 class="font-display text-xl font-bold tracking-tight text-slate-900">
            Gestión de Maquinaria
          </h1>
          <p class="mt-0.5 text-sm text-slate-600">
            Catálogo de equipos industriales, códigos únicos y parámetros de condición
          </p>
        </div>

        <button
          type="button"
          (click)="openCreateForm()"
          class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#D1851B] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#B87314] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <mat-icon class="!text-[20px] !w-5 !h-5">add_circle_outline</mat-icon>
          <span>Registrar Máquina</span>
        </button>
      </div>

      <!-- Formulario de registro / edición -->
      @if (formOpen()) {
        <section
          aria-labelledby="machine-form-title"
          class="rounded-2xl border border-slate-300 bg-white p-5 sm:p-6 shadow-sm"
        >
          <div class="flex items-center justify-between gap-4 border-b border-slate-200 pb-3 mb-5">
            <h2 id="machine-form-title" class="font-display text-lg font-bold text-slate-900">
              {{ editingMachineId() ? 'Editar Equipo Registrado' : 'Registrar Nueva Máquina' }}
            </h2>
            <button
              type="button"
              (click)="closeForm()"
              class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <mat-icon class="!text-[16px] !w-4 !h-4">close</mat-icon>
              <span>Cerrar</span>
            </button>
          </div>

          @if (formError(); as err) {
            <div
              class="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
              role="alert"
            >
              <mat-icon class="text-red-600">error_outline</mat-icon>
              <span>{{ err }}</span>
            </div>
          }

          <form [formGroup]="machineForm" (ngSubmit)="saveMachine()" novalidate>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  for="m-code"
                  class="block text-xs font-bold tracking-wider text-slate-700 uppercase"
                >
                  Código Único *
                </label>
                <input
                  id="m-code"
                  type="text"
                  formControlName="code"
                  placeholder="Ej. PRENSA-02"
                  class="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm font-semibold uppercase text-slate-900 focus:border-[#D1851B] focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
                />
                @if (isInvalid('code')) {
                  <p class="mt-1 text-xs text-red-600">
                    Código requerido (solo letras mayúsculas, números y guiones).
                  </p>
                }
              </div>

              <div>
                <label
                  for="m-name"
                  class="block text-xs font-bold tracking-wider text-slate-700 uppercase"
                >
                  Nombre del Equipo *
                </label>
                <input
                  id="m-name"
                  type="text"
                  formControlName="name"
                  placeholder="Ej. Prensa Hidráulica 02"
                  class="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#D1851B] focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
                />
                @if (isInvalid('name')) {
                  <p class="mt-1 text-xs text-red-600">
                    Nombre requerido (mínimo 2 caracteres).
                  </p>
                }
              </div>

              <div>
                <label
                  for="m-area"
                  class="block text-xs font-bold tracking-wider text-slate-700 uppercase"
                >
                  Área / Línea *
                </label>
                <input
                  id="m-area"
                  type="text"
                  formControlName="area"
                  placeholder="Ej. Estampado Línea A"
                  class="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#D1851B] focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
                />
                @if (isInvalid('area')) {
                  <p class="mt-1 text-xs text-red-600">
                    Área requerida.
                  </p>
                }
              </div>

              <div>
                <label
                  for="m-status"
                  class="block text-xs font-bold tracking-wider text-slate-700 uppercase"
                >
                  Estado Operativo *
                </label>
                <select
                  id="m-status"
                  formControlName="status"
                  class="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-[#D1851B] focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
                >
                  <option value="operando">Operando</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="detenido">Detenido</option>
                </select>
              </div>

              <div>
                <label
                  for="m-temp"
                  class="block text-xs font-bold tracking-wider text-slate-700 uppercase"
                >
                  Temperatura (°C) *
                </label>
                <input
                  id="m-temp"
                  type="number"
                  step="0.5"
                  formControlName="temperature"
                  class="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm font-semibold text-slate-900 focus:border-[#D1851B] focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
                />
              </div>

              <div>
                <label
                  for="m-pressure"
                  class="block text-xs font-bold tracking-wider text-slate-700 uppercase"
                >
                  Presión (PSI) *
                </label>
                <input
                  id="m-pressure"
                  type="number"
                  step="1"
                  formControlName="pressure"
                  class="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm font-semibold text-slate-900 focus:border-[#D1851B] focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
                />
              </div>

              <div>
                <label
                  for="m-vibration"
                  class="block text-xs font-bold tracking-wider text-slate-700 uppercase"
                >
                  Vibración (MM/S) *
                </label>
                <input
                  id="m-vibration"
                  type="number"
                  step="0.1"
                  formControlName="vibration"
                  class="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm font-semibold text-slate-900 focus:border-[#D1851B] focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
                />
              </div>

              <div class="flex items-end pb-1">
                <label class="flex min-h-[42px] w-full items-center gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    formControlName="maintenancePending"
                    class="h-4 w-4 accent-[#D1851B]"
                  />
                  <span class="text-sm font-medium text-slate-800">
                    Mantenimiento pendiente
                  </span>
                </label>
              </div>
            </div>

            <div class="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                (click)="closeForm()"
                class="min-h-[42px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="saving()"
                class="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#D1851B] px-5 py-2 text-sm font-bold text-white hover:bg-[#B87314] disabled:opacity-50 cursor-pointer"
              >
                <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">save</mat-icon>
                <span>{{ editingMachineId() ? 'Guardar Cambios' : 'Crear Máquina' }}</span>
              </button>
            </div>
          </form>
        </section>
      }

      <!-- Filtros y búsqueda -->
      <div class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-300 bg-white px-5 py-3.5 shadow-sm">
        <div class="relative flex-1 min-w-[240px] max-w-md">
          <mat-icon class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 !text-[20px] !w-5 !h-5">
            search
          </mat-icon>
          <input
            type="search"
            [value]="searchTerm()"
            (input)="onSearchInput($event)"
            placeholder="Buscar por código, nombre o área..."
            aria-label="Buscar máquina"
            class="w-full min-h-[42px] rounded-lg border border-slate-300 bg-slate-50 pl-10 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#D1851B] focus:bg-white focus:outline-none"
          />
        </div>

        <div class="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Filtrar por estado">
          @for (opt of statusFilters; track opt.value) {
            <button
              type="button"
              (click)="statusFilter.set(opt.value)"
              class="rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              [class]="statusFilter() === opt.value
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'"
            >
              {{ opt.label }}
            </button>
          }
        </div>
      </div>

      <!-- Catálogo de máquinas -->
      @if (filteredMachines().length === 0) {
        <div class="rounded-2xl border border-slate-300 bg-white p-10 text-center shadow-sm">
          <mat-icon class="!text-[40px] !w-10 !h-10 text-slate-400">precision_manufacturing</mat-icon>
          <h2 class="mt-3 font-display text-lg font-bold text-slate-900">
            No se encontraron máquinas
          </h2>
          <p class="mt-1 text-sm text-slate-600">
            Ajusta los filtros de búsqueda o registra un nuevo equipo en el inventario.
          </p>
          <button
            type="button"
            (click)="openCreateForm()"
            class="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#D1851B] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#B87314] cursor-pointer"
          >
            <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">add</mat-icon>
            <span>Registrar Máquina</span>
          </button>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (m of filteredMachines(); track m.id) {
            <article class="flex flex-col justify-between rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
              <div>
                <!-- Encabezado de máquina -->
                <div class="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 text-xs text-slate-500">
                      <span class="font-mono-tabular font-bold text-slate-900">
                        {{ m.code }}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span class="truncate">{{ m.area }}</span>
                    </div>
                    <h2 class="mt-1 font-display text-lg font-bold text-slate-900 truncate">
                      {{ m.name }}
                    </h2>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0">
                    <mat-icon
                      class="!text-[18px] !w-[18px] !h-[18px]"
                      [class]="statusIconClass(m.status)"
                    >
                      {{ statusIcon(m.status) }}
                    </mat-icon>
                    <span
                      class="text-xs font-bold uppercase tracking-wide"
                      [class]="statusTextClass(m.status)"
                    >
                      {{ statusLabel(m.status) }}
                    </span>
                  </div>
                </div>

                <!-- Indicadores de condición de la máquina -->
                <div class="mt-4 grid grid-cols-3 gap-3">
                  @let tCond = evalTemp(m.temperature);
                  <div class="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                    <p class="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                      Temp.
                    </p>
                    <p class="mt-1 font-mono-tabular text-lg font-bold text-slate-900">
                      {{ m.temperature }} <span class="text-xs font-semibold text-slate-600">°C</span>
                    </p>
                    <p class="mt-0.5 text-[11px] font-semibold" [class]="conditionClass(tCond)">
                      {{ conditionText(tCond) }}
                    </p>
                  </div>

                  @let pCond = evalPressure(m.pressure);
                  <div class="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                    <p class="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                      Presión
                    </p>
                    <p class="mt-1 font-mono-tabular text-lg font-bold text-slate-900">
                      {{ m.pressure }} <span class="text-xs font-semibold text-slate-600">PSI</span>
                    </p>
                    <p class="mt-0.5 text-[11px] font-semibold" [class]="conditionClass(pCond)">
                      {{ conditionText(pCond) }}
                    </p>
                  </div>

                  @let vCond = evalVibration(m.vibration);
                  <div class="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                    <p class="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                      Vibración
                    </p>
                    <p class="mt-1 font-mono-tabular text-lg font-bold text-slate-900">
                      {{ m.vibration }} <span class="text-xs font-semibold text-slate-600">MM/S</span>
                    </p>
                    <p class="mt-0.5 text-[11px] font-semibold" [class]="conditionClass(vCond)">
                      {{ conditionText(vCond) }}
                    </p>
                  </div>
                </div>

                @if (m.maintenancePending) {
                  <p class="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                    <mat-icon class="!text-[16px] !w-4 !h-4 text-[#D1851B]">schedule</mat-icon>
                    <span>Mantenimiento autónomo pendiente</span>
                  </p>
                }
              </div>

              <!-- Acciones -->
              <div class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3.5">
                <button
                  type="button"
                  (click)="openInLogbook(m.id)"
                  class="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <mat-icon class="!text-[16px] !w-4 !h-4">assignment</mat-icon>
                  <span>Abrir en Bitácora</span>
                </button>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    (click)="openEditForm(m)"
                    class="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <mat-icon class="!text-[16px] !w-4 !h-4">edit</mat-icon>
                    <span>Editar</span>
                  </button>

                  @if (confirmDeleteId() === m.id) {
                    <button
                      type="button"
                      (click)="confirmDelete(m.id)"
                      class="inline-flex min-h-[40px] items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <mat-icon class="!text-[16px] !w-4 !h-4">delete_forever</mat-icon>
                      <span>Confirmar</span>
                    </button>
                    <button
                      type="button"
                      (click)="confirmDeleteId.set(null)"
                      class="inline-flex min-h-[40px] items-center rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      No
                    </button>
                  } @else {
                    <button
                      type="button"
                      (click)="confirmDeleteId.set(m.id)"
                      class="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <mat-icon class="!text-[16px] !w-4 !h-4">delete_outline</mat-icon>
                      <span>Eliminar</span>
                    </button>
                  }
                </div>
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
})
export class Machinery {
  private readonly tpmData = inject(TpmData);
  private readonly router = inject(Router);

  readonly machines = this.tpmData.sortedMachines;
  readonly searchTerm = signal<string>('');
  readonly statusFilter = signal<StatusFilter>('todas');
  readonly formOpen = signal<boolean>(false);
  readonly editingMachineId = signal<string | null>(null);
  readonly confirmDeleteId = signal<string | null>(null);
  readonly saving = signal<boolean>(false);
  readonly formError = signal<string | null>(null);
  readonly attemptedSubmit = signal<boolean>(false);

  readonly statusFilters: readonly {value: StatusFilter; label: string}[] = [
    {value: 'todas', label: 'Todas'},
    {value: 'operando', label: 'Operando'},
    {value: 'mantenimiento', label: 'Mantenimiento'},
    {value: 'detenido', label: 'Detenido'},
  ];

  readonly filteredMachines = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    return this.machines().filter((m) => {
      if (status !== 'todas' && m.status !== status) return false;
      if (!term) return true;
      return (
        m.code.toLowerCase().includes(term) ||
        m.name.toLowerCase().includes(term) ||
        m.area.toLowerCase().includes(term)
      );
    });
  });

  readonly machineForm = new FormGroup({
    code: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(TPM_LIMITS.codeMin),
        Validators.maxLength(TPM_LIMITS.codeMax),
        Validators.pattern(TPM_LIMITS.codePattern),
      ],
    }),
    name: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(TPM_LIMITS.nameMin),
        Validators.maxLength(TPM_LIMITS.nameMax),
      ],
    }),
    area: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(TPM_LIMITS.areaMin),
        Validators.maxLength(TPM_LIMITS.areaMax),
      ],
    }),
    status: new FormControl<MachineStatus>('operando', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    temperature: new FormControl<number>(65, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(TPM_LIMITS.tempMin),
        Validators.max(TPM_LIMITS.tempMax),
      ],
    }),
    pressure: new FormControl<number>(140, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(TPM_LIMITS.pressureMin),
        Validators.max(TPM_LIMITS.pressureMax),
      ],
    }),
    vibration: new FormControl<number>(3.5, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(TPM_LIMITS.vibrationMin),
        Validators.max(TPM_LIMITS.vibrationMax),
      ],
    }),
    maintenancePending: new FormControl<boolean>(false, {nonNullable: true}),
  });

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  openCreateForm(): void {
    this.editingMachineId.set(null);
    this.formError.set(null);
    this.attemptedSubmit.set(false);
    this.machineForm.reset({
      code: '',
      name: '',
      area: '',
      status: 'operando',
      temperature: 65,
      pressure: 140,
      vibration: 3.5,
      maintenancePending: false,
    });
    this.formOpen.set(true);
  }

  openEditForm(machine: Machine): void {
    this.editingMachineId.set(machine.id);
    this.formError.set(null);
    this.attemptedSubmit.set(false);
    this.machineForm.reset({
      code: machine.code,
      name: machine.name,
      area: machine.area,
      status: machine.status,
      temperature: machine.temperature,
      pressure: machine.pressure,
      vibration: machine.vibration,
      maintenancePending: machine.maintenancePending,
    });
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingMachineId.set(null);
    this.formError.set(null);
  }

  isInvalid(field: 'code' | 'name' | 'area'): boolean {
    const ctrl = this.machineForm.controls[field];
    return ctrl.invalid && (ctrl.touched || this.attemptedSubmit());
  }

  async saveMachine(): Promise<void> {
    this.attemptedSubmit.set(true);
    this.formError.set(null);

    // Normalize code to uppercase before validation
    const rawCode = this.machineForm.controls.code.value.trim().toUpperCase();
    this.machineForm.controls.code.setValue(rawCode);

    if (this.machineForm.invalid) {
      this.machineForm.markAllAsTouched();
      this.formError.set(
        'Revisa los campos obligatorios. El código único solo permite mayúsculas, números y guiones.',
      );
      return;
    }

    const raw = this.machineForm.getRawValue();
    this.saving.set(true);
    try {
      const editId = this.editingMachineId();
      if (editId) {
        await this.tpmData.updateMachine(editId, raw);
      } else {
        await this.tpmData.createMachine(raw);
      }
      this.closeForm();
    } catch (err) {
      this.formError.set(
        err instanceof Error ? err.message : 'No se pudo guardar la máquina.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  async confirmDelete(id: string): Promise<void> {
    await this.tpmData.deleteMachine(id);
    this.confirmDeleteId.set(null);
  }

  openInLogbook(machineId: string): void {
    this.tpmData.editingReportId.set(null);
    this.tpmData.activeLogbookMachineId.set(machineId);
    void this.router.navigate(['/bitacora']);
  }

  evalTemp(v: number): ConditionLevel {
    return evaluateTemperature(v);
  }
  evalPressure(v: number): ConditionLevel {
    return evaluatePressure(v);
  }
  evalVibration(v: number): ConditionLevel {
    return evaluateVibration(v);
  }

  conditionText(level: ConditionLevel): string {
    return getConditionLabel(level);
  }

  conditionClass(level: ConditionLevel): string {
    switch (level) {
      case 'normal':
        return 'text-emerald-700';
      case 'precaucion':
        return 'text-amber-700';
      case 'critico':
        return 'text-red-700';
    }
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

  statusIconClass(status: MachineStatus): string {
    switch (status) {
      case 'operando':
        return 'text-emerald-600';
      case 'mantenimiento':
        return 'text-[#D1851B]';
      case 'detenido':
        return 'text-red-600';
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
