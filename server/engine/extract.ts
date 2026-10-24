/**
 * EXTRACTION DES DOCUMENTS COMPTABLES
 * ---------------------------------------------------------------------------
 * Formats pris en charge :
 *   - Excel (.xlsx / .xlsm)  : extraction réelle via exceljs
 *   - CSV / TSV              : extraction réelle
 *   - PDF (texte)            : extraction du texte des flux puis détection des lignes
 *   - PDF scanné (image)     : NON pris en charge (OCR non embarqué) → message explicite
 *   - Word (.docx)           : NON pris en charge → message explicite
 *
 * Règle absolue : aucun compte et aucun montant n'est inventé. Toute valeur non
 * lue est signalée comme donnée manquante ou ambiguë.
 */
import ExcelJS from 'exceljs';
import zlib from 'node:zlib';

export type ExtractedRow = {
  account_code: string;
  account_label: string;
  debit: number;
  credit: number;
  balance: number;
  raw: string[];
  warnings: string[];
};

export type ExtractResult = {
  ok: boolean;
  format: 'xlsx' | 'csv' | 'pdf' | 'docx' | 'manuel' | 'inconnu';
  sheets: string[];
  headers: string[];
  rows: ExtractedRow[];
  warnings: string[];
  error?: string;
  meta: {
    rows: number;
    coded: number;
    uncoded: number;
    totalDebit: number;
    totalCredit: number;
    totalBalance: number;
  };
};

export type ColumnMap = {
  code?: number;
  label?: number;
  debit?: number;
  credit?: number;
  balance?: number;
};

const NUM_RE = /^-?\d{1,3}(?:[ \u00a0.,]\d{3})*(?:[.,]\d+)?$|^-?\d+(?:[.,]\d+)?$/;

export function parseNumber(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()]/g, '').replace(/[\u00a0\s]/g, '').replace(/MAD|DH|DHS/gi, '');
  // Formats : 1.234,56 (FR) ou 1,234.56 (EN) ou 1234.56 ou 1234,56
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative && n > 0 ? -n : n;
}

function cellToString(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if ('result' in v) return cellToString((v as any).result);
    if ('text' in v) return String((v as any).text);
    if ('richText' in v) return (v as any).richText.map((r: any) => r.text).join('');
    return String(v);
  }
  return String(v);
}

/* ------------------------------------------------------------------- Excel */

export async function readWorkbook(buffer: Buffer): Promise<{ sheets: string[]; matrices: Record<string, any[][]> }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const matrices: Record<string, any[][]> = {};
  for (const ws of wb.worksheets) {
    const matrix: any[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        values.push(cell.value);
      });
      matrix.push(values);
    });
    matrices[ws.name] = matrix;
  }
  return { sheets: wb.worksheets.map((w) => w.name), matrices };
}

/* --------------------------------------------------------------------- CSV */

export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = clean.split('\n')[0] ?? '';
  const candidates = [';', '\t', '|', ','];
  let sep = ',';
  let best = -1;
  for (const c of candidates) {
    const count = firstLine.split(c).length - 1;
    if (count > best) {
      best = count;
      sep = c;
    }
  }
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      current.push(field);
      field = '';
    } else if (ch === '\n') {
      current.push(field);
      rows.push(current);
      current = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

/* --------------------------------------------------------------------- PDF */

/**
 * Extraction du texte des PDF non protégés (flux FlateDecode + opérateurs Tj/TJ).
 * Un PDF scanné ne contient aucun opérateur de texte : la fonction le détecte et
 * renvoie une erreur explicite plutôt qu'un résultat vide silencieux.
 */
export function extractPdfText(buffer: Buffer): { text: string; isScanned: boolean } {
  const chunks: string[] = [];
  const buf = buffer;
  const streamMarker = Buffer.from('stream');
  const endMarker = Buffer.from('endstream');
  let index = 0;
  while (true) {
    const start = buf.indexOf(streamMarker, index);
    if (start === -1) break;
    let dataStart = start + streamMarker.length;
    if (buf[dataStart] === 0x0d) dataStart++;
    if (buf[dataStart] === 0x0a) dataStart++;
    const end = buf.indexOf(endMarker, dataStart);
    if (end === -1) break;
    const raw = buf.subarray(dataStart, end);
    index = end + endMarker.length;
    let decoded: Buffer | null = null;
    try {
      decoded = zlib.inflateSync(raw);
    } catch {
      try {
        decoded = zlib.inflateRawSync(raw);
      } catch {
        decoded = null;
      }
    }
    const content = decoded ? decoded.toString('latin1') : raw.toString('latin1');
    if (!/(Tj|TJ)/.test(content)) continue;
    chunks.push(content);
  }
  let text = '';
  for (const content of chunks) {
    const re = /\((?:\\.|[^\\()])*\)|\bTj\b|\bTJ\b|\bTd\b|\bTD\b|\bT\*\b|\bET\b/g;
    let m: RegExpExecArray | null;
    let line = '';
    while ((m = re.exec(content))) {
      const tok = m[0];
      if (tok === 'Td' || tok === 'TD' || tok === 'T*' || tok === 'ET') {
        if (line.trim()) text += line.trim() + '\n';
        line = '';
      } else if (tok.startsWith('(')) {
        line += unescapePdf(tok.slice(1, -1)) + ' ';
      }
    }
    if (line.trim()) text += line.trim() + '\n';
  }
  const isScanned = text.replace(/\s/g, '').length < 20;
  return { text, isScanned };
}

function unescapePdf(s: string): string {
  return s
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

/* ------------------------------------------------------- Détection colonnes */

const HEADER_HINTS: Record<keyof ColumnMap, RegExp[]> = {
  code: [/^compte/i, /^n[°o]?\s*compte/i, /^code/i, /^num[ée]ro/i, /^n[°o]/i],
  label: [/libell/i, /intitul/i, /d[ée]signation/i, /^poste/i, /^nature/i, /^rubrique/i],
  debit: [/d[ée]bit/i, /^d[ée]b/i],
  credit: [/cr[ée]dit/i, /^cr[ée]/i],
  balance: [/solde/i, /^montant/i, /^net/i, /^valeur/i],
};

export function detectColumns(matrix: any[][]): { headerRow: number; columns: ColumnMap; headers: string[] } {
  let bestRow = -1;
  let bestScore = 0;
  let bestCols: ColumnMap = {};
  for (let r = 0; r < Math.min(matrix.length, 25); r++) {
    const row = matrix[r] ?? [];
    const cols: ColumnMap = {};
    let score = 0;
    row.forEach((cell, ci) => {
      const s = cellToString(cell).trim();
      if (!s) return;
      for (const key of Object.keys(HEADER_HINTS) as (keyof ColumnMap)[]) {
        if (cols[key] !== undefined) continue;
        if (HEADER_HINTS[key].some((re) => re.test(s))) {
          cols[key] = ci;
          score += key === 'code' || key === 'label' ? 2 : 1;
          break;
        }
      }
    });
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
      bestCols = cols;
    }
  }
  const headers = bestRow >= 0 ? (matrix[bestRow] ?? []).map((c) => cellToString(c).trim()) : [];
  return { headerRow: bestRow, columns: bestCols, headers };
}

function looksLikeCode(v: string): boolean {
  const s = v.trim();
  return /^\d{2,12}([./-]\d{1,6})?$/.test(s) && s.length >= 3;
}

export function buildExtraction(
  matrix: any[][],
  opts: { format: ExtractResult['format']; sheet?: string; columnMap?: ColumnMap; hasHeader?: boolean } = {
    format: 'xlsx',
  },
): ExtractResult {
  const warnings: string[] = [];
  const rows: ExtractedRow[] = [];
  const detected = detectColumns(matrix);
  const columns: ColumnMap = { ...detected.columns, ...(opts.columnMap ?? {}) };
  const headerRow = opts.hasHeader === false ? -1 : detected.headerRow;

  if (columns.code === undefined && columns.label === undefined && columns.debit === undefined && columns.credit === undefined && columns.balance === undefined) {
    warnings.push(
      "Aucune colonne de compte, de libellé ou de montant n'a pu être identifiée automatiquement. Utilisez le sélecteur de colonnes pour les désigner manuellement.",
    );
  }

  const start = headerRow >= 0 ? headerRow + 1 : 0;
  for (let r = start; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    if (row.every((c) => cellToString(c).trim() === '')) continue;
    const cells = row.map((c) => cellToString(c).trim());

    let code = columns.code !== undefined ? cells[columns.code] ?? '' : '';
    let label = columns.label !== undefined ? cells[columns.label] ?? '' : '';

    // Sans en-tête exploitable : recherche positionnelle du code de compte.
    if (!code && columns.code === undefined) {
      const idx = cells.findIndex((c) => looksLikeCode(c));
      if (idx >= 0) {
        code = cells[idx];
        if (!label && cells[idx + 1] && !NUM_RE.test(cells[idx + 1])) label = cells[idx + 1];
      }
    }
    if (!label) {
      const idx = cells.findIndex((c) => c && !looksLikeCode(c) && parseNumber(c) === null);
      if (idx >= 0) label = cells[idx];
    }

    const rowWarnings: string[] = [];
    const debit = columns.debit !== undefined ? parseNumber(cells[columns.debit]) : null;
    const credit = columns.credit !== undefined ? parseNumber(cells[columns.credit]) : null;
    const balance = columns.balance !== undefined ? parseNumber(cells[columns.balance]) : null;

    const numerics: { idx: number; value: number }[] = [];
    cells.forEach((c, i) => {
      if (i === columns.code || i === columns.label) return;
      if (i === columns.debit || i === columns.credit || i === columns.balance) return;
      if (c === '') return;
      const n = parseNumber(c);
      if (n !== null && !looksLikeCode(c)) numerics.push({ idx: i, value: n });
    });

    if (debit === null && credit === null && balance === null) {
      if (numerics.length >= 2) {
        // Interprétation débit / crédit (ou montant N / montant N-1)
        rowWarnings.push(
          'Colonnes débit/crédit déduites de la position des montants : à confirmer dans la prévisualisation.',
        );
      } else if (numerics.length === 1) {
        rowWarnings.push('Un seul montant détecté : interprété comme solde net signé.');
      } else {
        if (code || label) rowWarnings.push('Aucun montant numérique exploitable sur cette ligne.');
      }
    }

    let d = debit ?? 0;
    let c = credit ?? 0;
    let b = balance ?? 0;
    if (debit === null && credit === null && balance === null) {
      if (numerics.length >= 3) {
        d = numerics[numerics.length - 3].value;
        c = numerics[numerics.length - 2].value;
        b = numerics[numerics.length - 1].value;
      } else if (numerics.length === 2) {
        d = numerics[0].value;
        c = numerics[1].value;
        b = d - c;
      } else if (numerics.length === 1) {
        b = numerics[0].value;
        if (b >= 0) d = b;
        else c = -b;
      }
    } else if (balance !== null && debit === null && credit === null) {
      if (b >= 0) d = b;
      else c = -b;
    } else if (debit !== null && credit !== null && balance === null) {
      b = d - c;
    }

    if (!code && !label && d === 0 && c === 0 && b === 0) continue;

    if (!code) {
      rowWarnings.push(
        "Aucun code de compte CGNC sur cette ligne : elle ne pourra pas être traitée automatiquement (aucun compte n'est inventé).",
      );
    } else if (!looksLikeCode(code)) {
      rowWarnings.push(`Code de compte inhabituel « ${code} » : à confirmer.`);
    }

    rows.push({
      account_code: code,
      account_label: label,
      debit: round(d),
      credit: round(c),
      balance: round(b),
      raw: cells,
      warnings: rowWarnings,
    });
  }

  const coded = rows.filter((r) => r.account_code).length;
  const totalDebit = round(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = round(rows.reduce((s, r) => s + r.credit, 0));
  const totalBalance = round(rows.reduce((s, r) => s + r.balance, 0));

  if (rows.length === 0) {
    warnings.push("Aucune ligne exploitable n'a été extraite du document.");
  }
  if (coded === 0 && rows.length > 0) {
    warnings.push(
      "Aucun code de compte CGNC n'a été trouvé : utilisez la saisie manuelle ou fournissez une balance générale comportant une colonne de comptes.",
    );
  }
  if (rows.length > 0 && Math.abs(totalDebit - totalCredit) > 0.05) {
    warnings.push(
      `Totaux débit (${totalDebit.toFixed(2)}) et crédit (${totalCredit.toFixed(2)}) différents de ${(totalDebit - totalCredit).toFixed(2)} MAD : vérifier les colonnes détectées.`,
    );
  }

  return {
    ok: rows.length > 0,
    format: opts.format,
    sheets: opts.sheet ? [opts.sheet] : [],
    headers: detected.headers,
    rows,
    warnings,
    meta: {
      rows: rows.length,
      coded,
      uncoded: rows.length - coded,
      totalDebit,
      totalCredit,
      totalBalance,
    },
  };
}

function round(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function detectFormat(filename: string, mime: string): ExtractResult['format'] {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (['xlsx', 'xlsm', 'xls'].includes(ext)) return 'xlsx';
  if (['csv', 'txt', 'tsv'].includes(ext)) return 'csv';
  if (ext === 'pdf') return 'pdf';
  if (['docx', 'doc'].includes(ext)) return 'docx';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'xlsx';
  if (mime.includes('csv')) return 'csv';
  if (mime.includes('pdf')) return 'pdf';
  return 'inconnu';
}

export function matrixFromPdfText(text: string): string[][] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map((line) => {
      // Regroupe les tokens : code de compte, libellé, puis montants.
      const tokens = line.split(/\s{1,}/);
      const out: string[] = [];
      let buffer: string[] = [];
      for (const t of tokens) {
        if (NUM_RE.test(t) && !looksLikeCode(t)) {
          if (buffer.length) {
            out.push(buffer.join(' '));
            buffer = [];
          }
          out.push(t);
        } else if (looksLikeCode(t)) {
          if (buffer.length) {
            out.push(buffer.join(' '));
            buffer = [];
          }
          out.push(t);
        } else {
          buffer.push(t);
        }
      }
      if (buffer.length) out.push(buffer.join(' '));
      return out;
    });
}

export function matrixFromDelimited(rows: string[][]): string[][] {
  return rows.map((r) => r.map((c) => c.trim()));
}
