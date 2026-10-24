/**
 * RAPPORT DE CONVERSION PDF (pdfkit)
 * Contenu conforme au cahier des charges : page de garde, identification du
 * dossier, documents analysés, méthodologie, tableau de passage, synthèse des
 * retraitements validés, écritures, justifications normatives, contrôles de
 * cohérence, limites et informations manquantes.
 */
import PDFDocument from 'pdfkit';
import { all, get } from '../db.ts';
import { buildPassage, groupLabel, GROUP_ORDER } from './statements.ts';
import { runControls } from './controls.ts';
import { round2 } from './compute.ts';

const NAVY = '#0f2743';
const TEAL = '#118d8c';
const GREY = '#555555';
const LIGHT = '#e3ecf7';

type Doc = PDFKit.PDFDocument;

function money(n: number, currency = 'MAD'): string {
  const v = round2(n);
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const s = abs
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${s} ${currency}`;
}

class Report {
  doc: Doc;
  y = 0;
  margin = 50;
  width = 0;
  currency = 'MAD';
  pageCount = 0;

  constructor(currency = 'MAD') {
    this.currency = currency;
    this.doc = new PDFDocument({ size: 'A4', margin: this.margin, bufferPages: true });
    this.width = this.doc.page.width - this.margin * 2;
    this.y = this.margin;
  }

  get bottom() {
    return this.doc.page.height - this.margin - 30;
  }

  ensure(h: number) {
    if (this.y + h > this.bottom) {
      this.doc.addPage();
      this.y = this.margin;
    }
  }

  h1(text: string) {
    this.ensure(40);
    this.doc.font('Helvetica-Bold').fontSize(16).fillColor(NAVY).text(text, this.margin, this.y);
    this.y += 22;
    this.doc
      .moveTo(this.margin, this.y)
      .lineTo(this.margin + this.width, this.y)
      .strokeColor(TEAL)
      .lineWidth(2)
      .stroke();
    this.y += 10;
  }

  h2(text: string) {
    this.ensure(30);
    this.doc.font('Helvetica-Bold').fontSize(11.5).fillColor(NAVY).text(text, this.margin, this.y);
    this.y += 17;
  }

  para(text: string, opts: { bold?: boolean; size?: number; color?: string; indent?: number } = {}) {
    const size = opts.size ?? 9.5;
    this.doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(opts.color ?? '#222222');
    const x = this.margin + (opts.indent ?? 0);
    const h = this.doc.heightOfString(text, { width: this.width - (opts.indent ?? 0) });
    this.ensure(h + 4);
    this.doc.text(text, x, this.y, { width: this.width - (opts.indent ?? 0) });
    this.y += h + 5;
  }

  bullets(items: string[]) {
    for (const it of items) this.para(`•  ${it}`, { indent: 8 });
  }

  table(headers: string[], rows: (string | number)[][], widths: number[], opts: { boldRow?: (r: (string | number)[], i: number) => boolean; align?: ('l' | 'r')[] } = {}) {
    const total = widths.reduce((a, b) => a + b, 0);
    const scale = this.width / total;
    const w = widths.map((x) => x * scale);
    const drawHeader = () => {
      this.ensure(24);
      let x = this.margin;
      this.doc.rect(this.margin, this.y, this.width, 18).fill(NAVY);
      this.doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff');
      headers.forEach((h, i) => {
        this.doc.text(h, x + 3, this.y + 5, { width: w[i] - 6, align: (opts.align?.[i] ?? 'l') === 'r' ? 'right' : 'left' });
        x += w[i];
      });
      this.y += 18;
    };
    drawHeader();
    rows.forEach((row, ri) => {
      const bold = opts.boldRow?.(row, ri) ?? false;
      const heights = row.map((c, i) =>
        this.doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).heightOfString(String(c ?? ''), { width: w[i] - 6 }),
      );
      const h = Math.max(14, ...heights) + 4;
      if (this.y + h > this.bottom) {
        this.doc.addPage();
        this.y = this.margin;
        drawHeader();
      }
      if (bold || ri % 2 === 1) {
        this.doc.rect(this.margin, this.y, this.width, h).fill(bold ? LIGHT : '#f7f9fc');
      }
      let x = this.margin;
      this.doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor('#1a1a1a');
      row.forEach((c, i) => {
        this.doc.text(String(c ?? ''), x + 3, this.y + 3, {
          width: w[i] - 6,
          align: (opts.align?.[i] ?? 'l') === 'r' ? 'right' : 'left',
        });
        x += w[i];
      });
      this.y += h;
      this.doc.moveTo(this.margin, this.y).lineTo(this.margin + this.width, this.y).strokeColor('#dddddd').lineWidth(0.5).stroke();
    });
    this.y += 8;
  }

  kv(pairs: [string, string][]) {
    for (const [k, v] of pairs) {
      this.doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY);
      this.ensure(16);
      this.doc.text(`${k} : `, this.margin, this.y, { continued: true });
      this.doc.font('Helvetica').fillColor('#222222').text(v);
      this.y = this.doc.y + 2;
    }
    this.y += 4;
  }

  finish(): Promise<Buffer> {
    const range = this.doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      this.doc.switchToPage(i);
      const y = this.doc.page.height - 40;
      this.doc.font('Helvetica').fontSize(7.5).fillColor(GREY);
      this.doc.text(
        'IFRS Bridge Maroc — Plateforme intelligente de conversion comptable CGNC → IAS/IFRS — Document généré automatiquement, à soumettre à revue professionnelle.',
        this.margin,
        y,
        { width: this.width - 60 },
      );
      this.doc.text(`Page ${i + 1} / ${range.count}`, this.margin + this.width - 60, y, {
        width: 60,
        align: 'right',
      });
    }
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      this.doc.on('data', (c) => chunks.push(c));
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.end();
    });
  }
}

export async function generateReport(dossierId: string, onlyApproved = true): Promise<Buffer> {
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [dossierId]);
  const currency = dossier?.currency || 'MAD';
  const p = buildPassage(dossierId, onlyApproved);
  const { controls, summary } = runControls(dossierId);
  const documents = all('SELECT * FROM documents WHERE dossier_id = ? ORDER BY uploaded_at', [dossierId]);
  const adjustments = all('SELECT * FROM adjustments WHERE dossier_id = ? ORDER BY ref', [dossierId]);
  const entries = all('SELECT * FROM entries WHERE dossier_id = ? ORDER BY ref, rowid', [dossierId]);
  const assumptions = all('SELECT * FROM assumptions WHERE dossier_id = ? ORDER BY norm_code, scope, key', [dossierId]);
  const totals = all('SELECT COUNT(*) AS n FROM gl_lines WHERE dossier_id = ?', [dossierId]);
  const user = get('SELECT name, email FROM users WHERE id = ?', [dossier?.user_id]);

  const r = new Report(currency);

  /* ---------------------------------------------------------- Page de garde */
  r.doc.rect(0, 0, r.doc.page.width, 250).fill(NAVY);
  r.doc.font('Helvetica-Bold').fontSize(26).fillColor('#ffffff').text('IFRS Bridge Maroc', r.margin, 80, {
    width: r.width,
  });
  r.doc.font('Helvetica').fontSize(12).fillColor(TEAL).text('Plateforme intelligente de conversion comptable CGNC → IAS/IFRS', r.margin, 116, { width: r.width });
  r.doc
    .moveTo(r.margin, 148)
    .lineTo(r.margin + 120, 148)
    .strokeColor(TEAL)
    .lineWidth(3)
    .stroke();
  r.doc.font('Helvetica-Bold').fontSize(15).fillColor('#ffffff').text('Rapport de conversion CGNC → IFRS', r.margin, 168, { width: r.width });
  r.doc.font('Helvetica').fontSize(10).fillColor('#c2d6ec').text(`Dossier : ${dossier?.name}`, r.margin, 196, { width: r.width });
  r.doc.fontSize(9).fillColor('#8fb4da').text(`Généré le ${new Date().toLocaleString('fr-FR')}`, r.margin, 212, { width: r.width });
  r.y = 280;

  r.h2('Identification du dossier et de la période comptable');
  r.kv([
    ['Entreprise', String(dossier?.company_name || '—')],
    ['Dossier de conversion', String(dossier?.name || '—')],
    ['Exercice comptable', String(dossier?.exercice || '—')],
    ['Date de clôture', String(dossier?.closing_date || '—')],
    ['Devise de présentation', currency],
    ['Nature de la conversion', String(dossier?.conversion_type || '—')],
    ['Référentiel de présentation retenu', String(dossier?.framework || 'IAS 1')],
    ['Mode', Number(dossier?.is_demo) === 1 ? 'Démonstration pédagogique (données fictives)' : 'Dossier utilisateur'],
    ['Préparé par', user ? `${user.name} (${user.email})` : '—'],
    ['Périmètre des retraitements inclus', onlyApproved ? 'Retraitements validés uniquement' : 'Tous les retraitements (version provisoire)'],
  ]);

  /* ------------------------------------------------------------- Documents */
  r.h1('1. Documents analysés');
  if (documents.length === 0) {
    r.para("Aucun document n'a été importé pour ce dossier.");
  } else {
    r.table(
      ['Type', 'Fichier', 'Format', 'Lignes', 'Statut', 'Message'],
      documents.map((d) => [
        d.kind,
        d.filename,
        (d.filename || '').split('.').pop() || d.mime,
        String(d.rows || 0),
        d.status,
        String(d.message || '').slice(0, 90),
      ]),
      [14, 26, 10, 8, 14, 40],
    );
    r.para(`Nombre total de lignes comptables enregistrées dans le dossier : ${totals[0]?.n ?? 0}.`, { size: 9 });
  }

  /* ---------------------------------------------------------- Méthodologie */
  r.h1('2. Méthodologie de conversion');
  r.bullets([
    "Extraction des données CGNC (Excel, CSV, PDF texte ou saisie manuelle) sans invention de compte ni de montant : toute valeur illisible ou ambiguë est signalée.",
    "Correspondance des comptes CGNC vers les rubriques IFRS selon la nature économique du poste, son échéance et les justificatifs disponibles (pas une simple recherche de mots-clés).",
    "Identification des divergences potentielles CGNC / IAS-IFRS par le moteur d'analyse normatif, sans retraiter un poste par défaut.",
    "Demande d'informations complémentaires lorsque les conditions d'application d'une norme ne peuvent être vérifiées ; dans ce cas, aucun montant n'est calculé.",
    "Calcul des retraitements par un moteur déterministe (arithmétique vérifiable, traces de calcul conservées) ; l'IA n'intervient que pour l'analyse et la justification, jamais pour produire un montant définitif.",
    "Génération d'écritures en partie double avec contrôle systématique de l'égalité débit = crédit.",
    "Construction du tableau de passage avec conventions de signe explicites, puis contrôle de l'équation comptable : total actif = capitaux propres + passifs.",
    "Traçabilité complète : hypothèses, calculs, sources documentaires, interventions humaines et statuts de validation.",
  ]);

  /* ------------------------------------------------------ Tableau de passage */
  r.h1('3. Tableau de passage CGNC → IFRS');
  r.para(
    `Conventions de signe : les comptes à solde naturel débiteur (actifs, charges) contribuent pour (débit − crédit) ; les comptes à solde naturel créditeur (passifs, capitaux propres, produits) contribuent pour (crédit − débit). Les comptes soustractifs (28, 29, 39, 59) réduisent donc naturellement les rubriques d'actif. Aucune addition arbitraire de débits et de crédits n'est réalisée.`,
    { size: 8.5, color: GREY },
  );
  for (const g of GROUP_ORDER) {
    const s = p.sections.find((x) => x.group === g);
    if (!s || s.rows.length === 0) continue;
    r.h2(groupLabel(g));
    r.table(
      ['Rubrique IFRS', 'Solde CGNC', 'Reclassements', 'Ajustements IFRS', 'Solde IFRS'],
      [
        ...s.rows.map((row) => [
          row.rubric,
          money(row.soldeCGNC, currency),
          money(row.reclassements, currency),
          money(row.ajustements, currency),
          money(row.soldeIFRS, currency),
        ]),
        [`TOTAL ${groupLabel(g).toUpperCase()}`, money(s.totalCGNC, currency), money(s.totalReclassements, currency), money(s.totalAjustements, currency), money(s.totalIFRS, currency)],
      ],
      [46, 14, 13, 14, 14],
      { align: ['l', 'r', 'r', 'r', 'r'], boldRow: (row) => String(row[0]).startsWith('TOTAL') },
    );
  }

  r.h2('Contrôle de l’équation comptable');
  r.table(
    ['Agrégat', 'CGNC', 'IFRS'],
    [
      ['Total actif', money(p.balance.actifCGNC, currency), money(p.balance.actifIFRS, currency)],
      ['Total capitaux propres', money(p.balance.cpCGNC, currency), money(p.balance.cpIFRS, currency)],
      ['Total passifs', money(p.balance.passifCGNC, currency), money(p.balance.passifIFRS, currency)],
      ['Capitaux propres + passifs', money(round2(p.balance.cpCGNC + p.balance.passifCGNC), currency), money(round2(p.balance.cpIFRS + p.balance.passifIFRS), currency)],
      ['Écart (actif − CP − passifs)', money(p.balance.ecartCGNC, currency), money(p.balance.ecartIFRS, currency)],
      ['Équilibre', p.balance.equilibreCGNC ? 'Équilibré' : 'ÉCART', p.balance.equilibreIFRS ? 'Équilibré' : 'ÉCART'],
    ],
    [46, 27, 27],
    { align: ['l', 'r', 'r'], boldRow: (row) => String(row[0]).startsWith('Écart') || String(row[0]) === 'Équilibre' },
  );

  /* ------------------------------------------------------------- Résultat */
  r.h1('4. Rapprochement du résultat et des capitaux propres');
  r.table(
    ['Rubrique', 'Groupe', 'CGNC', 'Ajustements IFRS', 'IFRS'],
    [
      ...p.result.detail.map((d) => [d.rubric, groupLabel(d.group as any) || d.group, money(d.cgnc, currency), money(d.ajustement, currency), money(d.cgnc + d.ajustement, currency)]),
      ['RÉSULTAT NET', '', money(p.result.resultatCGNC, currency), money(round2(p.result.resultatIFRS - p.result.resultatCGNC), currency), money(p.result.resultatIFRS, currency)],
    ],
    [46, 16, 13, 13, 13],
    { align: ['l', 'l', 'r', 'r', 'r'], boldRow: (row) => String(row[0]).startsWith('RÉSULTAT') },
  );
  r.table(
    ['Capitaux propres', 'CGNC', 'Ajustements IFRS', 'IFRS'],
    [
      ...p.equity.map((e) => [e.rubric, money(e.cgnc, currency), money(e.ajustement, currency), money(e.ifrs, currency)]),
      ['TOTAL CAPITAUX PROPRES', money(p.balance.cpCGNC, currency), money(p.totalEquityImpact, currency), money(p.balance.cpIFRS, currency)],
    ],
    [50, 17, 17, 16],
    { align: ['l', 'r', 'r', 'r'], boldRow: (row) => String(row[0]).startsWith('TOTAL') },
  );

  /* -------------------------------------------- Synthèse des retraitements */
  r.h1('5. Synthèse des retraitements');
  if (adjustments.length === 0) {
    r.para('Aucun retraitement généré pour ce dossier.');
  } else {
    r.table(
      ['Réf.', 'Poste CGNC', 'Norme', 'Type', 'Montant', 'Statut', 'Intégré'],
      adjustments.map((a) => {
        const u = p.adjustments.find((x) => x.ref === a.ref);
        return [
          a.ref,
          String(a.poste_cgnc).slice(0, 34),
          a.norm_code,
          a.type,
          money(Number(a.amount), currency),
          a.status,
          u ? (u.included ? 'Oui' : 'Non') : 'Non',
        ];
      }),
      [8, 30, 11, 15, 15, 14, 9],
      { align: ['l', 'l', 'l', 'l', 'r', 'l', 'l'] },
    );
    r.para(
      "Un retraitement non validé n'est pas intégré aux états financiers définitifs. Les lignes marquées « Non » sont exclues du tableau de passage de la version définitive.",
      { size: 8.5, color: GREY },
    );
  }

  /* ------------------------------------------------------- Fiches détaillées */
  r.h1('6. Justifications et références normatives');
  for (const a of adjustments) {
    const u = p.adjustments.find((x) => x.ref === a.ref);
    let details: any = {};
    let steps: any[] = [];
    let refs: any[] = [];
    let missing: any[] = [];
    try {
      details = JSON.parse(a.details_json || '{}');
    } catch {}
    try {
      steps = JSON.parse(a.computations_json || '[]');
    } catch {}
    try {
      refs = JSON.parse(a.refs_json || '[]');
    } catch {}
    try {
      missing = JSON.parse(a.missing_json || '[]');
    } catch {}

    r.ensure(60);
    r.h2(`${a.ref} — ${a.title}`);
    r.para(`Norme : ${a.norm_code} · Type : ${a.type} · Catégorie : ${a.category} · Montant : ${money(Number(a.amount), currency)} · Statut : ${a.status}${u && !u.included ? ` · NON intégré (${u.reason})` : ''}`, { size: 9, bold: true });
    r.para('A. Situation initiale en CGNC', { bold: true, size: 9.5 });
    r.para(`Poste : ${a.poste_cgnc}${a.account_code ? ` — compte ${a.account_code}` : ''}.`, { size: 9, indent: 8 });
    const detailPairs = Object.entries(details).filter(
      ([k, v]) => !['impacts', 'notes', 'rubric_effects', 'pl_effects', 'required'].includes(k) && v !== null && v !== '' && typeof v !== 'object',
    );
    if (detailPairs.length) {
      r.para(detailPairs.map(([k, v]) => `${k} = ${v}`).join(' · '), { size: 8.5, indent: 8, color: GREY });
    }
    if (Array.isArray(details.notes) && details.notes.length) r.bullets(details.notes);

    r.para('B. Analyse selon IAS/IFRS', { bold: true, size: 9.5 });
    r.para(a.rationale || 'Justification non renseignée.', { size: 9, indent: 8 });

    if (steps.length) {
      r.para('C. Calcul du retraitement (moteur déterministe)', { bold: true, size: 9.5 });
      r.table(
        ['Étape', 'Formule', 'Résultat'],
        steps.map((s) => [s.label, String(s.formula).slice(0, 70), `${s.result} ${s.unit ?? ''}`]),
        [40, 46, 18],
        { align: ['l', 'l', 'r'] },
      );
    }

    const adjEntries = entries.filter((e) => e.ref === a.ref);
    if (adjEntries.length) {
      r.para('D. Écriture comptable proposée', { bold: true, size: 9.5 });
      r.table(
        ['Date', 'Compte / rubrique', 'Libellé', 'Débit', 'Crédit'],
        [
          ...adjEntries.map((e) => [
            String(e.date).slice(0, 10),
            `${e.account_code} — ${String(e.account_label).slice(0, 26)}`,
            String(e.label).slice(0, 58),
            money(Number(e.debit), currency),
            money(Number(e.credit), currency),
          ]),
          [
            '',
            'TOTAL',
            '',
            money(adjEntries.reduce((s, e) => s + Number(e.debit), 0), currency),
            money(adjEntries.reduce((s, e) => s + Number(e.credit), 0), currency),
          ],
        ],
        [11, 26, 40, 12, 12],
        { align: ['l', 'l', 'l', 'r', 'r'], boldRow: (row) => row[1] === 'TOTAL' },
      );
    }

    if (details.impacts) {
      r.para('E. Impact financier', { bold: true, size: 9.5 });
      r.table(
        ['Actif', 'Passif', 'Capitaux propres', 'Résultat'],
        [[money(details.impacts.actif ?? 0, currency), money(details.impacts.passif ?? 0, currency), money(details.impacts.capitaux_propres ?? 0, currency), money(details.impacts.resultat ?? 0, currency)]],
        [25, 25, 25, 25],
        { align: ['r', 'r', 'r', 'r'] },
      );
    }

    if (missing.length) {
      r.para('F. Informations complémentaires requises (aucun montant calculé)', { bold: true, size: 9.5, color: '#b45309' });
      r.bullets(missing.map((m: any) => m.label));
    }

    if (refs.length) {
      r.para('G. Sources normatives utilisées', { bold: true, size: 9.5 });
      r.table(
        ['Norme', 'Paragraphe', 'Principe (reformulation)', 'Source', 'Vérification'],
        refs.map((x: any) => [x.norm, x.number, String(x.text).slice(0, 130), String(x.source || '—').slice(0, 40), x.verified ? 'Vérifiée' : 'Référence à vérifier']),
        [10, 12, 48, 20, 15],
      );
    }
  }

  /* ------------------------------------------------------- Écritures globales */
  r.h1('7. Journal des écritures de retraitement');
  if (entries.length === 0) {
    r.para('Aucune écriture de retraitement enregistrée.');
  } else {
    r.table(
      ['Date', 'Réf.', 'Norme', 'Compte', 'Libellé', 'Débit', 'Crédit'],
      [
        ...entries.map((e) => [
          String(e.date).slice(0, 10),
          e.ref,
          e.norm_code,
          e.account_code,
          String(e.label).slice(0, 60),
          money(Number(e.debit), currency),
          money(Number(e.credit), currency),
        ]),
        [
          '',
          '',
          '',
          '',
          'TOTAL GÉNÉRAL',
          money(entries.reduce((s, e) => s + Number(e.debit), 0), currency),
          money(entries.reduce((s, e) => s + Number(e.credit), 0), currency),
        ],
      ],
      [11, 7, 8, 14, 40, 11, 11],
      { align: ['l', 'l', 'l', 'l', 'l', 'r', 'r'], boldRow: (row) => row[4] === 'TOTAL GÉNÉRAL' },
    );
    const td = entries.reduce((s, e) => s + Number(e.debit), 0);
    const tc = entries.reduce((s, e) => s + Number(e.credit), 0);
    r.para(
      Math.abs(td - tc) < 0.01
        ? 'Contrôle : le journal des retraitements est équilibré (total débit = total crédit).'
        : `Contrôle : ÉCART de ${money(td - tc, currency)} entre le total des débits et le total des crédits.`,
      { bold: true, size: 9 },
    );
  }

  /* ------------------------------------------------------ Contrôles qualité */
  r.h1('8. Contrôles de cohérence');
  r.table(
    ['Contrôle', 'Statut', 'Détail', 'Valeur'],
    controls.map((c) => [
      c.label,
      c.status === 'conforme' ? 'Conforme' : c.status === 'a_verifier' ? 'À vérifier' : 'Bloquant',
      c.detail,
      c.value ?? '',
    ]),
    [30, 11, 47, 12],
  );
  r.para(
    `Synthèse : ${summary.conforme} contrôle(s) conforme(s), ${summary.a_verifier} à vérifier, ${summary.bloquant} bloquant(s).`,
    { bold: true, size: 9.5 },
  );

  /* --------------------------------------------- Hypothèses et informations */
  r.h1('9. Hypothèses de calcul et informations manquantes');
  if (assumptions.length === 0) {
    r.para("Aucune hypothèse de calcul n'a été saisie pour ce dossier.");
  } else {
    r.table(
      ['Norme', 'Périmètre', 'Clé', 'Libellé', 'Valeur', 'Origine', 'Validée'],
      assumptions.map((a) => [
        a.norm_code,
        String(a.scope || '—').slice(0, 20),
        a.key,
        String(a.label).slice(0, 40),
        String(a.value),
        String(a.source || '—').slice(0, 30),
        Number(a.validated) === 1 ? 'Oui' : 'Non',
      ]),
      [10, 16, 18, 30, 12, 20, 8],
    );
  }
  const allMissing = adjustments.flatMap((a) => {
    try {
      return (JSON.parse(a.missing_json || '[]') as any[]).map((m) => ({ ref: a.ref, norm: a.norm_code, label: m.label }));
    } catch {
      return [];
    }
  });
  if (allMissing.length) {
    r.h2('Informations complémentaires requises');
    r.table(
      ['Réf.', 'Norme', 'Information requise'],
      allMissing.map((m) => [m.ref, m.norm, m.label]),
      [8, 12, 80],
    );
  }

  /* ----------------------------------------------------------- Limites */
  r.h1('10. Limites, périmètre et conclusion');
  r.bullets([
    "Ce rapport est un document d'aide à la conversion : il ne constitue pas un jeu d'états financiers IFRS complet et ne peut se substituer à une revue professionnelle (expert-comptable, commissaire aux comptes).",
    "Les informations à fournir en annexe (notes) sont partiellement couvertes : seules les notes relatives aux retraitements calculés sont présentées.",
    "Les états financiers produits couvrent le périmètre des données disponibles. Les éléments non couverts sont explicitement listés dans la section 9.",
    "Aucun retraitement n'est présenté comme définitif tant qu'il n'a pas été validé par un utilisateur : les lignes non validées sont exclues de la version définitive.",
    "La conversion des comptes sociaux CGNC n'est pas une consolidation au sens d'IFRS 10 : aucune donnée de périmètre, de contrôle ou d'entités du groupe n'est traitée par cette version.",
    "Les numéros de paragraphe des normes utilisés proviennent de la bibliothèque documentaire de l'application et sont marqués « Référence à vérifier » jusqu'à validation par l'administrateur à partir du texte officiel.",
    "Les taux d'actualisation, durées d'utilité et valeurs résiduelles retenus proviennent exclusivement des hypothèses saisies et validées par l'utilisateur ; ils sont tracés dans la section 9.",
  ]);
  r.para(
    `Conclusion : la conversion porte sur ${adjustments.length} retraitement(s) identifié(s), dont ${p.adjustments.filter((a) => a.included).length} intégré(s) dans la version ${onlyApproved ? 'définitive (validés)' : 'provisoire (tous)'}. Impact total sur les capitaux propres : ${money(p.totalEquityImpact, currency)}.`,
    { bold: true, size: 9.5 },
  );

  return r.finish();
}
