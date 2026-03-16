import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ExportCsvService {
  /**
   * Build CSV from array of objects and trigger download.
   * @param rows Array of objects (keys = column headers)
   * @param filename e.g. 'bao-cao-cham-cong-2026-03.csv'
   */
  download(rows: Record<string, unknown>[], filename: string): void {
    if (rows.length === 0) return;
    const keys = Object.keys(rows[0]);
    const header = keys.join(',');
    const escape = (v: unknown): string => {
      const s = v == null ? '' : String(v);
      if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [header, ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))];
    const csv = lines.join('\r\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
