import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { AttendancePenaltyService } from './attendance-penalty.service';
import { CompaniesService } from './companies.service';
import { EmployeeService } from './employee.service';
import { environment } from '../../../environments/environment';
import type { Attendance } from '../models';

const DEFAULT_OFFICE = environment.officeLocation;

export interface OfficeLocation {
  lat: number;
  lng: number;
  radiusMeters: number;
}

/** Khoảng cách (m) giữa 2 điểm theo Haversine. */
function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface CheckInPayload {
  workDate: string; // YYYY-MM-DD
  photoFile?: File | Blob;
  lat?: number;
  lng?: number;
  isCheckOut?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly companiesService = inject(CompaniesService);
  private readonly employeeService = inject(EmployeeService);
  private readonly penaltyService = inject(AttendancePenaltyService);

  private readonly _attendances = signal<Attendance[]>([]);
  readonly attendances = this._attendances.asReadonly();
  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  /** Lấy vị trí văn phòng từ công ty của nhân viên (admin set) hoặc env. */
  async getOfficeLocation(): Promise<OfficeLocation> {
    const emp = this.employeeService.currentEmployee();
    const companyId = emp?.company_id;
    if (companyId) {
      const company = await this.companiesService.get(companyId);
      if (company?.check_in_lat != null && company?.check_in_lng != null) {
        return {
          lat: company.check_in_lat,
          lng: company.check_in_lng,
          radiusMeters: company.check_in_radius_meters ?? 50,
        };
      }
    }
    return {
      lat: DEFAULT_OFFICE.lat,
      lng: DEFAULT_OFFICE.lng,
      radiusMeters: DEFAULT_OFFICE.radiusMeters ?? 50,
    };
  }

  /** Kiểm tra GPS có trong vùng văn phòng không. */
  isWithinOffice(lat: number, lng: number, office?: OfficeLocation): boolean {
    const o = office ?? {
      lat: DEFAULT_OFFICE.lat,
      lng: DEFAULT_OFFICE.lng,
      radiusMeters: DEFAULT_OFFICE.radiusMeters ?? 50,
    };
    return distanceMeters(o.lat, o.lng, lat, lng) <= o.radiusMeters;
  }

  /** Upload ảnh selfie, trả về path (bucket private nên dùng signed URL khi hiển thị). */
  private async uploadCheckInPhoto(file: Blob, employeeId: string, date: string, suffix: string): Promise<string | null> {
    if (!file || file.size === 0) return null;
    const path = `${employeeId}/${date}-${suffix}.jpg`;
    const { error } = await this.supabase.supabase.storage
      .from('check-in-photos')
      .upload(path, file, { contentType: 'image/jpeg', upsert: true });
    if (error) {
      console.warn('[uploadCheckInPhoto]', error.message, error);
      return null;
    }
    return path;
  }

  /** Lấy signed URL cho ảnh check-in (bucket private). pathOrUrl: path hoặc URL cũ. */
  async getSignedPhotoUrl(pathOrUrl: string): Promise<string | null> {
    const path = this.extractStoragePath(pathOrUrl);
    if (!path) return null;
    const { data, error } = await this.supabase.supabase.storage
      .from('check-in-photos')
      .createSignedUrl(path, 3600);
    if (error) return null;
    return data?.signedUrl ?? null;
  }

  private extractStoragePath(pathOrUrl: string): string | null {
    if (!pathOrUrl?.trim()) return null;
    const s = pathOrUrl.trim();
    const match = s.match(/check-in-photos\/(.+)$/);
    if (match) return match[1];
    if (s.includes('/') && !s.startsWith('http')) return s;
    return null;
  }

  /** Nén ảnh nhỏ (chỉ tham khảo): resize max 480px, target 60KB. */
  private async compressCheckInPhoto(file: File | Blob): Promise<Blob> {
    const img = await createImageBitmap(file as Blob);
    const maxBytes = 60 * 1024;
    const maxSize = 480;
    let w = img.width;
    let h = img.height;
    if (w > maxSize || h > maxSize) {
      if (w > h) {
        h = Math.round((h * maxSize) / w);
        w = maxSize;
      } else {
        w = Math.round((w * maxSize) / h);
        h = maxSize;
      }
    }
    let quality = 0.5;
    let blob: Blob = await new Promise((res) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) {
        res(file as Blob);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      c.toBlob(
        (b) => res(b ?? (file as Blob)),
        'image/jpeg',
        quality
      );
    });
    while (blob.size > maxBytes && quality > 0.2) {
      quality -= 0.1;
      blob = await new Promise((res) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) {
          res(blob);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        c.toBlob((b) => res(b ?? blob), 'image/jpeg', quality);
      });
    }
    return blob;
  }

  async submitCheckIn(payload: CheckInPayload): Promise<{ error: string | null }> {
    const userId = this.auth.user()?.id;
    if (!userId) return { error: 'Chưa đăng nhập' };

    const office = await this.getOfficeLocation();
    const lat = payload.lat ?? office.lat;
    const lng = payload.lng ?? office.lng;
    const isValidLocation = this.isWithinOffice(lat, lng, office);
    const now = new Date().toISOString();
    const latLngStr = `${lat},${lng}`;

    let photoUrl: string | null = null;
    if (payload.photoFile) {
      const compressed = await this.compressCheckInPhoto(payload.photoFile);
      photoUrl = await this.uploadCheckInPhoto(
        compressed,
        userId,
        payload.workDate,
        payload.isCheckOut ? 'out' : 'in'
      );
    }

    if (payload.isCheckOut) {
      const { error } = await this.supabase.supabase
        .from('attendances')
        .update({ check_out_time: now, check_out_photo_url: photoUrl })
        .eq('employee_id', userId)
        .eq('work_date', payload.workDate);
      if (error) return { error: error.message };
      void this.penaltyService.applyShortfallForDay(userId, payload.workDate);
    } else {
      const { error } = await this.supabase.supabase.from('attendances').upsert(
        {
          employee_id: userId,
          work_date: payload.workDate,
          check_in_time: now,
          check_in_photo_url: photoUrl,
          check_in_lat_lng: latLngStr,
          is_valid_location: isValidLocation,
          status: 'pending',
        },
        { onConflict: 'employee_id,work_date' }
      );
      if (error) return { error: error.message };
    }

    await this.loadMonth(userId, payload.workDate.slice(0, 7));
    return { error: null };
  }

  /**
   * Bổ sung chấm công cho ngày quên: ghi nhận giờ vào/ra thủ công (không ảnh, không GPS).
   * checkInTime / checkOutTime dạng "HH:mm". reason: lý do do NV nhập (Manager xem khi duyệt).
   */
  async submitManualAttendance(
    workDate: string,
    checkInTime: string,
    checkOutTime: string,
    reason?: string | null
  ): Promise<{ error: string | null }> {
    const userId = this.auth.user()?.id;
    if (!userId) return { error: 'Chưa đăng nhập' };

    const [y, m, d] = workDate.split('-').map(Number);
    const [inH, inMin] = checkInTime.split(':').map(Number);
    const [outH, outMin] = checkOutTime.split(':').map(Number);
    const checkInIso = new Date(y, m - 1, d, inH ?? 0, inMin ?? 0, 0).toISOString();
    const checkOutIso = new Date(y, m - 1, d, outH ?? 0, outMin ?? 0, 0).toISOString();

    const payload: Record<string, unknown> = {
      employee_id: userId,
      work_date: workDate,
      check_in_time: checkInIso,
      check_out_time: checkOutIso,
      is_valid_location: true,
      status: 'pending',
    };
    if (reason != null) payload['supplement_reason'] = reason;
    const { error } = await this.supabase.supabase.from('attendances').upsert(payload, {
      onConflict: 'employee_id,work_date',
    });
    if (error) return { error: error.message };

    void this.penaltyService.applyShortfallForDay(userId, workDate);
    await this.loadMonth(userId, workDate.slice(0, 7));
    return { error: null };
  }

  async loadMonth(employeeId: string, yearMonth: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    const [y, m] = yearMonth.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data, error } = await this.supabase.supabase
      .from('attendances')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('work_date', start)
      .lte('work_date', end)
      .order('work_date');

    this._loading.set(false);
    if (error) {
      this._error.set(error.message);
      this._attendances.set([]);
      return;
    }
    this._attendances.set((data ?? []) as Attendance[]);
  }
}
