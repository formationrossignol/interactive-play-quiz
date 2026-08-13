export type AnalyticsExportFormat = 'CSV' | 'Excel' | 'PDF';

export interface AnalyticsExportRow {
  date: string;
  activeLearners: number;
  events: number;
  evidence: number;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportAnalytics(format: AnalyticsExportFormat, rows: AnalyticsExportRow[]): Promise<void> {
  const headers = ['Date', 'Apprenants actifs', 'Événements', 'Preuves'];
  const values = rows.map((row) => [row.date, row.activeLearners, row.events, row.evidence]);
  const filename = `analytics-${new Date().toISOString().slice(0, 10)}`;
  if (format === 'CSV') {
    const csv = [headers, ...values].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
    download(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
    return;
  }
  if (format === 'Excel') {
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...values]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Analytics');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    return;
  }
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.setFontSize(16);
  pdf.text('Analytics pédagogiques', 14, 15);
  autoTable(pdf, { startY: 23, head: [headers], body: values.map((row) => row.map(String)), theme: 'grid' });
  pdf.save(`${filename}.pdf`);
}
