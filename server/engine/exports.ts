/**
 * EXPORTS EXCEL (exceljs) — les fichiers sont générés côté serveur à partir des
 * données réellement stockées en base (aucune valeur codée en dur).
 */
import ExcelJS from 'exceljs';
import { all, get } from '../db.ts';
import { buildPassage, passageToRows, groupLabel } from './statements.ts';
import { runControls } from './controls.ts';

const NAVY = 'FF0F2743';
const TEAL = 'FF19B1AD';

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 22;
}

function titleRow(ws: ExcelJS.Worksheet, title: string, subtitle: string) {
  ws.mergeCells('A1:F1');
  const t = ws.getCell('A1');
  t.value = title;
  t.font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.mergeCells('A2:F2');
  const s = ws.getCell('A2');
  s.value = subtitle;
  s.font = { size: 10, color: { argb: 'FF555555' } };
  ws.addRow([]);
}

export async function exportPassage(dossierId: string, onlyApproved = true): Promise<Buffer> {
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [dossierId]);
  const p = buildPassage(dossierId, onlyApproved);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IFRS Bridge Maroc';
  const ws = wb.addWorksheet('Tableau de passage');
  titleRow(
    ws,
    'IFRS Bridge Maroc — Tableau de passage CGNC → IFRS',
    `Dossier : ${dossier?.name} · Entreprise : ${dossier?.company_name} · Exercice : ${dossier?.exercice} · Clôture : ${dossier?.closing_date} · Devise : ${dossier?.currency} · ${onlyApproved ? 'Retraitements validés uniquement' : 'Tous les retraitements (provisoire)'}`,
  );
  const header = ws.addRow(['Section', 'Rubrique', 'Solde CGNC', 'Reclassements', 'Ajustements IFRS', 'Solde IFRS']);
  styleHeader(header);
  for (const row of passageToRows(p)) {
    const r = ws.addRow(row);
    r.getCell(3).numFmt = '#,##0.00';
    r.getCell(4).numFmt = '#,##0.00';
    r.getCell(5).numFmt = '#,##0.00';
    r.getCell(6).numFmt = '#,##0.00';
    if (String(row[1]).startsWith('TOTAL') || row[0] === 'Contrôle') {
      r.font = { bold: true };
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3ECF7' } };
    }
  }
  ws.columns = [
    { width: 26 },
    { width: 52 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];

  const ws2 = wb.addWorksheet('Rapprochement résultat');
  titleRow(ws2, 'Rapprochement du résultat CGNC → IFRS', `Dossier : ${dossier?.name}`);
  const h2 = ws2.addRow(['Rubrique', 'Groupe', 'CGNC', 'Ajustements IFRS', 'IFRS']);
  styleHeader(h2);
  for (const d of p.result.detail) {
    ws2.addRow([d.rubric, groupLabel(d.group as any) || d.group, d.cgnc, d.ajustement, d.cgnc + d.ajustement]);
  }
  const totalRow = ws2.addRow([
    'RÉSULTAT NET',
    '',
    p.result.resultatCGNC,
    p.result.resultatIFRS - p.result.resultatCGNC,
    p.result.resultatIFRS,
  ]);
  totalRow.font = { bold: true };
  ws2.columns = [{ width: 52 }, { width: 26 }, { width: 18 }, { width: 20 }, { width: 18 }];

  const ws3 = wb.addWorksheet('Rapprochement capitaux propres');
  titleRow(ws3, 'Rapprochement des capitaux propres CGNC → IFRS', `Dossier : ${dossier?.name}`);
  styleHeader(ws3.addRow(['Rubrique', 'CGNC', 'Ajustements IFRS', 'IFRS']));
  for (const e of p.equity) ws3.addRow([e.rubric, e.cgnc, e.ajustement, e.ifrs]);
  ws3.addRow(['TOTAL', p.balance.cpCGNC, p.totalEquityImpact, p.balance.cpIFRS]).font = { bold: true };
  ws3.columns = [{ width: 52 }, { width: 18 }, { width: 20 }, { width: 18 }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportEntries(dossierId: string): Promise<Buffer> {
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [dossierId]);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IFRS Bridge Maroc';
  const ws = wb.addWorksheet('Écritures de retraitement');
  titleRow(
    ws,
    'IFRS Bridge Maroc — Journal des retraitements IFRS',
    `Dossier : ${dossier?.name} · Exercice : ${dossier?.exercice} · Devise : ${dossier?.currency}`,
  );
  styleHeader(ws.addRow(['Date', 'Référence', 'Norme', 'Compte / rubrique', 'Libellé', 'Débit', 'Crédit', 'Statut']));
  const rows = all(
    `SELECT e.*, a.status AS adj_status FROM entries e
     LEFT JOIN adjustments a ON a.id = e.adjustment_id
     WHERE e.dossier_id = ? ORDER BY e.ref, e.rowid`,
    [dossierId],
  );
  let totalDebit = 0;
  let totalCredit = 0;
  for (const e of rows) {
    const r = ws.addRow([
      String(e.date).slice(0, 10),
      e.ref,
      e.norm_code,
      e.account_code,
      `${e.account_label} — ${e.label}`,
      Number(e.debit),
      Number(e.credit),
      e.adj_status || e.status,
    ]);
    r.getCell(6).numFmt = '#,##0.00';
    r.getCell(7).numFmt = '#,##0.00';
    totalDebit += Number(e.debit);
    totalCredit += Number(e.credit);
  }
  const tot = ws.addRow(['', '', '', '', 'TOTAL GÉNÉRAL', totalDebit, totalCredit, '']);
  tot.font = { bold: true };
  tot.getCell(6).numFmt = '#,##0.00';
  tot.getCell(7).numFmt = '#,##0.00';
  const ctrl = ws.addRow([
    '',
    '',
    '',
    '',
    Math.abs(totalDebit - totalCredit) < 0.01 ? 'Contrôle : écritures équilibrées' : 'Contrôle : ÉCART DÉTECTÉ',
    '',
    '',
    '',
  ]);
  ctrl.font = { bold: true, color: { argb: Math.abs(totalDebit - totalCredit) < 0.01 ? 'FF118D8C' : 'FFB91C1C' } };
  ws.columns = [
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 20 },
    { width: 64 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportSynthesis(dossierId: string, onlyApproved = true): Promise<Buffer> {
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [dossierId]);
  const p = buildPassage(dossierId, onlyApproved);
  const { controls, summary } = runControls(dossierId);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IFRS Bridge Maroc';

  const ws = wb.addWorksheet('Synthèse retraitements');
  titleRow(ws, 'IFRS Bridge Maroc — Synthèse des retraitements', `Dossier : ${dossier?.name}`);
  styleHeader(ws.addRow(['Référence', 'Poste CGNC', 'Norme IFRS', 'Type', 'Montant (MAD)', 'Statut', 'Intégré aux états IFRS']));
  const adjustments = all('SELECT * FROM adjustments WHERE dossier_id = ? ORDER BY ref', [dossierId]);
  for (const a of adjustments) {
    const u = p.adjustments.find((x) => x.ref === a.ref);
    ws.addRow([
      a.ref,
      a.poste_cgnc,
      a.norm_code,
      a.type,
      Number(a.amount),
      a.status,
      u ? (u.included ? 'Oui' : `Non — ${u.reason}`) : 'Non',
    ]).getCell(5).numFmt = '#,##0.00';
  }
  ws.columns = [{ width: 10 }, { width: 46 }, { width: 12 }, { width: 18 }, { width: 16 }, { width: 18 }, { width: 60 }];

  const ws2 = wb.addWorksheet('Contrôles qualité');
  titleRow(ws2, 'Contrôles qualité obligatoires', `Dossier : ${dossier?.name}`);
  styleHeader(ws2.addRow(['Contrôle', 'Statut', 'Détail', 'Valeur']));
  for (const c of controls) {
    const r = ws2.addRow([
      c.label,
      c.status === 'conforme' ? 'Conforme' : c.status === 'a_verifier' ? 'À vérifier' : 'Bloquant',
      c.detail,
      c.value ?? '',
    ]);
    r.getCell(2).font = {
      bold: true,
      color: { argb: c.status === 'conforme' ? 'FF118D8C' : c.status === 'a_verifier' ? 'FFB45309' : 'FFB91C1C' },
    };
  }
  ws2.addRow([]);
  ws2.addRow(['Synthèse', `${summary.conforme} conforme(s) · ${summary.a_verifier} à vérifier · ${summary.bloquant} bloquant(s)`]);
  ws2.columns = [{ width: 52 }, { width: 14 }, { width: 100 }, { width: 18 }];

  const ws3 = wb.addWorksheet('Sources normatives');
  titleRow(ws3, 'Sources et références utilisées', `Dossier : ${dossier?.name}`);
  styleHeader(ws3.addRow(['Référence', 'Norme', 'Paragraphe', 'Principe', 'Source', 'Vérifiée']));
  for (const a of adjustments) {
    let refs: any[] = [];
    try {
      refs = JSON.parse(a.refs_json || '[]');
    } catch {
      refs = [];
    }
    for (const r of refs) {
      ws3.addRow([a.ref, r.norm, r.number, r.text, r.source, r.verified ? 'Oui' : 'Référence à vérifier']);
    }
  }
  ws3.columns = [{ width: 10 }, { width: 12 }, { width: 16 }, { width: 90 }, { width: 46 }, { width: 20 }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportBalance(dossierId: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Balance importée');
  styleHeader(ws.addRow(['Compte', 'Libellé', 'Débit', 'Crédit', 'Solde', 'Source']));
  const rows = all('SELECT * FROM gl_lines WHERE dossier_id = ? ORDER BY account_code, rowid', [dossierId]);
  for (const l of rows) {
    ws.addRow([l.account_code, l.account_label, Number(l.debit), Number(l.credit), Number(l.balance), l.source]);
  }
  ws.columns = [{ width: 16 }, { width: 52 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }];
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export { TEAL };
