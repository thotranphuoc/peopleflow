import { Injectable, inject, signal } from '@angular/core';
import { AttendanceService, CheckInPayload } from './attendance.service';
import { AuthService } from './auth.service';

const DB_NAME = 'peopleflow-offline';
const STORE = 'check-in-queue';

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly auth = inject(AuthService);
  private readonly attendance = inject(AttendanceService);

  private readonly _pendingCount = signal(0);
  readonly pendingCount = this._pendingCount.asReadonly();

  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        this.db = r.result;
        this.updatePendingCount();
        res();
      };
      r.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  private updatePendingCount(): void {
    if (!this.db) return;
    const t = this.db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).count();
    req.onsuccess = () => this._pendingCount.set(req.result);
  }

  async enqueue(payload: CheckInPayload): Promise<void> {
    await this.init();
    if (!this.db) return;
    const uid = this.auth.user()?.id;
    if (!uid) return;
    return new Promise((res, rej) => {
      const t = this.db!.transaction(STORE, 'readwrite');
      t.objectStore(STORE).add({ userId: uid, payload, at: new Date().toISOString() });
      t.oncomplete = () => {
        this.updatePendingCount();
        res();
      };
      t.onerror = () => rej(t.error);
    });
  }

  async syncAll(): Promise<{ synced: number; failed: number }> {
    await this.init();
    if (!this.db) return { synced: 0, failed: 0 };
    const items = await new Promise<{ id: number; userId: string; payload: CheckInPayload }[]>((res, rej) => {
      const t = this.db!.transaction(STORE, 'readonly');
      const req = t.objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    let synced = 0;
    let failed = 0;
    for (const item of items) {
      const { error } = await this.attendance.submitCheckIn(item.payload);
      if (error) failed++;
      else {
        synced++;
        await new Promise<void>((res, rej) => {
          const t = this.db!.transaction(STORE, 'readwrite');
          t.objectStore(STORE).delete(item.id);
          t.oncomplete = () => res();
          t.onerror = () => rej(t.error);
        });
      }
    }
    this.updatePendingCount();
    return { synced, failed };
  }
}
