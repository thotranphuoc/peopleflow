import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AttendanceConfigService } from '../../../core/services/attendance-config.service';
import { ShortfallPenaltyRulesService } from '../../../core/services/shortfall-penalty-rules.service';
import type { AttendanceConfig, ShortfallPenaltyRule } from '../../../core/models';

@Component({
  selector: 'app-attendance-penalty-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    DecimalPipe,
  ],
  templateUrl: './attendance-penalty-config.html',
  styleUrl: './attendance-penalty-config.scss',
})
export class AttendancePenaltyConfigComponent implements OnInit {
  protected readonly configService = inject(AttendanceConfigService);
  protected readonly rulesService = inject(ShortfallPenaltyRulesService);

  protected readonly config = signal<AttendanceConfig | null>(null);
  protected readonly rules = signal<ShortfallPenaltyRule[]>([]);
  protected readonly loading = signal(true);
  protected readonly message = signal<string | null>(null);

  protected readonly editConfig = signal(false);
  protected readonly workStart = signal('08:00');
  protected readonly workEnd = signal('17:30');
  protected readonly lunchStart = signal('12:00');
  protected readonly lunchEnd = signal('13:30');
  protected readonly requiredMinutes = signal(480);
  protected readonly configSaving = signal(false);

  protected readonly editRuleId = signal<string | null>(null);
  protected readonly editPenaltyAmount = signal(0);
  protected readonly editHalfDayUnpaid = signal(false);
  protected readonly ruleSaving = signal(false);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.message.set(null);
    const [cfg, rules] = await Promise.all([
      this.configService.get(),
      this.rulesService.list(),
    ]);
    this.config.set(cfg);
    if (cfg) {
      this.workStart.set(cfg.work_start_time.slice(0, 5));
      this.workEnd.set(cfg.work_end_time.slice(0, 5));
      this.lunchStart.set(cfg.lunch_start_time.slice(0, 5));
      this.lunchEnd.set(cfg.lunch_end_time.slice(0, 5));
      this.requiredMinutes.set(cfg.required_work_minutes_per_day ?? 480);
    }
    this.rules.set(rules);
    this.loading.set(false);
  }

  protected openEditConfig(): void {
    this.editConfig.set(true);
  }

  protected cancelEditConfig(): void {
    this.editConfig.set(false);
    const c = this.config();
    if (c) {
      this.workStart.set(c.work_start_time.slice(0, 5));
      this.workEnd.set(c.work_end_time.slice(0, 5));
      this.lunchStart.set(c.lunch_start_time.slice(0, 5));
      this.lunchEnd.set(c.lunch_end_time.slice(0, 5));
      this.requiredMinutes.set(c.required_work_minutes_per_day ?? 480);
    }
  }

  protected async saveConfig(): Promise<void> {
    this.configSaving.set(true);
    const err = await this.configService.update({
      work_start_time: this.workStart() + ':00',
      work_end_time: this.workEnd() + ':00',
      lunch_start_time: this.lunchStart() + ':00',
      lunch_end_time: this.lunchEnd() + ':00',
      required_work_minutes_per_day: this.requiredMinutes(),
    });
    this.configSaving.set(false);
    if (err) this.message.set('Lỗi: ' + err);
    else {
      this.editConfig.set(false);
      await this.load();
    }
  }

  protected openEditRule(r: ShortfallPenaltyRule): void {
    this.editRuleId.set(r.id);
    this.editPenaltyAmount.set(r.penalty_amount);
    this.editHalfDayUnpaid.set(r.half_day_unpaid);
  }

  protected cancelEditRule(): void {
    this.editRuleId.set(null);
  }

  protected async saveRule(): Promise<void> {
    const id = this.editRuleId();
    if (!id) return;
    this.ruleSaving.set(true);
    const err = await this.rulesService.update(id, {
      penalty_amount: this.editPenaltyAmount(),
      half_day_unpaid: this.editHalfDayUnpaid(),
    });
    this.ruleSaving.set(false);
    if (err) this.message.set('Lỗi: ' + err);
    else {
      this.editRuleId.set(null);
      await this.load();
    }
  }
}
