import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { PayrollService } from '../../core/services/payroll.service';
import { TaxConfigService } from '../../core/services/tax-config.service';
import { PayrollConfigService } from '../../core/services/payroll-config.service';
import { CompaniesService } from '../../core/services/companies.service';
import { AuthService } from '../../core/services/auth.service';
import { EmployeeService } from '../../core/services/employee.service';
import type { Payroll } from '../../core/models';
import type { TaxBracket } from '../../core/models';

interface TaxDetailData {
  gross: number;
  insurance: number;
  selfDed: number;
  depDedTotal: number;
  dependents: number;
  taxable: number;
  breakdown: { bracket: TaxBracket; incomeInBracket: number; taxInBracket: number }[];
  totalTax: number;
  totalIncomeInBrackets: number;
}

@Component({
  selector: 'app-payslip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule, MatFormFieldModule, MatSelectModule, MatButtonModule],
  templateUrl: './payslip.html',
  styleUrl: './payslip.scss',
})
export class PayslipComponent implements OnInit {
  protected readonly payrollService = inject(PayrollService);
  protected readonly taxConfigService = inject(TaxConfigService);
  protected readonly payrollConfigService = inject(PayrollConfigService);
  protected readonly auth = inject(AuthService);
  protected readonly employeeService = inject(EmployeeService);
  private readonly companiesService = inject(CompaniesService);

  protected readonly list = this.payrollService.list;
  protected readonly company = signal<{ company_name: string; address?: string; tax_code?: string; phone?: string } | null>(null);
  protected readonly loading = this.payrollService.loading;
  protected readonly selected = signal<Payroll | null>(null);
  protected readonly filterYear = signal<number>(new Date().getFullYear());
  protected readonly showTaxDetailModal = signal(false);
  protected readonly taxDetailLoading = signal(false);
  protected readonly taxDetailData = signal<TaxDetailData | null>(null);

  protected readonly years = (() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2];
  })();

  protected readonly filteredList = computed(() =>
    this.list().filter((p) => p.year === this.filterYear())
  );

  ngOnInit(): void {
    this.payrollService.loadMyPayrolls();
  }

  protected printPayslip(): void {
    window.print();
  }

  select(p: Payroll): void {
    this.selected.set(p);
    void this.loadCompanyForCurrentEmployee();
  }

  back(): void {
    this.selected.set(null);
    this.company.set(null);
  }

  private async loadCompanyForCurrentEmployee(): Promise<void> {
    const emp = this.employeeService.currentEmployee();
    if (!emp?.company_id) {
      this.company.set(null);
      return;
    }
    const c = await this.companiesService.get(emp.company_id);
    this.company.set(
      c
        ? {
            company_name: c.company_name,
            address: c.address ?? undefined,
            tax_code: c.tax_code ?? undefined,
            phone: c.phone ?? undefined,
          }
        : null
    );
  }

  protected closeTaxDetailModal(): void {
    this.showTaxDetailModal.set(false);
    this.taxDetailData.set(null);
  }

  protected async openTaxDetailModal(p: Payroll): Promise<void> {
    this.showTaxDetailModal.set(true);
    this.taxDetailLoading.set(true);
    this.taxDetailData.set(null);
    const uid = this.auth.user()?.id;
    const [brackets, deductions, configs] = await Promise.all([
      this.taxConfigService.getBrackets(),
      this.taxConfigService.getDeductions(),
      uid ? this.payrollConfigService.getByEmployee(uid) : Promise.resolve([]),
    ]);
    this.taxDetailLoading.set(false);
    const endOfMonth = `${p.year}-${String(p.month).padStart(2, '0')}-31`;
    const config = configs.find((c) => c.effective_date <= endOfMonth);
    const dependents = config?.dependents_count ?? 0;
    const selfDed = deductions.find((d) => d.code === 'self')?.amount_monthly ?? 11_000_000;
    const depDed = deductions.find((d) => d.code === 'dependent')?.amount_monthly ?? 4_400_000;
    const depDedTotal = dependents * depDed;
    const taxable = Math.max(0, p.gross_salary - p.insurance_amount - selfDed - depDedTotal);
    const breakdown =
      taxable > 0 ? this.taxConfigService.getBracketBreakdown(brackets, taxable) : [];
    const totalTax = breakdown.reduce((s, r) => s + r.taxInBracket, 0);
    const totalIncomeInBrackets = breakdown.reduce((s, r) => s + r.incomeInBracket, 0);
    this.taxDetailData.set({
      gross: p.gross_salary,
      insurance: p.insurance_amount,
      selfDed,
      depDedTotal,
      dependents,
      taxable,
      breakdown,
      totalTax,
      totalIncomeInBrackets,
    });
  }
}
