import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {getApp, getApps, initializeApp} from 'firebase/app';
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../../firebase-applet-config.json';
import {createDemoMachines, createDemoReports} from '../data/tpm-demo.data';
import {
  ALLOWED_TASK_IDS,
  Machine,
  MachineDraft,
  MachineStatus,
  MaintenanceReport,
  ReportDraft,
  ShiftType,
  TaskId,
  TPM_LIMITS,
} from '../models/tpm.models';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

const LOCAL_MACHINES_KEY = 'tpm_smartassist_machines_v1';
const LOCAL_REPORTS_KEY = 'tpm_smartassist_reports_v1';
const LOCAL_OWNER_ID = 'local-operator';

@Injectable({
  providedIn: 'root',
})
export class TpmData {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private db: Firestore | null = null;
  private auth: Auth | null = null;
  private machinesUnsub: Unsubscribe | null = null;
  private reportsUnsub: Unsubscribe | null = null;

  readonly user = signal<User | null>(null);
  readonly authReady = signal<boolean>(false);
  readonly loading = signal<boolean>(true);
  readonly syncing = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly machines = signal<Machine[]>([]);
  readonly reports = signal<MaintenanceReport[]>([]);

  // Cross-module navigation state
  readonly activeLogbookMachineId = signal<string>('PRENSA-01');
  readonly editingReportId = signal<string | null>(null);

  readonly isCloudConnected = computed(() => this.user() !== null);

  readonly sortedMachines = computed(() =>
    [...this.machines()].sort((a, b) => a.code.localeCompare(b.code)),
  );

  readonly sortedReports = computed(() =>
    [...this.reports()].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    }),
  );

  constructor() {
    if (this.isBrowser) {
      this.initializeStorage();
    } else {
      this.machines.set(createDemoMachines(LOCAL_OWNER_ID));
      this.reports.set(createDemoReports(LOCAL_OWNER_ID));
      this.loading.set(false);
    }
  }

  private initializeStorage(): void {
    this.loadLocalFallback();

    try {
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      this.db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
      this.auth = getAuth(app);

      void this.testConnection();

      onAuthStateChanged(this.auth, (firebaseUser) => {
        this.user.set(firebaseUser);
        this.authReady.set(true);
        this.teardownListeners();

        if (firebaseUser) {
          void this.attachCloudWorkspace(firebaseUser);
        } else {
          this.loadLocalFallback();
          this.loading.set(false);
        }
      });
    } catch (err) {
      console.error('Error al inicializar Firebase:', err);
      this.authReady.set(true);
      this.loading.set(false);
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.db) return;
    try {
      await getDocFromServer(doc(this.db, 'test', 'connection'));
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('the client is offline')
      ) {
        console.error('Please check your Firebase configuration.');
      }
    }
  }

  private handleFirestoreError(
    error: unknown,
    operationType: OperationType,
    path: string | null,
  ): never {
    const currentUser = this.auth?.currentUser;
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: currentUser?.uid ?? null,
        email: currentUser?.email ?? null,
        emailVerified: currentUser?.emailVerified ?? null,
        isAnonymous: currentUser?.isAnonymous ?? null,
        tenantId: currentUser?.tenantId ?? null,
        providerInfo:
          currentUser?.providerData?.map((provider) => ({
            providerId: provider.providerId,
            email: provider.email,
          })) || [],
      },
      operationType,
      path,
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    this.errorMessage.set(
      'Error de sincronización con Firebase Firestore. Verifica tu conexión o permisos.',
    );
    throw new Error(JSON.stringify(errInfo));
  }

  private loadLocalFallback(): void {
    if (!this.isBrowser) return;
    try {
      const rawMachines = localStorage.getItem(LOCAL_MACHINES_KEY);
      const rawReports = localStorage.getItem(LOCAL_REPORTS_KEY);

      if (rawMachines && rawReports) {
        const parsedMachines = JSON.parse(rawMachines) as Machine[];
        const parsedReports = JSON.parse(rawReports) as MaintenanceReport[];
        if (Array.isArray(parsedMachines) && parsedMachines.length > 0) {
          this.machines.set(parsedMachines);
          this.reports.set(Array.isArray(parsedReports) ? parsedReports : []);
          this.ensureValidActiveMachine();
          this.loading.set(false);
          return;
        }
      }

      const demoMachines = createDemoMachines(LOCAL_OWNER_ID);
      const demoReports = createDemoReports(LOCAL_OWNER_ID);
      this.machines.set(demoMachines);
      this.reports.set(demoReports);
      this.persistLocal(demoMachines, demoReports);
      this.ensureValidActiveMachine();
    } catch {
      this.machines.set(createDemoMachines(LOCAL_OWNER_ID));
      this.reports.set(createDemoReports(LOCAL_OWNER_ID));
    } finally {
      this.loading.set(false);
    }
  }

  private persistLocal(
    machines: Machine[],
    reports: MaintenanceReport[],
  ): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(LOCAL_MACHINES_KEY, JSON.stringify(machines));
      localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(reports));
    } catch {
      // Ignore storage quota issues
    }
  }

  private ensureValidActiveMachine(): void {
    const list = this.machines();
    const currentId = this.activeLogbookMachineId();
    if (!list.some((m) => m.id === currentId) && list.length > 0) {
      const prensa = list.find((m) => m.code === 'PRENSA-01') ?? list[0];
      this.activeLogbookMachineId.set(prensa.id);
    }
  }

  private teardownListeners(): void {
    this.machinesUnsub?.();
    this.machinesUnsub = null;
    this.reportsUnsub?.();
    this.reportsUnsub = null;
  }

  private async attachCloudWorkspace(user: User): Promise<void> {
    if (!this.db) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.seedCloudIfEmpty(user.uid);
    } catch (error) {
      this.loading.set(false);
      this.handleFirestoreError(error, OperationType.LIST, 'machines');
    }

    const machinesQuery = query(
      collection(this.db, 'machines'),
      where('ownerId', '==', user.uid),
    );
    const reportsQuery = query(
      collection(this.db, 'reports'),
      where('ownerId', '==', user.uid),
    );

    this.machinesUnsub = onSnapshot(
      machinesQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) =>
          this.mapMachineDoc(d.id, d.data()),
        );
        this.machines.set(list);
        this.ensureValidActiveMachine();
        this.loading.set(false);
      },
      (error) => {
        this.loading.set(false);
        this.handleFirestoreError(error, OperationType.LIST, 'machines');
      },
    );

    this.reportsUnsub = onSnapshot(
      reportsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) =>
          this.mapReportDoc(d.id, d.data()),
        );
        this.reports.set(list);
      },
      (error) => {
        this.handleFirestoreError(error, OperationType.LIST, 'reports');
      },
    );
  }

  private async seedCloudIfEmpty(uid: string): Promise<void> {
    if (!this.db) return;
    const machinesCol = collection(this.db, 'machines');
    const existingMachines = await getDocs(
      query(machinesCol, where('ownerId', '==', uid)),
    );

    if (!existingMachines.empty) return;

    const demoMachines = createDemoMachines(uid);
    const demoReports = createDemoReports(uid);

    // Step 1: Write machines first so report security rule exists() succeeds
    const machineBatch = writeBatch(this.db);
    for (const m of demoMachines) {
      const ref = doc(this.db, 'machines', `${uid.slice(0, 8)}-${m.id}`);
      machineBatch.set(ref, {
        code: m.code,
        name: m.name,
        area: m.area,
        status: m.status,
        temperature: m.temperature,
        pressure: m.pressure,
        vibration: m.vibration,
        maintenancePending: m.maintenancePending,
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await machineBatch.commit();

    // Step 2: Write demo reports referencing the newly created machine IDs
    const reportBatch = writeBatch(this.db);
    for (const r of demoReports) {
      const ref = doc(this.db, 'reports', `${uid.slice(0, 8)}-${r.id}`);
      reportBatch.set(ref, {
        folio: r.folio,
        machineId: `${uid.slice(0, 8)}-${r.machineId}`,
        machineCode: r.machineCode,
        machineName: r.machineName,
        operator: r.operator,
        date: r.date,
        shift: r.shift,
        status: r.status,
        temperature: r.temperature,
        pressure: r.pressure,
        vibration: r.vibration,
        completedTaskIds: r.completedTaskIds,
        totalTasks: 5,
        observations: r.observations,
        signature: r.signature,
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await reportBatch.commit();
  }

  private mapMachineDoc(id: string, data: Record<string, unknown>): Machine {
    return {
      id,
      code: String(data['code'] ?? ''),
      name: String(data['name'] ?? ''),
      area: String(data['area'] ?? ''),
      status: (data['status'] as MachineStatus) ?? 'operando',
      temperature: Number(data['temperature'] ?? 0),
      pressure: Number(data['pressure'] ?? 0),
      vibration: Number(data['vibration'] ?? 0),
      maintenancePending: Boolean(data['maintenancePending']),
      ownerId: String(data['ownerId'] ?? ''),
      createdAt: this.timestampToIso(data['createdAt']),
      updatedAt: this.timestampToIso(data['updatedAt']),
    };
  }

  private mapReportDoc(
    id: string,
    data: Record<string, unknown>,
  ): MaintenanceReport {
    return {
      id,
      folio: String(data['folio'] ?? ''),
      machineId: String(data['machineId'] ?? ''),
      machineCode: String(data['machineCode'] ?? ''),
      machineName: String(data['machineName'] ?? ''),
      operator: String(data['operator'] ?? ''),
      date: String(data['date'] ?? ''),
      shift: (data['shift'] as ShiftType) ?? 'matutino',
      status: (data['status'] as MachineStatus) ?? 'operando',
      temperature: Number(data['temperature'] ?? 0),
      pressure: Number(data['pressure'] ?? 0),
      vibration: Number(data['vibration'] ?? 0),
      completedTaskIds: Array.isArray(data['completedTaskIds'])
        ? (data['completedTaskIds'] as TaskId[])
        : [],
      totalTasks: Number(data['totalTasks'] ?? 5),
      observations: String(data['observations'] ?? ''),
      signature: String(data['signature'] ?? ''),
      ownerId: String(data['ownerId'] ?? ''),
      createdAt: this.timestampToIso(data['createdAt']),
      updatedAt: this.timestampToIso(data['updatedAt']),
    };
  }

  private timestampToIso(value: unknown): string {
    if (value instanceof Timestamp) {
      return value.toDate().toISOString();
    }
    if (typeof value === 'string') return value;
    return new Date().toISOString();
  }

  async signInWithGoogle(): Promise<void> {
    if (!this.auth) return;
    this.errorMessage.set(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(this.auth, provider);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al iniciar sesión.';
      if (!message.includes('popup-closed-by-user')) {
        this.errorMessage.set(
          'No se pudo completar el inicio de sesión con Google.',
        );
      }
    }
  }

  async signOutUser(): Promise<void> {
    if (!this.auth) return;
    await signOut(this.auth);
  }

  clearError(): void {
    this.errorMessage.set(null);
  }

  // --- Machine CRUD ---

  private sanitizeMachineDraft(draft: MachineDraft): MachineDraft {
    const code = draft.code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '-')
      .slice(0, TPM_LIMITS.codeMax);
    return {
      code,
      name: draft.name.trim().slice(0, TPM_LIMITS.nameMax),
      area: draft.area.trim().slice(0, TPM_LIMITS.areaMax),
      status: draft.status,
      temperature: this.clampNumber(
        draft.temperature,
        TPM_LIMITS.tempMin,
        TPM_LIMITS.tempMax,
      ),
      pressure: this.clampNumber(
        draft.pressure,
        TPM_LIMITS.pressureMin,
        TPM_LIMITS.pressureMax,
      ),
      vibration: this.clampNumber(
        draft.vibration,
        TPM_LIMITS.vibrationMin,
        TPM_LIMITS.vibrationMax,
      ),
      maintenancePending: Boolean(draft.maintenancePending),
    };
  }

  async createMachine(draft: MachineDraft): Promise<Machine> {
    const clean = this.sanitizeMachineDraft(draft);
    const duplicate = this.machines().some(
      (m) => m.code.toUpperCase() === clean.code,
    );
    if (duplicate) {
      throw new Error(`El código de máquina "${clean.code}" ya está registrado.`);
    }

    const currentUser = this.user();
    const id = this.generateSafeId(`MCH-${clean.code}`);
    const nowIso = new Date().toISOString();

    if (currentUser && this.db) {
      this.syncing.set(true);
      const path = `machines/${id}`;
      try {
        await setDoc(doc(this.db, 'machines', id), {
          ...clean,
          ownerId: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return {
          id,
          ...clean,
          ownerId: currentUser.uid,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      } catch (error) {
        this.handleFirestoreError(error, OperationType.CREATE, path);
      } finally {
        this.syncing.set(false);
      }
    }

    const newMachine: Machine = {
      id,
      ...clean,
      ownerId: LOCAL_OWNER_ID,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const updatedMachines = [...this.machines(), newMachine];
    this.machines.set(updatedMachines);
    this.persistLocal(updatedMachines, this.reports());
    return newMachine;
  }

  async updateMachine(id: string, draft: MachineDraft): Promise<void> {
    const clean = this.sanitizeMachineDraft(draft);
    const duplicate = this.machines().some(
      (m) => m.id !== id && m.code.toUpperCase() === clean.code,
    );
    if (duplicate) {
      throw new Error(`El código de máquina "${clean.code}" ya está en uso.`);
    }

    const currentUser = this.user();
    const nowIso = new Date().toISOString();

    if (currentUser && this.db) {
      this.syncing.set(true);
      const path = `machines/${id}`;
      try {
        await updateDoc(doc(this.db, 'machines', id), {
          ...clean,
          updatedAt: serverTimestamp(),
        });
        return;
      } catch (error) {
        this.handleFirestoreError(error, OperationType.UPDATE, path);
      } finally {
        this.syncing.set(false);
      }
    }

    const updatedMachines = this.machines().map((m) =>
      m.id === id ? {...m, ...clean, updatedAt: nowIso} : m,
    );
    this.machines.set(updatedMachines);
    this.persistLocal(updatedMachines, this.reports());
  }

  async deleteMachine(id: string): Promise<void> {
    const currentUser = this.user();

    if (currentUser && this.db) {
      this.syncing.set(true);
      const path = `machines/${id}`;
      try {
        await deleteDoc(doc(this.db, 'machines', id));
        return;
      } catch (error) {
        this.handleFirestoreError(error, OperationType.DELETE, path);
      } finally {
        this.syncing.set(false);
      }
    }

    const updatedMachines = this.machines().filter((m) => m.id !== id);
    this.machines.set(updatedMachines);
    this.persistLocal(updatedMachines, this.reports());
    this.ensureValidActiveMachine();
  }

  // --- Maintenance Report CRUD ---

  private sanitizeReportDraft(
    draft: ReportDraft,
    machine: Machine,
  ): Omit<
    MaintenanceReport,
    'id' | 'folio' | 'ownerId' | 'createdAt' | 'updatedAt'
  > {
    const uniqueTasks = Array.from(
      new Set(
        draft.completedTaskIds.filter((t) => ALLOWED_TASK_IDS.includes(t)),
      ),
    ).slice(0, 5);

    return {
      machineId: machine.id,
      machineCode: machine.code,
      machineName: machine.name,
      operator: draft.operator.trim().slice(0, TPM_LIMITS.operatorMax),
      date: draft.date,
      shift: draft.shift,
      status: draft.status,
      temperature: this.clampNumber(
        draft.temperature,
        TPM_LIMITS.tempMin,
        TPM_LIMITS.tempMax,
      ),
      pressure: this.clampNumber(
        draft.pressure,
        TPM_LIMITS.pressureMin,
        TPM_LIMITS.pressureMax,
      ),
      vibration: this.clampNumber(
        draft.vibration,
        TPM_LIMITS.vibrationMin,
        TPM_LIMITS.vibrationMax,
      ),
      completedTaskIds: uniqueTasks,
      totalTasks: 5,
      observations: draft.observations
        .trim()
        .slice(0, TPM_LIMITS.observationsMax),
      signature: draft.signature.trim().slice(0, TPM_LIMITS.signatureMax),
    };
  }

  async createReport(draft: ReportDraft): Promise<MaintenanceReport> {
    const machine = this.machines().find((m) => m.id === draft.machineId);
    if (!machine) {
      throw new Error('La máquina seleccionada no existe.');
    }

    const clean = this.sanitizeReportDraft(draft, machine);
    const id = this.generateSafeId('REP');
    const folio = this.generateFolio();
    const nowIso = new Date().toISOString();
    const maintenancePending =
      clean.status !== 'operando' || clean.completedTaskIds.length < 5;

    const currentUser = this.user();
    if (currentUser && this.db) {
      this.syncing.set(true);
      const path = `reports/${id}`;
      try {
        await setDoc(doc(this.db, 'reports', id), {
          folio,
          ...clean,
          ownerId: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(this.db, 'machines', machine.id), {
          status: clean.status,
          temperature: clean.temperature,
          pressure: clean.pressure,
          vibration: clean.vibration,
          maintenancePending,
          updatedAt: serverTimestamp(),
        });
        return {
          id,
          folio,
          ...clean,
          ownerId: currentUser.uid,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      } catch (error) {
        this.handleFirestoreError(error, OperationType.CREATE, path);
      } finally {
        this.syncing.set(false);
      }
    }

    const newReport: MaintenanceReport = {
      id,
      folio,
      ...clean,
      ownerId: LOCAL_OWNER_ID,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const updatedReports = [newReport, ...this.reports()];
    const updatedMachines = this.machines().map((m) =>
      m.id === machine.id
        ? {
            ...m,
            status: clean.status,
            temperature: clean.temperature,
            pressure: clean.pressure,
            vibration: clean.vibration,
            maintenancePending,
            updatedAt: nowIso,
          }
        : m,
    );
    this.reports.set(updatedReports);
    this.machines.set(updatedMachines);
    this.persistLocal(updatedMachines, updatedReports);
    return newReport;
  }

  async updateReport(id: string, draft: ReportDraft): Promise<void> {
    const existingReport = this.reports().find((r) => r.id === id);
    const machine = this.machines().find(
      (m) => m.id === (existingReport?.machineId ?? draft.machineId),
    );
    if (!existingReport || !machine) {
      throw new Error('No se encontró el reporte o la máquina asociada.');
    }

    const clean = this.sanitizeReportDraft(draft, machine);
    const nowIso = new Date().toISOString();
    const currentUser = this.user();

    if (currentUser && this.db) {
      this.syncing.set(true);
      const path = `reports/${id}`;
      try {
        await updateDoc(doc(this.db, 'reports', id), {
          operator: clean.operator,
          date: clean.date,
          shift: clean.shift,
          status: clean.status,
          temperature: clean.temperature,
          pressure: clean.pressure,
          vibration: clean.vibration,
          completedTaskIds: clean.completedTaskIds,
          observations: clean.observations,
          signature: clean.signature,
          updatedAt: serverTimestamp(),
        });
        return;
      } catch (error) {
        this.handleFirestoreError(error, OperationType.UPDATE, path);
      } finally {
        this.syncing.set(false);
      }
    }

    const updatedReports = this.reports().map((r) =>
      r.id === id
        ? {
            ...r,
            operator: clean.operator,
            date: clean.date,
            shift: clean.shift,
            status: clean.status,
            temperature: clean.temperature,
            pressure: clean.pressure,
            vibration: clean.vibration,
            completedTaskIds: clean.completedTaskIds,
            observations: clean.observations,
            signature: clean.signature,
            updatedAt: nowIso,
          }
        : r,
    );
    this.reports.set(updatedReports);
    this.persistLocal(this.machines(), updatedReports);
  }

  async deleteReport(id: string): Promise<void> {
    const currentUser = this.user();

    if (currentUser && this.db) {
      this.syncing.set(true);
      const path = `reports/${id}`;
      try {
        await deleteDoc(doc(this.db, 'reports', id));
        return;
      } catch (error) {
        this.handleFirestoreError(error, OperationType.DELETE, path);
      } finally {
        this.syncing.set(false);
      }
    }

    const updatedReports = this.reports().filter((r) => r.id !== id);
    this.reports.set(updatedReports);
    this.persistLocal(this.machines(), updatedReports);
  }

  private generateFolio(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TPM-${y}${m}${d}-${rand}`;
  }

  private generateSafeId(prefix: string): string {
    const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${cleanPrefix}-${Date.now().toString(36)}-${rand}`;
  }

  private clampNumber(val: number, min: number, max: number): number {
    const num = Number(val);
    if (!Number.isFinite(num)) return min;
    return Math.min(max, Math.max(min, Math.round(num * 100) / 100));
  }
}
