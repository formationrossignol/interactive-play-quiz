import type { InteractionBreakdown, LiveEvent, SessionReport } from './liveEngagement';

export type LiveSessionReportExportFormat = 'CSV' | 'Excel' | 'PDF';

const kindLabel: Record<InteractionBreakdown['kind'], string> = {
  poll: 'Sondage', priority: 'Priorisation', matrix: 'Matrice', brainstorm: 'Brainstorm', ranking: 'Classement',
};

/** LIVE-022 "export ... anonymisé selon la politique de collecte" — no
 *  collection-policy config exists anywhere in this schema to key off of,
 *  so this is a plain export-time toggle instead: replaces display names
 *  with a stable "Participant N" pseudonym, same posture as any staff
 *  export where the org decides at export time whether names are needed. */
function anonymize(name: string | null, index: number, on: boolean): string {
  if (!on) return name ?? `Participant ${index + 1}`;
  return `Participant ${index + 1}`;
}

/** Mirrors gradebookExport.ts's formula-neutralization: a cell text
 *  starting with = + - @ is a live formula in Excel/LibreOffice unless
 *  defanged with a leading apostrophe. */
function csvCell(value: unknown): string {
  const text = String(value ?? '');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const safeFilename = (event: LiveEvent) => {
  const slug = event.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `rapport_${slug || 'session'}_${event.code}`;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function participantHeaders(): string[] {
  return ['Participant', 'Rejoint le', 'Dernière activité'];
}

function participantRows(report: SessionReport, anonymized: boolean): Array<Array<string>> {
  return report.participants.map((p, i) => [
    anonymize(p.display_name, i, anonymized),
    new Date(p.joined_at).toLocaleString('fr'),
    new Date(p.last_seen_at).toLocaleString('fr'),
  ]);
}

function interactionHeaders(): string[] {
  return ['Interaction', 'Présentée', 'Répondu', 'Sans réponse', 'Connexion perdue'];
}

function interactionRows(report: SessionReport): Array<Array<string | number>> {
  return report.interactionBreakdown.map((b) => [
    kindLabel[b.kind] ?? b.kind,
    b.presented ? 'Oui' : 'Non',
    b.answered_count,
    b.no_response_count,
    b.connection_lost_count,
  ]);
}

export async function exportSessionReport(format: LiveSessionReportExportFormat, event: LiveEvent, report: SessionReport, anonymized: boolean): Promise<void> {
  const filename = safeFilename(event);
  const pHeaders = participantHeaders();
  const pRows = participantRows(report, anonymized);
  const iHeaders = interactionHeaders();
  const iRows = interactionRows(report);

  if (format === 'CSV') {
    const lines = [
      `Rapport — ${event.title} (${event.code})`,
      '',
      `Participants : ${report.participants.length} · Questions : ${report.questionsCount} · Votes : ${report.votesCount}`,
      '',
      pHeaders.join(';'),
      ...pRows.map((row) => row.map(csvCell).join(';')),
      '',
      iHeaders.join(';'),
      ...iRows.map((row) => row.map(csvCell).join(';')),
    ];
    downloadBlob(new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
    return;
  }

  if (format === 'Excel') {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const pSheet = XLSX.utils.aoa_to_sheet([pHeaders, ...pRows]);
    pSheet['!cols'] = [{ wch: 24 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, pSheet, 'Participants');
    const iSheet = XLSX.utils.aoa_to_sheet([iHeaders, ...iRows]);
    iSheet['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(workbook, iSheet, 'Interactions');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    return;
  }

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(`Rapport — ${event.title}`, 14, 15);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100);
  pdf.text(`Code : ${event.code} · ${report.participants.length} participants · ${report.questionsCount} questions · ${report.votesCount} votes · Exporté le ${new Date().toLocaleString('fr')}`, 14, 21);
  autoTable(pdf, {
    startY: 27,
    head: [pHeaders],
    body: pRows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [76, 57, 168], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 244, 238] },
  });
  const afterParticipants = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  autoTable(pdf, {
    startY: afterParticipants + 10,
    head: [iHeaders],
    body: iRows.map((row) => row.map(String)),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [76, 57, 168], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 244, 238] },
  });
  pdf.save(`${filename}.pdf`);
}
