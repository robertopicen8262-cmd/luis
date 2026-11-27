export type MachineStatus = 'operando' | 'detenido' | 'mantenimiento';
export type ShiftType = 'matutino' | 'vespertino' | 'nocturno';
export type TaskId =
  | 'oil'
  | 'air_filter'
  | 'lubrication'
  | 'pressure_check'
  | 'visual_inspection';

export type ConditionLevel = 'normal' | 'precaucion' | 'critico';

export interface PreventiveTaskDef {
  id: TaskId;
  label: string;
}

export const PREVENTIVE_TASKS: readonly PreventiveTaskDef[] = [
  {id: 'oil', label: 'Revisar nivel de aceite'},
  {id: 'air_filter', label: 'Limpiar filtro de aire'},
  {id: 'lubrication', label: 'Lubricar guías'},
  {id: 'pressure_check', label: 'Verificar presión'},
  {id: 'visual_inspection', label: 'Inspección visual'},
] as const;

export const ALLOWED_TASK_IDS: readonly TaskId[] = PREVENTIVE_TASKS.map((t) => t.id);

export const TPM_LIMITS = {
  codeMin: 2,
  codeMax: 30,
  codePattern: /^[A-Z0-9-]+$/,
  nameMin: 2,
  nameMax: 80,
  areaMin: 2,
  areaMax: 60,
  operatorMin: 2,
  operatorMax: 80,
  signatureMin: 2,
  signatureMax: 80,
  observationsMax: 1000,
  tempMin: -50,
  tempMax: 500,
  pressureMin: 0,
  pressureMax: 10000,
  vibrationMin: 0,
  vibrationMax: 200,
  datePattern: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
} as const;

export interface Machine {
  id: string;
  code: string;
  name: string;
  area: string;
  status: MachineStatus;
  temperature: number;
  pressure: number;
  vibration: number;
  maintenancePending: boolean;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MaintenanceReport {
  id: string;
  folio: string;
  machineId: string;
  machineCode: string;
  machineName: string;
  operator: string;
  date: string;
  shift: ShiftType;
  status: MachineStatus;
  temperature: number;
  pressure: number;
  vibration: number;
  completedTaskIds: TaskId[];
  totalTasks: number;
  observations: string;
  signature: string;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MachineDraft {
  code: string;
  name: string;
  area: string;
  status: MachineStatus;
  temperature: number;
  pressure: number;
  vibration: number;
  maintenancePending: boolean;
}

export interface ReportDraft {
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
}

export function evaluateTemperature(temp: number): ConditionLevel {
  if (temp > 85 || temp < 10) return 'critico';
  if (temp >= 75) return 'precaucion';
  return 'normal';
}

export function evaluatePressure(psi: number): ConditionLevel {
  if (psi < 90 || psi > 195) return 'critico';
  if (psi < 110 || psi > 170) return 'precaucion';
  return 'normal';
}

export function evaluateVibration(mmPerSec: number): ConditionLevel {
  if (mmPerSec > 7.0) return 'critico';
  if (mmPerSec >= 4.5) return 'precaucion';
  return 'normal';
}

export function getConditionLabel(level: ConditionLevel): string {
  switch (level) {
    case 'normal':
      return 'Normal';
    case 'precaucion':
      return 'Precaución';
    case 'critico':
      return 'Crítico';
  }
}

export function getStatusLabel(status: MachineStatus): string {
  switch (status) {
    case 'operando':
      return 'Operando';
    case 'detenido':
      return 'Detenido';
    case 'mantenimiento':
      return 'Mantenimiento';
  }
}

export function getShiftLabel(shift: ShiftType): string {
  switch (shift) {
    case 'matutino':
      return 'Matutino';
    case 'vespertino':
      return 'Vespertino';
    case 'nocturno':
      return 'Nocturno';
  }
}

export function formatLocalDateISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
