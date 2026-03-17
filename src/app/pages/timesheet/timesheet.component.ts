import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { AttendanceService } from '../../core/services/attendance.service';
import { AttendanceConfigService } from '../../core/services/attendance-config.service';
import { HolidayService } from '../../core/services/holiday.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
import { SupplementFormDialogComponent, type SupplementFormDialogData } from './supplement-form-dialog.component';
import { DayDetailDialogComponent, type DayDetailDialogData } from './day-detail-dialog.component';
import {
  CameraCaptureDialogComponent,
  type CameraCaptureResult,
} from './camera-capture-dialog.component';
import { PhotoViewerDialogComponent } from './photo-viewer-dialog.component';
import { CheckInPhotoComponent } from './check-in-photo.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { AttendanceHeatmapService } from '../../core/services/attendance-heatmap.service';
import type { Attendance, AttendanceStatus } from '../../core/models';

/** Phút làm thực tế (trừ nghỉ trưa). */
function effectiveMinutes(
  checkInIso: string,
  checkOutIso: string,
  lunchStartMinutes: number,
  lunchEndMinutes: number
): number {
  const start = new Date(checkInIso);
  const end = new Date(checkOutIso);
  let startM = start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60;
  let endM = end.getHours() * 60 + end.getMinutes() + end.getSeconds() / 60;
  if (start.getDate() !== end.getDate()) endM += 24 * 60;
  let work = endM - startM;
  const overlapStart = Math.max(startM, lunchStartMinutes);
  const overlapEnd = Math.min(endM, lunchEndMinutes);
  if (overlapEnd > overlapStart) work -= overlapEnd - overlapStart;
  return Math.round(Math.max(0, work));
}

@Component({
  selector: 'app-timesheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, MatIconModule, CheckInPhotoComponent],
  templateUrl: './timesheet.html',
  styleUrl: './timesheet.scss',
})
export class TimesheetComponent implements OnInit {
  private readonly auth = inject(AuthService);
  protected readonly attendanceService = inject(AttendanceService);
  private readonly attendanceConfig = inject(AttendanceConfigService);
  private readonly holidayService = inject(HolidayService);
  private readonly offlineQueue = inject(OfflineQueueService);
  private readonly dialog = inject(MatDialog);
  private readonly heatmapService = inject(AttendanceHeatmapService);

  /** Nghỉ trưa (phút từ 0h). Mặc định 12:00–13:30. */
  protected readonly lunchMinutes = signal<{ start: number; end: number }>({ start: 720, end: 810 });
  /** Số phút làm tối đa tính cho 1 ngày (cap giờ làm). */
  private readonly requiredMinutesPerDay = signal(480);

  protected readonly capturing = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly locationWarning = signal<string | null>(null);
  /** Tọa độ khi cảnh báo ngoài vùng (để mở Maps). */
  protected readonly locationWarningCoords = signal<{ lat: number; lng: number } | null>(null);
  /** Tăng sau mỗi lần upload ảnh thành công → ép CheckInPhoto re-fetch signed URL. */
  protected readonly photoRefreshTrigger = signal(0);
  protected readonly currentYearMonth = signal<string>(this.getCurrentYearMonth());

  protected readonly attendances = this.attendanceService.attendances;
  protected readonly loading = this.attendanceService.loading;
  /** Map ngày nghỉ phép đã duyệt trong tháng hiện tại → label loại nghỉ. */
  protected readonly leaveByDate = signal<Record<string, string>>({});

  protected readonly todayRecord = computed(() => {
    const list = this.attendances();
    const today = new Date().toISOString().slice(0, 10);
    return list.find((a) => a.work_date === today) ?? null;
  });

  /** Tuần bắt đầu từ T2, CN ở cột cuối. */
  protected readonly weekdayHeader = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  protected readonly calendarDays = computed(() => {
    const ym = this.currentYearMonth();
    const [y, m] = ym.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    /** Số ô trống đầu tháng để ngày 1 rơi đúng cột (T2=0, CN=6). */
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = last.getDate();
    const list = this.attendances();
    const map = new Map<string, Attendance>();
    list.forEach((a) => map.set(a.work_date, a));
    const holidayMap = this.holidayService.holidayMapForMonth();
    const leaveMap = this.leaveByDate();
    const days: {
      key: string;
      date: string;
      day: number;
      status: AttendanceStatus | null;
      isToday: boolean;
      check_in_time: string | null;
      check_out_time: string | null;
      check_in_photo_url: string | null;
      check_out_photo_url: string | null;
      durationLabel: string | null;
      effectiveMinutes: number | null;
      holidayName: string | null;
      canSupplement: boolean;
      leaveLabel: string | null;
      /** Lý do cần duyệt khi status === 'pending' */
      pendingReason: string | null;
    }[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const lunch = this.lunchMinutes();
    for (let i = 0; i < startPad; i++) {
      days.push({
        key: `pad-${i}`,
        date: '',
        day: 0,
        status: null,
        isToday: false,
        check_in_time: null,
        check_out_time: null,
        check_in_photo_url: null,
        check_out_photo_url: null,
        durationLabel: null,
        effectiveMinutes: null,
        holidayName: null,
        canSupplement: false,
        leaveLabel: null,
        pendingReason: null,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const rec = map.get(date);
      let durationLabel: string | null = null;
      let effMin: number | null = null;
      if (rec?.check_in_time && rec?.check_out_time) {
        const raw = effectiveMinutes(rec.check_in_time, rec.check_out_time, lunch.start, lunch.end);
        const cap = this.requiredMinutesPerDay();
        effMin = Math.min(cap, raw);
        const h = Math.floor(effMin / 60);
        const mMin = effMin % 60;
        durationLabel = mMin > 0 ? `${h}h ${mMin}m` : `${h}h`;
      }
      const holidayName = holidayMap.get(date) ?? null;
      const leaveLabel = leaveMap[date] ?? null;
      const isPastOrToday = date <= todayStr;
      const dayOfWeek = new Date(date + 'T12:00:00').getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isLeave = !!leaveLabel;
      const needsSupplement =
        isPastOrToday && !holidayName && !isWeekend && !isLeave && (!rec || !rec.check_out_time);
      let pendingReason: string | null = null;
      if (rec?.status === 'pending') {
        const parts: string[] = [];
        if (rec.is_valid_location === false) parts.push('Ngoài khu vực VP');
        if (rec.supplement_reason?.trim()) parts.push('Bổ sung thủ công');
        pendingReason = parts.length ? parts.join('; ') : 'Chờ duyệt';
      }
      days.push({
        key: date,
        date,
        day: d,
        status: rec?.status ?? null,
        isToday: date === todayStr,
        check_in_time: rec?.check_in_time ?? null,
        check_out_time: rec?.check_out_time ?? null,
        check_in_photo_url: rec?.check_in_photo_url ?? null,
        check_out_photo_url: rec?.check_out_photo_url ?? null,
        durationLabel,
        effectiveMinutes: effMin,
        holidayName,
        canSupplement: needsSupplement,
        leaveLabel,
        pendingReason,
      });
    }
    return days;
  });

  private getCurrentYearMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  ngOnInit(): void {
    const uid = this.auth.user()?.id;
    const ym = this.currentYearMonth();
    if (uid) {
      this.attendanceService.loadMonth(uid, ym);
      const [y, m] = ym.split('-').map(Number);
      void this.loadLeaveForMonth(uid, y, m);
    }
    const [y, m] = ym.split('-').map(Number);
    this.holidayService.loadForMonth(y, m);
    this.attendanceConfig.get().then((cfg) => {
      if (cfg?.lunch_start_time && cfg?.lunch_end_time) {
        this.lunchMinutes.set({
          start: this.attendanceConfig.timeToMinutes(cfg.lunch_start_time),
          end: this.attendanceConfig.timeToMinutes(cfg.lunch_end_time),
        });
      }
      this.requiredMinutesPerDay.set(cfg?.required_work_minutes_per_day ?? 480);
    });
  }

  prevMonth(): void {
    const [y, m] = this.currentYearMonth().split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.currentYearMonth.set(ym);
    const uid = this.auth.user()?.id;
    if (uid) {
      this.attendanceService.loadMonth(uid, ym);
      void this.loadLeaveForMonth(uid, d.getFullYear(), d.getMonth() + 1);
    }
    this.holidayService.loadForMonth(d.getFullYear(), d.getMonth() + 1);
  }

  nextMonth(): void {
    const [y, m] = this.currentYearMonth().split('-').map(Number);
    const d = new Date(y, m, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.currentYearMonth.set(ym);
    const uid = this.auth.user()?.id;
    if (uid) {
      this.attendanceService.loadMonth(uid, ym);
      void this.loadLeaveForMonth(uid, d.getFullYear(), d.getMonth() + 1);
    }
    this.holidayService.loadForMonth(d.getFullYear(), d.getMonth() + 1);
  }

  statusColor(status: AttendanceStatus | null): string {
    if (!status) return 'transparent';
    switch (status) {
      case 'valid': return 'var(--ml-success)';
      case 'pending': return '#eab308';
      case 'violation': return 'var(--ml-error)';
      default: return 'transparent';
    }
  }

  /** Màu ô: nghỉ phép, ngày lễ, chờ duyệt, hoặc theo giờ làm (đủ 8h xanh, 6h–8h vàng, thiếu đỏ). */
  cellBackground(d: {
    holidayName: string | null;
    status: AttendanceStatus | null;
    effectiveMinutes: number | null;
    check_in_time: string | null;
    check_out_time: string | null;
    leaveLabel: string | null;
  }): string {
    if (d.leaveLabel) return 'var(--ml-heat-leave, #e0f2fe)'; // xanh nhạt cho ngày nghỉ phép
    if (d.holidayName) return '#f3e8ff'; // tím nhạt
    if (d.status === 'pending') return '#eab308';
    if (d.effectiveMinutes != null) {
      if (d.effectiveMinutes >= 480) return 'var(--ml-heat-ok, #22c55e)';
      if (d.effectiveMinutes < 360) return 'var(--ml-heat-bad, #ef4444)';
      return 'var(--ml-heat-mid, #eab308)';
    }
    if (d.check_in_time && !d.check_out_time) return 'var(--ml-heat-bad, #ef4444)';
    if (d.check_in_time || d.check_out_time) return 'var(--ml-heat-bad, #ef4444)';
    return '';
  }

  /** Tooltip cho ô ngày (không trả về undefined để tránh hiển thị "undefined"). */
  protected cellTitle(d: {
    holidayName: string | null;
    canSupplement: boolean;
    durationLabel: string | null;
    day: number;
    leaveLabel: string | null;
  }): string {
    if (d.leaveLabel) return d.leaveLabel;
    if (d.holidayName) return d.holidayName;
    if (d.canSupplement) return 'Bổ sung chấm công';
    if (d.durationLabel) return d.durationLabel;
    if (d.day) return `Ngày ${d.day}`;
    return '';
  }

  /** Tải danh sách ngày nghỉ phép (đã duyệt) cho nhân viên theo tháng và map theo ngày. */
  private async loadLeaveForMonth(employeeId: string, year: number, month: number): Promise<void> {
    const days = await this.heatmapService.getHeatMapData(employeeId, year, month);
    const map: Record<string, string> = {};
    for (const d of days) {
      if (d.isLeave && d.leaveTypeLabel) {
        map[d.date] = d.leaveTypeLabel;
      }
    }
    this.leaveByDate.set(map);
  }

  onDayClick(d: {
    date: string;
    leaveLabel: string | null;
    canSupplement: boolean;
    holidayName?: string | null;
    check_in_time?: string | null;
    check_out_time?: string | null;
    check_in_photo_url?: string | null;
    check_out_photo_url?: string | null;
    durationLabel?: string | null;
    pendingReason?: string | null;
  }, _event: Event): void {
    if (d.canSupplement) return;
    const hasDetail =
      d.leaveLabel ||
      d.holidayName ||
      d.check_in_time ||
      d.check_out_time ||
      d.check_in_photo_url ||
      d.check_out_photo_url ||
      !!d.pendingReason;
    if (!hasDetail || !d.date) return;
    this.dialog.open(DayDetailDialogComponent, {
      data: {
        date: d.date,
        leaveLabel: d.leaveLabel ?? null,
        holidayName: d.holidayName ?? null,
        checkInTime: d.check_in_time ?? null,
        checkOutTime: d.check_out_time ?? null,
        checkInPhotoUrl: d.check_in_photo_url ?? null,
        checkOutPhotoUrl: d.check_out_photo_url ?? null,
        durationLabel: d.durationLabel ?? null,
        pendingReason: d.pendingReason ?? null,
      } satisfies DayDetailDialogData,
      width: '360px',
    });
  }

  onDayDblClick(d: { date: string; leaveLabel: string | null }, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!d.leaveLabel) return;
    this.dialog.open(DayDetailDialogComponent, {
      data: { date: d.date, leaveLabel: d.leaveLabel } satisfies DayDetailDialogData,
      width: '320px',
    });
  }

  openDayDetail(d: { date: string; leaveLabel: string | null }): void {
    if (!d.leaveLabel) return;
    this.dialog.open(DayDetailDialogComponent, {
      data: { date: d.date, leaveLabel: d.leaveLabel } satisfies DayDetailDialogData,
      width: '320px',
    });
  }

  openLocationOnMap(lat: number, lng: number): void {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  }

  openPhotoViewer(photoUrl: string, title?: string): void {
    this.dialog.open(PhotoViewerDialogComponent, {
      data: { photoUrl, title },
      maxWidth: '95vw',
    });
  }

  openSupplementForm(d: { date: string; check_in_time: string | null; check_out_time: string | null }): void {
    let checkIn = '08:00';
    let checkOut = '17:30';
    if (d.check_in_time) {
      const t = new Date(d.check_in_time);
      checkIn = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    }
    if (d.check_out_time) {
      const t = new Date(d.check_out_time);
      checkOut = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    }
    const data: SupplementFormDialogData = { date: d.date, checkIn, checkOut };
    const ref = this.dialog.open(SupplementFormDialogComponent, { data, width: '320px' });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        const uid = this.auth.user()?.id;
        if (uid) this.attendanceService.loadMonth(uid, this.currentYearMonth());
      }
    });
  }

  /** Xác nhận rồi mới Check-out (chỉ cho phép cập nhật Check-out, không cho sửa Check-in). */
  confirmAndCheckOut(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Xác nhận Check-out',
        message: 'Bạn có chắc chắn muốn ghi nhận Check-out ngay bây giờ? Giờ sẽ được ghi nhận là thời điểm hiện tại.',
        confirmText: 'Ghi nhận',
        cancelText: 'Hủy',
      },
      width: '360px',
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok) void this.doCheckIn(true);
    });
  }

  async doCheckIn(isCheckOut: boolean): Promise<void> {
    this.submitError.set(null);
    this.locationWarning.set(null);
    this.locationWarningCoords.set(null);
    this.capturing.set(true);

    const title = isCheckOut ? 'Chụp ảnh check-out' : 'Chụp ảnh check-in';
    const ref = this.dialog.open(CameraCaptureDialogComponent, {
      data: { title },
      width: 'min(420px, 96vw)',
      disableClose: false,
    });

    const photo: Blob | undefined = await new Promise<Blob | undefined>((resolve) => {
      ref.afterClosed().subscribe((result: CameraCaptureResult) => {
        resolve(result ?? undefined);
      });
    });

    if (!photo) {
      this.capturing.set(false);
      return;
    }

    let lat: number | undefined;
    let lng: number | undefined;

    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      const office = await this.attendanceService.getOfficeLocation();
      if (!this.attendanceService.isWithinOffice(lat, lng, office)) {
        this.locationWarning.set(
          `Bạn đang ngoài vùng văn phòng (${office.radiusMeters}m). Dữ liệu vẫn được ghi nhận.`
        );
        this.locationWarningCoords.set({ lat, lng });
      }
    } catch {
      this.locationWarning.set('Không lấy được GPS. Vẫn ghi nhận với tọa độ mặc định.');
    }

    const today = new Date().toISOString().slice(0, 10);
    const payload = { workDate: today, photoFile: photo, lat, lng, isCheckOut };

    if (!navigator.onLine) {
      await this.offlineQueue.enqueue(payload);
      this.capturing.set(false);
      this.locationWarning.set('Đã lưu offline. Sẽ đồng bộ khi có mạng.');
      const uid = this.auth.user()?.id;
      if (uid) this.attendanceService.loadMonth(uid, this.currentYearMonth());
      return;
    }

    const { error } = await this.attendanceService.submitCheckIn(payload);
    this.capturing.set(false);
    if (error) {
      this.submitError.set(error);
      return;
    }
    this.photoRefreshTrigger.update((v) => v + 1);
  }
}
