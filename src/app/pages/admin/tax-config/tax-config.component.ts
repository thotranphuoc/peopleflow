import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TaxConfigService } from '../../../core/services/tax-config.service';
import type { TaxBracket, TaxDeduction } from '../../../core/models';

@Component({
  selector: 'app-tax-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, DecimalPipe],
  templateUrl: './tax-config.html',
  styleUrl: './tax-config.scss',
})
export class TaxConfigComponent implements OnInit {
  protected readonly taxService = inject(TaxConfigService);

  protected readonly brackets = signal<TaxBracket[]>([]);
  protected readonly deductions = signal<TaxDeduction[]>([]);
  protected readonly loading = signal(true);
  protected readonly message = signal<string | null>(null);

  protected readonly editDeductionId = signal<string | null>(null);
  protected readonly editDeductionName = signal('');
  protected readonly editDeductionAmount = signal(0);
  protected readonly deductionSaving = signal(false);

  protected readonly editBracketId = signal<string | null>(null);
  protected readonly editBracketFrom = signal(0);
  protected readonly editBracketTo = signal<number | null>(null);
  protected readonly editBracketRate = signal(0);
  protected readonly editBracketOrder = signal(0);
  protected readonly bracketSaving = signal(false);

  protected readonly showAddBracket = signal(false);
  protected readonly addFrom = signal(0);
  protected readonly addTo = signal<number | null>(null);
  protected readonly addRate = signal(5);
  protected readonly addOrder = signal(1);
  protected readonly addSaving = signal(false);

  /** Tính thuế mẫu: thu nhập gộp (trước BHXH), % BHXH, số người phụ thuộc. */
  protected readonly previewGross = signal<number>(0);
  protected readonly previewInsuranceRate = signal<number>(10.5);
  protected readonly previewDependents = signal<number>(0);
  protected readonly previewBreakdown = signal<{ bracket: TaxBracket; incomeInBracket: number; taxInBracket: number }[]>([]);
  /** Kết quả tính: BHXH, giảm trừ bản thân, giảm trừ phụ thuộc, thu nhập chịu thuế (để hiển thị). */
  protected readonly previewComputed = signal<{ insurance: number; selfDed: number; depDedTotal: number; taxable: number } | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.message.set(null);
    const [b, d] = await Promise.all([this.taxService.getBrackets(), this.taxService.getDeductions()]);
    this.brackets.set(b);
    this.deductions.set(d);
    this.loading.set(false);
  }

  protected openEditDeduction(d: TaxDeduction): void {
    this.editDeductionId.set(d.id);
    this.editDeductionName.set(d.name);
    this.editDeductionAmount.set(d.amount_monthly);
  }

  protected cancelEditDeduction(): void {
    this.editDeductionId.set(null);
  }

  protected async saveDeduction(): Promise<void> {
    const id = this.editDeductionId();
    if (!id) return;
    this.deductionSaving.set(true);
    const err = await this.taxService.updateDeduction(id, {
      name: this.editDeductionName(),
      amount_monthly: this.editDeductionAmount(),
    });
    this.deductionSaving.set(false);
    if (err) this.message.set('Lỗi: ' + err);
    else {
      this.editDeductionId.set(null);
      await this.load();
    }
  }

  protected openEditBracket(b: TaxBracket): void {
    this.editBracketId.set(b.id);
    this.editBracketFrom.set(b.amount_from);
    this.editBracketTo.set(b.amount_to);
    this.editBracketRate.set(b.rate_percent);
    this.editBracketOrder.set(b.sort_order);
  }

  protected cancelEditBracket(): void {
    this.editBracketId.set(null);
  }

  protected async saveBracket(): Promise<void> {
    const id = this.editBracketId();
    if (!id) return;
    this.bracketSaving.set(true);
    const err = await this.taxService.updateBracket(id, {
      sort_order: this.editBracketOrder(),
      amount_from: this.editBracketFrom(),
      amount_to: this.editBracketTo(),
      rate_percent: this.editBracketRate(),
    });
    this.bracketSaving.set(false);
    if (err) this.message.set('Lỗi: ' + err);
    else {
      this.editBracketId.set(null);
      await this.load();
    }
  }

  protected openAddBracket(): void {
    const list = this.brackets();
    const maxOrder = list.length ? Math.max(...list.map((x) => x.sort_order)) : 0;
    this.addOrder.set(maxOrder + 1);
    this.addFrom.set(0);
    this.addTo.set(5000000);
    this.addRate.set(5);
    this.showAddBracket.set(true);
  }

  protected cancelAddBracket(): void {
    this.showAddBracket.set(false);
  }

  protected async submitAddBracket(): Promise<void> {
    this.addSaving.set(true);
    const err = await this.taxService.createBracket({
      sort_order: this.addOrder(),
      amount_from: this.addFrom(),
      amount_to: this.addTo(),
      rate_percent: this.addRate(),
    });
    this.addSaving.set(false);
    if (err) this.message.set('Lỗi: ' + err);
    else {
      this.showAddBracket.set(false);
      await this.load();
    }
  }

  protected async deleteBracket(b: TaxBracket): Promise<void> {
    if (!confirm(`Xóa bậc thuế: từ ${b.amount_from} đến ${b.amount_to ?? '∞'}, ${b.rate_percent}%?`)) return;
    const err = await this.taxService.deleteBracket(b.id);
    if (err) this.message.set('Lỗi: ' + err);
    else await this.load();
  }

  protected formatAmount(n: number | null): string {
    if (n == null) return '∞';
    return (n / 1_000_000).toFixed(0) + ' tr';
  }

  protected runPreview(): void {
    const gross = this.previewGross();
    if (gross <= 0) {
      this.previewBreakdown.set([]);
      this.previewComputed.set(null);
      return;
    }
    const deductions = this.deductions();
    const selfDed = deductions.find((d) => d.code === 'self')?.amount_monthly ?? 11_000_000;
    const depDed = deductions.find((d) => d.code === 'dependent')?.amount_monthly ?? 4_400_000;
    const dependents = this.previewDependents();
    const insurance = Math.round(gross * (this.previewInsuranceRate() / 100));
    const depDedTotal = dependents * depDed;
    const taxable = Math.max(0, gross - insurance - selfDed - depDedTotal);
    this.previewComputed.set({ insurance, selfDed, depDedTotal, taxable });
    if (taxable <= 0) {
      this.previewBreakdown.set([]);
      return;
    }
    const rows = this.taxService.getBracketBreakdown(this.brackets(), taxable);
    this.previewBreakdown.set(rows);
  }

  protected previewTotalTax(): number {
    return this.previewBreakdown().reduce((sum, r) => sum + r.taxInBracket, 0);
  }

  protected previewTotalIncomeInBrackets(): number {
    return this.previewBreakdown().reduce((sum, r) => sum + r.incomeInBracket, 0);
  }
}
