import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
  formatLocalDateISO,
  getConditionLabel,
  getStatusLabel,
  MachineStatus,
  PREVENTIVE_TASKS,
  ShiftType,
  TaskId,
  TPM_LIMITS,
} from '../../models/tpm.models';
import {TpmData} from '../../services/tpm-data';

@Component({
  selector: 'app-logbook',
  imports: [ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-[1360px] space-y-5">
      @if (saveFeedback(); as feedback) {
        <div
          class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-emerald-950"
          role="status"
        >
          <div class="flex items-center gap-3">
            <mat-icon class="text-emerald-600">check_circle</mat-icon>
            <div>
              <p class="text-sm font-semibold">
                {{ feedback.title }}
              </p>
              <p class="text-xs text-emerald-800">
                Folio: <span class="font-mono-tabular font-semibold">{{ feedback.folio }}</span>
                <span aria-hidden="true"> · </span>
                Equipo: {{ feedback.machineCode }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="goToHistory()"
              class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-100 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <mat-icon class="!text-[16px] !w-4 !h-4">history</mat-icon>
              <span>Ver en Historial</span>
            </button>
            <button
              type="button"
              (click)="dismissFeedback()"
              class="inline-flex items-center justify-center rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
              aria-label="Cerrar aviso"
            >
              <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">close</mat-icon>
            </button>
          </div>
        </div>
      }

      @if (formError(); as err) {
        <div
          class="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-900"
          role="alert"
        >
          <div class="flex items-center gap-2.5">
            <mat-icon class="text-red-600">error_outline</mat-icon>
            <span>{{ err }}</span>
          </div>
          <button
            type="button"
            (click)="formError.set(null)"
            class="rounded-lg p-1 text-red-700 hover:bg-red-100 cursor-pointer"
            aria-label="Cerrar error"
          >
            <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">close</mat-icon>
          </button>
        </div>
      }

      <form
        [formGroup]="logbookForm"
        (ngSubmit)="onSubmit()"
        class="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden"
        novalidate
      >
        <!-- Encabezado principal basado en el boceto -->
        <div class="border-b border-slate-300 bg-slate-50/90 px-5 py-4 sm:px-7">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <h1 class="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 uppercase">
                Bitácora de Mantenimiento Autónomo (TPM)
              </h1>
              <p class="mt-0.5 text-xs sm:text-sm font-medium tracking-wide text-slate-600 uppercase">
                Panel de Control <span aria-hidden="true">|</span> Indicadores de Estado de Máquina
              </p>
            </div>

            <div class="flex items-center gap-3 shrink-0">
              @if (editingReportId()) {
                <span class="text-xs font-semibold text-amber-800">
                  Editando reporte existente
                </span>
                <button
                  type="button"
                  (click)="cancelEditing()"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <mat-icon class="!text-[16px] !w-4 !h-4">close</mat-icon>
                  <span>Cancelar edición</span>
                </button>
              } @else {
                <button
                  type="button"
                  (click)="resetFormForCurrentMachine()"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <mat-icon class="!text-[16px] !w-4 !h-4">refresh</mat-icon>
                  <span>Limpiar bitácora</span>
                </button>
              }
            </div>
          </div>
        </div>

        <!-- Banda superior de información de máquina (horizontal en tablet/desktop) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 border-b border-slate-300 bg-white">
          <!-- LOGO -->
          <div class="lg:col-span-1 flex items-center justify-center gap-2 border-b sm:border-b-0 sm:border-r border-slate-300 bg-slate-50/50 px-3 py-3">
            <div class="flex flex-col items-center justify-center gap-1">
              <svg
                width="34"
                height="34"
                viewBox="0 0 36 36"
                fill="none"
                aria-hidden="true"
                class="shrink-0"
              >
                <rect x="2" y="2" width="32" height="32" rx="7" fill="#0F172A" />
                <path
                  d="M18 8L20.4 11.2L24.4 10.6L25 14.6L28.2 17L25.8 20.2L26.4 24.2L22.4 24.8L20 28L16.8 25.6L12.8 26.2L12.2 22.2L9 19.8L11.4 16.6L10.8 12.6L14.8 12L18 8Z"
                  stroke="#E3AA22"
                  stroke-width="2"
                  stroke-linejoin="round"
                />
                <circle cx="18" cy="18" r="4" fill="#D1851B" />
              </svg>
              <span class="text-[10px] font-bold tracking-widest text-slate-700 uppercase">
                LOGO
              </span>
            </div>
          </div>

          <!-- MÁQUINA -->
          <div class="lg:col-span-3 border-b lg:border-b-0 sm:border-r border-slate-300 px-4 py-3">
            <label
              for="logbook-machine"
              class="block text-[11px] font-bold tracking-wider text-slate-600 uppercase"
            >
              Máquina:
            </label>
            <select
              id="logbook-machine"
              formControlName="machineId"
              (change)="onMachineChanged()"
              class="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono-tabular text-sm font-bold text-slate-900 focus:border-[#D1851B] focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
            >
              @for (m of machines(); track m.id) {
                <option [value]="m.id">{{ m.code }} — {{ m.name }}</option>
              }
            </select>
            @if (selectedMachine(); as m) {
              <p class="mt-1 text-xs text-slate-500 truncate">
                Área: {{ m.area }}
              </p>
            }
          </div>

          <!-- OPERADOR -->
          <div class="lg:col-span-2 border-b lg:border-b-0 lg:border-r border-slate-300 px-4 py-3">
            <label
              for="logbook-operator"
              class="block text-[11px] font-bold tracking-wider text-slate-600 uppercase"
            >
              Operador: *
            </label>
            <input
              id="logbook-operator"
              type="text"
              formControlName="operator"
              placeholder="Nombre completo"
              class="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#D1851B] focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
            />
            @if (isFieldInvalid('operator')) {
              <p class="mt-1 text-xs font-medium text-red-600">
                Ingresa el nombre del operador.
              </p>
            }
          </div>

          <!-- FECHA -->
          <div class="lg:col-span-2 border-b sm:border-b-0 sm:border-r border-slate-300 px-4 py-3">
            <label
              for="logbook-date"
              class="block text-[11px] font-bold tracking-wider text-slate-600 uppercase"
            >
              Fecha: *
            </label>
            <input
              id="logbook-date"
              type="date"
              formControlName="date"
              class="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono-tabular text-sm font-medium text-slate-900 focus:border-[#D1851B] focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
            />
            @if (isFieldInvalid('date')) {
              <p class="mt-1 text-xs font-medium text-red-600">
                Selecciona la fecha.
              </p>
            }
          </div>

          <!-- TURNO -->
          <div class="lg:col-span-2 border-b sm:border-b-0 lg:border-r border-slate-300 px-4 py-3">
            <label
              for="logbook-shift"
              class="block text-[11px] font-bold tracking-wider text-slate-600 uppercase"
            >
              Turno: *
            </label>
            <select
              id="logbook-shift"
              formControlName="shift"
              class="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-[#D1851B] focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
            >
              <option value="matutino">Matutino</option>
              <option value="vespertino">Vespertino</option>
              <option value="nocturno">Nocturno</option>
            </select>
          </div>

          <!-- ESTADO -->
          <div class="lg:col-span-2 px-4 py-3 bg-slate-50/40">
            <label
              for="logbook-status"
              class="block text-[11px] font-bold tracking-wider text-slate-600 uppercase"
            >
              Estado:
            </label>
            <div class="mt-1.5 flex items-center gap-2">
              <span
                class="h-3.5 w-3.5 rounded-full shrink-0 border border-black/15"
                [class]="statusDotClass(currentStatus())"
                aria-hidden="true"
              ></span>
              <select
                id="logbook-status"
                formControlName="status"
                class="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-bold uppercase tracking-wide focus:border-[#D1851B] focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
                [class]="statusTextClass(currentStatus())"
              >
                <option value="operando">Operando</option>
                <option value="detenido">Detenido</option>
                <option value="mantenimiento">Mantenimiento</option>
              </select>
            </div>
            <p class="mt-1 text-xs text-slate-500">
              Condición: {{ getStatusLabel(currentStatus()) }}
            </p>
          </div>
        </div>

        <!-- Cuerpo principal en 2 columnas: Indicadores (izquierda) y Tareas + Observaciones (derecha) -->
        <div class="grid grid-cols-1 lg:grid-cols-12">
          <!-- COLUMNA IZQUIERDA: INDICADORES -->
          <section
            aria-labelledby="indicators-heading"
            class="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-300 bg-slate-50/60 p-5 sm:p-6"
          >
            <div class="flex items-center justify-between gap-2 mb-4">
              <h2
                id="indicators-heading"
                class="font-display text-base font-bold tracking-wide text-slate-900 uppercase"
              >
                Indicadores
              </h2>
              <span class="text-xs text-slate-500">
                Lecturas de inspección
              </span>
            </div>

            <div class="space-y-4">
              <!-- TEMPERATURA -->
              <div class="rounded-xl border border-slate-300 bg-white p-4">
                <div class="flex items-center justify-between gap-2">
                  <label
                    for="ind-temp"
                    class="text-xs font-bold tracking-wider text-slate-700 uppercase"
                  >
                    Temperatura
                  </label>
                  <span
                    class="inline-flex items-center gap-1 text-xs font-semibold"
                    [class]="conditionTextClass(tempCondition())"
                  >
                    <mat-icon class="!text-[15px] !w-[15px] !h-[15px]">{{ conditionIcon(tempCondition()) }}</mat-icon>
                    <span>{{ conditionLabel(tempCondition()) }}</span>
                  </span>
                </div>

                <div class="mt-2.5 flex items-center gap-3">
                  <input
                    id="ind-temp"
                    type="number"
                    step="0.5"
                    formControlName="temperature"
                    class="w-full min-h-[52px] rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-center font-mono-tabular text-2xl font-bold text-slate-900 focus:border-[#D1851B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
                  />
                  <span class="font-mono-tabular text-lg font-bold text-slate-700 w-14 shrink-0">
                    °C
                  </span>
                </div>
                <p class="mt-2 text-xs text-slate-500">
                  Rango normal: &lt; 75 °C
                </p>
              </div>

              <!-- PRESIÓN -->
              <div class="rounded-xl border border-slate-300 bg-white p-4">
                <div class="flex items-center justify-between gap-2">
                  <label
                    for="ind-pressure"
                    class="text-xs font-bold tracking-wider text-slate-700 uppercase"
                  >
                    Presión
                  </label>
                  <span
                    class="inline-flex items-center gap-1 text-xs font-semibold"
                    [class]="conditionTextClass(pressureCondition())"
                  >
                    <mat-icon class="!text-[15px] !w-[15px] !h-[15px]">{{ conditionIcon(pressureCondition()) }}</mat-icon>
                    <span>{{ conditionLabel(pressureCondition()) }}</span>
                  </span>
                </div>

                <div class="mt-2.5 flex items-center gap-3">
                  <input
                    id="ind-pressure"
                    type="number"
                    step="1"
                    formControlName="pressure"
                    class="w-full min-h-[52px] rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-center font-mono-tabular text-2xl font-bold text-slate-900 focus:border-[#D1851B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
                  />
                  <span class="font-mono-tabular text-lg font-bold text-slate-700 w-14 shrink-0">
                    PSI
                  </span>
                </div>
                <p class="mt-2 text-xs text-slate-500">
                  Rango normal: 110 – 170 PSI
                </p>
              </div>

              <!-- VIBRACIÓN -->
              <div class="rounded-xl border border-slate-300 bg-white p-4">
                <div class="flex items-center justify-between gap-2">
                  <label
                    for="ind-vibration"
                    class="text-xs font-bold tracking-wider text-slate-700 uppercase"
                  >
                    Vibración
                  </label>
                  <span
                    class="inline-flex items-center gap-1 text-xs font-semibold"
                    [class]="conditionTextClass(vibrationCondition())"
                  >
                    <mat-icon class="!text-[15px] !w-[15px] !h-[15px]">{{ conditionIcon(vibrationCondition()) }}</mat-icon>
                    <span>{{ conditionLabel(vibrationCondition()) }}</span>
                  </span>
                </div>

                <div class="mt-2.5 flex items-center gap-3">
                  <input
                    id="ind-vibration"
                    type="number"
                    step="0.1"
                    formControlName="vibration"
                    class="w-full min-h-[52px] rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-center font-mono-tabular text-2xl font-bold text-slate-900 focus:border-[#D1851B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
                  />
                  <span class="font-mono-tabular text-base font-bold text-slate-700 w-14 shrink-0">
                    MM/S
                  </span>
                </div>
                <p class="mt-2 text-xs text-slate-500">
                  Rango normal: &lt; 4.5 MM/S
                </p>
              </div>
            </div>
          </section>

          <!-- COLUMNA DERECHA: TAREAS PREVENTIVAS Y OBSERVACIONES -->
          <section
            aria-labelledby="tasks-heading"
            class="lg:col-span-8 flex flex-col justify-between p-5 sm:p-6 bg-white"
          >
            <div>
              <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2
                    id="tasks-heading"
                    class="font-display text-base font-bold tracking-wide text-slate-900 uppercase"
                  >
                    Tareas de Mantenimiento Preventivo (Operador)
                  </h2>
                  <p class="mt-0.5 text-xs text-slate-500">
                    Completadas:
                    <span class="font-mono-tabular font-semibold text-slate-800">
                      {{ completedTaskIds().length }} / {{ tasks.length }}
                    </span>
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    (click)="selectAllTasks()"
                    class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <mat-icon class="!text-[15px] !w-[15px] !h-[15px]">done_all</mat-icon>
                    <span>Marcar todas</span>
                  </button>
                  <button
                    type="button"
                    (click)="clearAllTasks()"
                    class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <mat-icon class="!text-[15px] !w-[15px] !h-[15px]">remove_done</mat-icon>
                    <span>Limpiar</span>
                  </button>
                </div>
              </div>

              <!-- Lista interactiva de tareas con casillas de verificación -->
              <div class="space-y-2.5" role="group" aria-label="Lista de tareas preventivas">
                @for (task of tasks; track task.id) {
                  @let checked = isTaskChecked(task.id);
                  <button
                    type="button"
                    (click)="toggleTask(task.id)"
                    [attr.aria-pressed]="checked"
                    class="w-full min-h-[52px] flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer"
                    [class]="checked
                      ? 'border-[#D1851B] bg-amber-50/60 text-slate-900'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'"
                  >
                    <div class="flex items-center gap-3.5">
                      <span
                        class="flex h-6 w-6 items-center justify-center rounded border-2 transition-colors shrink-0"
                        [class]="checked
                          ? 'border-[#D1851B] bg-[#D1851B] text-white'
                          : 'border-slate-400 bg-white text-transparent'"
                        aria-hidden="true"
                      >
                        <mat-icon class="!text-[16px] !w-4 !h-4">check</mat-icon>
                      </span>
                      <span class="text-sm sm:text-base font-semibold tracking-wide uppercase">
                        {{ task.label }}
                      </span>
                    </div>
                    <span
                      class="text-xs font-semibold shrink-0"
                      [class]="checked ? 'text-[#B45309]' : 'text-slate-400'"
                    >
                      {{ checked ? 'Realizada' : 'Pendiente' }}
                    </span>
                  </button>
                }
              </div>
            </div>

            <!-- Separador discontinuo como en el boceto -->
            <div class="my-6 border-t-2 border-dashed border-slate-300"></div>

            <!-- Área de Observaciones -->
            <div>
              <div class="flex items-center justify-between gap-2 mb-2">
                <label
                  for="logbook-observations"
                  class="text-xs sm:text-sm font-bold tracking-wider text-slate-800 uppercase"
                >
                  Observaciones:
                </label>
                <span class="font-mono-tabular text-xs text-slate-500">
                  {{ observationsLength() }} / 1000
                </span>
              </div>
              <textarea
                id="logbook-observations"
                formControlName="observations"
                rows="4"
                maxlength="1000"
                placeholder="Registra anomalías, ruidos inusuales, fugas, fallas o comentarios del turno..."
                class="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#D1851B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E3AA22]/30"
              ></textarea>
            </div>
          </section>
        </div>

        <!-- Pie de bitácora: Firma del operador + Botón GUARDAR REPORTE -->
        <div class="border-t border-slate-300 bg-slate-50 px-5 py-4 sm:px-7">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <label
                for="logbook-signature"
                class="text-xs sm:text-sm font-bold tracking-wider text-slate-800 uppercase whitespace-nowrap shrink-0"
              >
                Firma del Operador: *
              </label>
              <div class="flex-1 max-w-md">
                <input
                  id="logbook-signature"
                  type="text"
                  formControlName="signature"
                  placeholder="Nombre y firma del responsable"
                  class="w-full min-h-[44px] border-b-2 border-slate-400 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#D1851B] focus:outline-none rounded-t-md"
                />
                @if (isFieldInvalid('signature')) {
                  <p class="mt-1 text-xs font-medium text-red-600">
                    La firma o nombre del responsable es obligatoria.
                  </p>
                }
              </div>
            </div>

            <button
              type="submit"
              [disabled]="submitting()"
              class="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#D1851B] px-7 py-3 text-sm font-bold tracking-wider text-white uppercase shadow-sm transition-colors hover:bg-[#B87314] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1851B] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <mat-icon class="!text-[20px] !w-5 !h-5">save</mat-icon>
              <span>{{ editingReportId() ? 'Actualizar Reporte' : 'Guardar Reporte' }}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class Logbook {
  private readonly tpmData = inject(TpmData);
  private readonly router = inject(Router);

  readonly machines = this.tpmData.sortedMachines;
  readonly editingReportId = this.tpmData.editingReportId;
  readonly tasks = PREVENTIVE_TASKS;

  readonly completedTaskIds = signal<TaskId[]>(['oil', 'air_filter']);
  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);
  readonly saveFeedback = signal<{
    title: string;
    folio: string;
    machineCode: string;
  } | null>(null);
  readonly attemptedSubmit = signal<boolean>(false);

  readonly logbookForm = new FormGroup({
    machineId: new FormControl<string>('PRENSA-01', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    operator: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(TPM_LIMITS.operatorMin),
        Validators.maxLength(TPM_LIMITS.operatorMax),
      ],
    }),
    date: new FormControl<string>(formatLocalDateISO(), {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(TPM_LIMITS.datePattern),
      ],
    }),
    shift: new FormControl<ShiftType>('matutino', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    status: new FormControl<MachineStatus>('operando', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    temperature: new FormControl<number>(68, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(TPM_LIMITS.tempMin),
        Validators.max(TPM_LIMITS.tempMax),
      ],
    }),
    pressure: new FormControl<number>(145, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(TPM_LIMITS.pressureMin),
        Validators.max(TPM_LIMITS.pressureMax),
      ],
    }),
    vibration: new FormControl<number>(4.2, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(TPM_LIMITS.vibrationMin),
        Validators.max(TPM_LIMITS.vibrationMax),
      ],
    }),
    observations: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(TPM_LIMITS.observationsMax)],
    }),
    signature: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(TPM_LIMITS.signatureMin),
        Validators.maxLength(TPM_LIMITS.signatureMax),
      ],
    }),
  });

  // Track live form values via signals for OnPush reactivity
  readonly selectedMachineIdSignal = signal<string>('PRENSA-01');
  readonly currentStatus = signal<MachineStatus>('operando');
  readonly currentTemp = signal<number>(68);
  readonly currentPressure = signal<number>(145);
  readonly currentVibration = signal<number>(4.2);
  readonly observationsLength = signal<number>(0);

  readonly selectedMachine = computed(() =>
    this.machines().find((m) => m.id === this.selectedMachineIdSignal()) ?? null,
  );

  readonly tempCondition = computed(() =>
    evaluateTemperature(this.currentTemp()),
  );
  readonly pressureCondition = computed(() =>
    evaluatePressure(this.currentPressure()),
  );
  readonly vibrationCondition = computed(() =>
    evaluateVibration(this.currentVibration()),
  );

  constructor() {
    this.logbookForm.controls.status.valueChanges.subscribe((v) =>
      this.currentStatus.set(v),
    );
    this.logbookForm.controls.temperature.valueChanges.subscribe((v) =>
      this.currentTemp.set(Number(v) || 0),
    );
    this.logbookForm.controls.pressure.valueChanges.subscribe((v) =>
      this.currentPressure.set(Number(v) || 0),
    );
    this.logbookForm.controls.vibration.valueChanges.subscribe((v) =>
      this.currentVibration.set(Number(v) || 0),
    );
    this.logbookForm.controls.observations.valueChanges.subscribe((v) =>
      this.observationsLength.set((v ?? '').length),
    );

    effect(() => {
      const editId = this.tpmData.editingReportId();
      const reports = this.tpmData.reports();
      if (editId) {
        const rep = reports.find((r) => r.id === editId);
        if (rep) {
          this.loadReportIntoForm(rep);
        }
        return;
      }

      const activeId = this.tpmData.activeLogbookMachineId();
      const machineList = this.tpmData.sortedMachines();
      const target =
        machineList.find((m) => m.id === activeId) ??
        machineList.find((m) => m.code === 'PRENSA-01') ??
        machineList[0];

      if (target && target.id !== this.selectedMachineIdSignal()) {
        this.applyMachineToForm(target.id);
      }
    });
  }

  private loadReportIntoForm(rep: {
    machineId: string;
    operator: string;
    date: string;
    shift: ShiftType;
    status: MachineStatus;
    temperature: number;
    pressure: number;
    vibration: number;
    completedTaskIds: TaskId[];
    observations: string;
    signature: string;
  }): void {
    this.selectedMachineIdSignal.set(rep.machineId);
    this.logbookForm.patchValue({
      machineId: rep.machineId,
      operator: rep.operator,
      date: rep.date,
      shift: rep.shift,
      status: rep.status,
      temperature: rep.temperature,
      pressure: rep.pressure,
      vibration: rep.vibration,
      observations: rep.observations,
      signature: rep.signature,
    });
    this.completedTaskIds.set([...rep.completedTaskIds]);
    this.currentStatus.set(rep.status);
    this.currentTemp.set(rep.temperature);
    this.currentPressure.set(rep.pressure);
    this.currentVibration.set(rep.vibration);
    this.observationsLength.set(rep.observations.length);
  }

  private applyMachineToForm(machineId: string): void {
    const machine = this.machines().find((m) => m.id === machineId);
    if (!machine) return;
    this.selectedMachineIdSignal.set(machine.id);
    this.logbookForm.patchValue({
      machineId: machine.id,
      status: machine.status,
      temperature: machine.temperature,
      pressure: machine.pressure,
      vibration: machine.vibration,
    });
    this.currentStatus.set(machine.status);
    this.currentTemp.set(machine.temperature);
    this.currentPressure.set(machine.pressure);
    this.currentVibration.set(machine.vibration);
  }

  onMachineChanged(): void {
    const id = this.logbookForm.controls.machineId.value;
    this.tpmData.activeLogbookMachineId.set(id);
    this.applyMachineToForm(id);
  }

  isTaskChecked(id: TaskId): boolean {
    return this.completedTaskIds().includes(id);
  }

  toggleTask(id: TaskId): void {
    this.completedTaskIds.update((list) =>
      list.includes(id) ? list.filter((item) => item !== id) : [...list, id],
    );
  }

  selectAllTasks(): void {
    this.completedTaskIds.set(this.tasks.map((t) => t.id));
  }

  clearAllTasks(): void {
    this.completedTaskIds.set([]);
  }

  resetFormForCurrentMachine(): void {
    this.attemptedSubmit.set(false);
    this.formError.set(null);
    this.logbookForm.patchValue({
      operator: '',
      date: formatLocalDateISO(),
      shift: 'matutino',
      observations: '',
      signature: '',
    });
    this.completedTaskIds.set([]);
    this.applyMachineToForm(this.selectedMachineIdSignal());
  }

  cancelEditing(): void {
    this.tpmData.editingReportId.set(null);
    this.resetFormForCurrentMachine();
  }

  isFieldInvalid(
    name: 'operator' | 'date' | 'signature' | 'machineId',
  ): boolean {
    const ctrl = this.logbookForm.controls[name];
    return ctrl.invalid && (ctrl.touched || this.attemptedSubmit());
  }

  async onSubmit(): Promise<void> {
    this.attemptedSubmit.set(true);
    this.formError.set(null);
    this.saveFeedback.set(null);

    if (this.logbookForm.invalid) {
      this.logbookForm.markAllAsTouched();
      this.formError.set(
        'Completa los campos obligatorios marcados con asterisco (*) antes de guardar el reporte.',
      );
      return;
    }

    const raw = this.logbookForm.getRawValue();
    this.submitting.set(true);
    try {
      const editId = this.editingReportId();
      if (editId) {
        const existing = this.tpmData.reports().find((r) => r.id === editId);
        await this.tpmData.updateReport(editId, {
          ...raw,
          completedTaskIds: this.completedTaskIds(),
        });
        this.saveFeedback.set({
          title: 'Reporte de mantenimiento actualizado correctamente',
          folio: existing?.folio ?? editId,
          machineCode: this.selectedMachine()?.code ?? raw.machineId,
        });
        this.tpmData.editingReportId.set(null);
      } else {
        const saved = await this.tpmData.createReport({
          ...raw,
          completedTaskIds: this.completedTaskIds(),
        });
        this.saveFeedback.set({
          title: 'Reporte guardado y estado de máquina actualizado',
          folio: saved.folio,
          machineCode: saved.machineCode,
        });
      }

      this.attemptedSubmit.set(false);
      this.logbookForm.patchValue({
        observations: '',
        signature: '',
      });
    } catch (err) {
      this.formError.set(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el reporte. Intenta nuevamente.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  goToHistory(): void {
    void this.router.navigate(['/historial']);
  }

  dismissFeedback(): void {
    this.saveFeedback.set(null);
  }

  getStatusLabel(status: MachineStatus): string {
    return getStatusLabel(status);
  }

  statusDotClass(status: MachineStatus): string {
    switch (status) {
      case 'operando':
        return 'bg-emerald-600';
      case 'mantenimiento':
        return 'bg-[#E3AA22]';
      case 'detenido':
        return 'bg-red-600';
    }
  }

  statusTextClass(status: MachineStatus): string {
    switch (status) {
      case 'operando':
        return 'text-emerald-700';
      case 'mantenimiento':
        return 'text-amber-700';
      case 'detenido':
        return 'text-red-700';
    }
  }

  conditionLabel(level: ConditionLevel): string {
    return getConditionLabel(level);
  }

  conditionTextClass(level: ConditionLevel): string {
    switch (level) {
      case 'normal':
        return 'text-emerald-700';
      case 'precaucion':
        return 'text-amber-700';
      case 'critico':
        return 'text-red-700';
    }
  }

  conditionIcon(level: ConditionLevel): string {
    switch (level) {
      case 'normal':
        return 'check_circle';
      case 'precaucion':
        return 'warning';
      case 'critico':
        return 'error';
    }
  }
}
