import { ChangeDetectionStrategy, Component, inject, signal, OnInit, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CompaniesService } from '../../../core/services/companies.service';
import type { Company } from '../../../core/models';

@Component({
  selector: 'app-companies',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './companies.html',
  styleUrl: './companies.scss',
})
export class CompaniesComponent implements OnInit {
  protected readonly companiesService = inject(CompaniesService);

  protected readonly list = signal<Company[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly message = signal<string | null>(null);

  protected readonly showForm = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly formName = signal('');
  protected readonly formShortName = signal('');
  protected readonly formLogoUrl = signal('');
  protected readonly formAddress = signal('');
  protected readonly formTaxCode = signal('');
  protected readonly formPhone = signal('');
  protected readonly formEmail = signal('');
  protected readonly formCheckInLat = signal<number | null>(null);
  protected readonly formCheckInLng = signal<number | null>(null);
  protected readonly formCheckInRadius = signal<number>(50);

  protected readonly isAdd = computed(() => this.showForm() && this.editingId() === null);
  protected readonly editingCompany = computed(() => {
    const id = this.editingId();
    if (!id) return null;
    return this.list().find((c) => c.id === id) ?? null;
  });

  async ngOnInit(): Promise<void> {
    await this.loadList();
  }

  protected async loadList(): Promise<void> {
    this.loading.set(true);
    const data = await this.companiesService.list();
    this.list.set(data);
    this.loading.set(false);
  }

  protected startAdd(): void {
    this.showForm.set(true);
    this.editingId.set(null);
    this.formName.set('');
    this.formShortName.set('');
    this.formLogoUrl.set('');
    this.formAddress.set('');
    this.formTaxCode.set('');
    this.formPhone.set('');
    this.formEmail.set('');
    this.formCheckInLat.set(null);
    this.formCheckInLng.set(null);
    this.formCheckInRadius.set(50);
    this.message.set(null);
  }

  protected startEdit(c: Company): void {
    this.showForm.set(true);
    this.editingId.set(c.id);
    this.formName.set(c.company_name);
    this.formShortName.set(c.short_name ?? '');
    this.formLogoUrl.set(c.logo_url ?? '');
    this.formAddress.set(c.address ?? '');
    this.formTaxCode.set(c.tax_code ?? '');
    this.formPhone.set(c.phone ?? '');
    this.formEmail.set(c.email ?? '');
    this.formCheckInLat.set(c.check_in_lat ?? null);
    this.formCheckInLng.set(c.check_in_lng ?? null);
    this.formCheckInRadius.set(c.check_in_radius_meters ?? 50);
    this.message.set(null);
  }

  protected cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.message.set(null);
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.message.set(null);
    const id = this.editingId();
    const payload = {
      company_name: this.formName().trim() || 'Công ty',
      short_name: this.formShortName().trim() || null,
      logo_url: this.formLogoUrl().trim() || null,
      address: this.formAddress().trim() || null,
      tax_code: this.formTaxCode().trim() || null,
      phone: this.formPhone().trim() || null,
      email: this.formEmail().trim() || null,
      check_in_lat: this.formCheckInLat(),
      check_in_lng: this.formCheckInLng(),
      check_in_radius_meters: this.formCheckInRadius(),
    };
    const err = id
      ? await this.companiesService.update(id, payload)
      : await this.companiesService.create(payload);
    this.saving.set(false);
    if (err) {
      this.message.set('Lỗi: ' + err);
    } else {
      this.message.set(id ? 'Đã cập nhật.' : 'Đã thêm công ty.');
      this.showForm.set(false);
      this.editingId.set(null);
      await this.loadList();
    }
  }

  protected async deleteCompany(c: Company): Promise<void> {
    if (!confirm(`Xóa công ty "${c.company_name}"? Nhân viên đang gán sẽ có company_id = null.`)) return;
    const err = await this.companiesService.delete(c.id);
    if (err) {
      this.message.set('Lỗi: ' + err);
    } else {
      this.message.set('Đã xóa.');
      if (this.editingId() === c.id) {
        this.showForm.set(false);
        this.editingId.set(null);
      }
      await this.loadList();
    }
  }
}
