export type LiveResultsExportFormat = "PDF" | "Excel" | "CSV" | "JSON";

export interface LiveResultsPayload {
  quiz: string;
  gameCode: string;
  date: string;
  players: Array<{
    name: string;
    score: number;
    correctAnswers: number;
    joinedAt: string;
  }>;
  stats: {
    totalPlayers: number;
    averageScore: number;
    questionsAnswered: number;
    duration: number;
  };
}

const HEADERS = ["Participant", "Score", "Bonnes réponses", "Arrivée"] as const;

const rowsOf = (results: LiveResultsPayload) => results.players.map((player) => [
  player.name,
  player.score,
  player.correctAnswers,
  new Date(player.joinedAt).toLocaleString("fr"),
]);

const safeFilename = (results: LiveResultsPayload) => {
  const title = results.quiz
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `resultats_${title || "quiz"}_${results.gameCode}`;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportLiveResults(
  format: LiveResultsExportFormat,
  results: LiveResultsPayload,
): Promise<void> {
  const rows = rowsOf(results);
  const filename = safeFilename(results);

  if (format === "JSON") {
    downloadBlob(
      new Blob([JSON.stringify(results, null, 2)], { type: "application/json;charset=utf-8" }),
      `${filename}.json`,
    );
    return;
  }

  if (format === "CSV") {
    const csv = [[...HEADERS], ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    downloadBlob(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
    return;
  }

  if (format === "Excel") {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([[...HEADERS], ...rows]);
    worksheet["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 18 }, { wch: 22 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Résultats");
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    return;
  }

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(`Résultats — ${results.quiz}`, 14, 15);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(100);
  pdf.text(`Code : ${results.gameCode} · Exporté le ${new Date().toLocaleString("fr")}`, 14, 21);
  autoTable(pdf, {
    startY: 27,
    head: [[...HEADERS]],
    body: rows.map((row) => row.map(String)),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [76, 57, 168], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 244, 238] },
  });
  pdf.save(`${filename}.pdf`);
}
