/**
 * CONSTRUCTION DU TABLEAU DE PASSAGE CGNC → IFRS ET DES ÉTATS FINANCIERS
 * ---------------------------------------------------------------------------
 * Conventions de signe (contrôle qualité obligatoire) :
 *   - Un compte dont le solde naturel est débiteur (actif, charge) contribue
 *     pour (débit − crédit).
 *   - Un compte dont le solde naturel est créditeur (passif, capitaux propres,
 *     produit) contribue pour (crédit − débit).
 *   - Les comptes soustractifs (28, 29, 39, 59) sont des comptes à solde
 *     créditeur : ils réduisent donc naturellement la rubrique d'actif.
 * Aucune addition arbitraire de débits et de crédits n'est effectuée.
 */
import { all, get } from '../db.ts';
import { findRule, type IfrsGroup } from '../seed/cgnc-map.ts';
import { accountTotals, type AccountTotal } from './analysis.ts';
import { round2, RUBRIC_RESULT } from './compute.ts';

export type Contribution = {
  ref: string;
  title: string;
  norm: string;
  status: string;
  category: 'ajustement' | 'reclassement';
  amount: number;
};

export type PassageRow = {
  rubric: string;
  group: IfrsGroup;
  soldeCGNC: number;
  reclassements: number;
  ajustements: number;
  soldeIFRS: number;
  contributions: Contribution[];
};

export type PassageSection = {
  group: IfrsGroup;
  label: string;
  rows: PassageRow[];
  totalCGNC: number;
  totalReclassements: number;
  totalAjustements: number;
  totalIFRS: number;
};

export type AdjustmentUsage = {
  ref: string;
  title: string;
  norm: string;
  status: string;
  amount: number;
  category: string;
  included: boolean;
  reason: string;
};

export type Passage = {
  onlyApproved: boolean;
  sections: PassageSection[];
  rows: PassageRow[];
  /** Le résultat de l'exercice a été reconstitué à partir des classes 6/7 (compte 119 absent de la balance). */
  resultInjected: boolean;
  balance: {
    actifCGNC: number;
    actifIFRS: number;
    cpCGNC: number;
    cpIFRS: number;
    passifCGNC: number;
    passifIFRS: number;
    ecartCGNC: number;
    ecartIFRS: number;
    equilibreCGNC: boolean;
    equilibreIFRS: boolean;
  };
  result: {
    produitsCGNC: number;
    chargesCGNC: number;
    impotCGNC: number;
    resultatCGNC: number;
    produitsIFRS: number;
    chargesIFRS: number;
    impotIFRS: number;
    resultatIFRS: number;
    detail: { rubric: string; group: string; cgnc: number; ajustement: number; ifrs: number }[];
  };
  equity: {
    rubric: string;
    cgnc: number;
    ajustement: number;
    ifrs: number;
  }[];
  totalEquityImpact: number;
  adjustments: AdjustmentUsage[];
  generatedAt: string;
};

const GROUP_LABELS: Record<IfrsGroup, string> = {
  ACTIF_NON_COURANT: 'Actifs non courants',
  ACTIF_COURANT: 'Actifs courants',
  CAPITAUX_PROPRES: 'Capitaux propres',
  PASSIF_NON_COURANT: 'Passifs non courants',
  PASSIF_COURANT: 'Passifs courants',
  CHARGE: 'Charges',
  PRODUIT: 'Produits',
  IMPOT: 'Impôt sur le résultat',
};

export const GROUP_ORDER: IfrsGroup[] = [
  'ACTIF_NON_COURANT',
  'ACTIF_COURANT',
  'CAPITAUX_PROPRES',
  'PASSIF_NON_COURANT',
  'PASSIF_COURANT',
];

export function groupLabel(g: IfrsGroup): string {
  return GROUP_LABELS[g] ?? g;
}

type Effects = {
  rubric_effects?: { rubric: string; group: IfrsGroup; reclassement: number; ajustement: number }[];
  pl_effects?: { rubric: string; group: 'CHARGE' | 'PRODUIT' | 'IMPOT'; amount: number }[];
  impacts?: { actif: number; passif: number; capitaux_propres: number; resultat: number };
};

export function buildPassage(dossierId: string, onlyApproved = true): Passage {
  const totals = accountTotals(dossierId);
  const manual = all("SELECT * FROM mappings WHERE dossier_id = ? AND origin = 'manuel'", [dossierId]);
  const manualByCode = new Map<string, any>(manual.map((m) => [m.account_code, m]));

  const rowMap = new Map<string, PassageRow>();
  const keyOf = (group: string, rubric: string) => `${group}||${rubric}`;

  const ensureRow = (group: IfrsGroup, rubric: string): PassageRow => {
    const k = keyOf(group, rubric);
    let row = rowMap.get(k);
    if (!row) {
      row = { rubric, group, soldeCGNC: 0, reclassements: 0, ajustements: 0, soldeIFRS: 0, contributions: [] };
      rowMap.set(k, row);
    }
    return row;
  };

  /* --------------------------------------------- 1. Colonne « solde CGNC » */
  const unmapped: AccountTotal[] = [];
  for (const t of totals) {
    const m = manualByCode.get(t.code);
    const rule = findRule(t.code);
    const group = (m?.ifrs_group || rule?.ifrsGroup) as IfrsGroup | undefined;
    const rubric = (m?.ifrs_line || rule?.ifrsLine) as string | undefined;
    if (!group || !rubric) {
      unmapped.push(t);
      continue;
    }
    const sign = m ? (m.side as 'debit' | 'credit') : rule!.sign;
    const contribution = round2(sign === 'credit' ? t.credit - t.debit : t.debit - t.credit);
    const row = ensureRow(group, rubric);
    row.soldeCGNC = round2(row.soldeCGNC + contribution);
  }

  /* --------------- 1 bis. Rattachement du résultat de l'exercice aux CP --- */
  // Une balance générale est souvent présentée avant affectation du résultat :
  // le compte 119 n'y figure pas. Le résultat est alors reconstitué à partir des
  // comptes de charges et de produits (classes 6 et 7) et rattaché aux capitaux
  // propres, sans double comptabilisation lorsque le compte de résultat est
  // déjà présent au bilan.
  const sumGroupCGNC = (group: IfrsGroup) =>
    round2([...rowMap.values()].filter((r) => r.group === group).reduce((s, r) => s + r.soldeCGNC, 0));
  const existingResultRow = rowMap.get(keyOf('CAPITAUX_PROPRES', RUBRIC_RESULT));
  const resultAlreadyInBalance = !!existingResultRow && Math.abs(existingResultRow.soldeCGNC) > 0.01;
  const reconstructedResult = round2(
    sumGroupCGNC('PRODUIT') - sumGroupCGNC('CHARGE') - sumGroupCGNC('IMPOT'),
  );
  let resultInjected = false;
  if (!resultAlreadyInBalance && Math.abs(reconstructedResult) > 0.01) {
    const row = ensureRow('CAPITAUX_PROPRES', RUBRIC_RESULT);
    row.soldeCGNC = round2(row.soldeCGNC + reconstructedResult);
    resultInjected = true;
  }

  /* ------------------------------- 2. Colonnes reclassements / ajustements */
  const adjustments = all(
    "SELECT * FROM adjustments WHERE dossier_id = ? AND status <> 'rejete' ORDER BY ref",
    [dossierId],
  );

  const usage: AdjustmentUsage[] = [];
  for (const adj of adjustments) {
    const details = safeParse<Effects>(adj.details_json);
    const approved = adj.status === 'approuve';
    const hasEntries = all('SELECT id FROM entries WHERE adjustment_id = ?', [adj.id]).length > 0;
    const isPendingInfo = adj.status === 'informations_requises' || (adj.missing_json && adj.missing_json !== '[]');
    let included = true;
    let reason = 'Retraitement intégré au tableau de passage.';
    if (onlyApproved && !approved) {
      included = false;
      reason = "Retraitement non validé : exclu des états financiers définitifs (conformément aux règles de validation).";
    } else if (isPendingInfo && !hasEntries) {
      included = false;
      reason = "Informations complémentaires requises : aucun montant calculé, retraitement non intégré.";
    }

    usage.push({
      ref: adj.ref,
      title: adj.title,
      norm: adj.norm_code,
      status: adj.status,
      amount: Number(adj.amount) || 0,
      category: adj.category,
      included,
      reason,
    });

    if (!included) continue;

    for (const e of details.rubric_effects ?? []) {
      const row = ensureRow(e.group, e.rubric);
      row.reclassements = round2(row.reclassements + (e.reclassement || 0));
      row.ajustements = round2(row.ajustements + (e.ajustement || 0));
      const amount = round2((e.reclassement || 0) + (e.ajustement || 0));
      if (Math.abs(amount) > 0.001) {
        row.contributions.push({
          ref: adj.ref,
          title: adj.title,
          norm: adj.norm_code,
          status: adj.status,
          category: adj.category,
          amount,
        });
      }
    }
  }

  for (const row of rowMap.values()) {
    row.soldeCGNC = round2(row.soldeCGNC);
    row.soldeIFRS = round2(row.soldeCGNC + row.reclassements + row.ajustements);
  }

  const allRows = [...rowMap.values()];

  /* ------------------------------------------------------ 3. Sections bilan */
  const sections: PassageSection[] = GROUP_ORDER.map((group) => {
    const rows = allRows
      .filter((r) => r.group === group)
      .sort((a, b) => b.soldeIFRS - a.soldeIFRS || a.rubric.localeCompare(b.rubric));
    const sum = (sel: (r: PassageRow) => number) => round2(rows.reduce((s, r) => s + sel(r), 0));
    return {
      group,
      label: groupLabel(group),
      rows,
      totalCGNC: sum((r) => r.soldeCGNC),
      totalReclassements: sum((r) => r.reclassements),
      totalAjustements: sum((r) => r.ajustements),
      totalIFRS: sum((r) => r.soldeIFRS),
    };
  });

  const totalOf = (groups: IfrsGroup[], sel: (s: PassageSection) => number) =>
    round2(sections.filter((s) => groups.includes(s.group)).reduce((acc, s) => acc + sel(s), 0));

  const actifCGNC = totalOf(['ACTIF_NON_COURANT', 'ACTIF_COURANT'], (s) => s.totalCGNC);
  const actifIFRS = totalOf(['ACTIF_NON_COURANT', 'ACTIF_COURANT'], (s) => s.totalIFRS);
  const cpCGNC = totalOf(['CAPITAUX_PROPRES'], (s) => s.totalCGNC);
  const cpIFRS = totalOf(['CAPITAUX_PROPRES'], (s) => s.totalIFRS);
  const passifCGNC = totalOf(['PASSIF_NON_COURANT', 'PASSIF_COURANT'], (s) => s.totalCGNC);
  const passifIFRS = totalOf(['PASSIF_NON_COURANT', 'PASSIF_COURANT'], (s) => s.totalIFRS);

  /* ------------------------------------------------ 4. État du résultat */
  const plMap = new Map<string, { rubric: string; group: string; cgnc: number; ajustement: number; ifrs: number }>();
  for (const r of allRows) {
    if (r.group === 'CHARGE' || r.group === 'PRODUIT' || r.group === 'IMPOT') {
      plMap.set(r.rubric, { rubric: r.rubric, group: r.group, cgnc: r.soldeCGNC, ajustement: round2(r.reclassements + r.ajustements), ifrs: r.soldeIFRS });
    }
  }
  for (const adj of adjustments) {
    if (onlyApproved && adj.status !== 'approuve') continue;
    const details = safeParse<Effects>(adj.details_json);
    if (adj.status === 'informations_requises') continue;
    if ((details.rubric_effects ?? []).length === 0 && (details.pl_effects ?? []).length === 0) continue;
    for (const e of details.pl_effects ?? []) {
      const cur = plMap.get(e.rubric) ?? { rubric: e.rubric, group: e.group, cgnc: 0, ajustement: 0, ifrs: 0 };
      cur.ajustement = round2(cur.ajustement + e.amount);
      cur.ifrs = round2(cur.cgnc + cur.ajustement);
      plMap.set(e.rubric, cur);
    }
  }
  const detail = [...plMap.values()];
  const sumPl = (group: string, field: 'cgnc' | 'ajustement') =>
    round2(detail.filter((d) => d.group === group).reduce((s, d) => s + d[field], 0));

  const produitsCGNC = sumPl('PRODUIT', 'cgnc');
  const chargesCGNC = sumPl('CHARGE', 'cgnc');
  const impotCGNC = sumPl('IMPOT', 'cgnc');
  const produitsIFRS = round2(produitsCGNC + sumPl('PRODUIT', 'ajustement'));
  const chargesIFRS = round2(chargesCGNC + sumPl('CHARGE', 'ajustement'));
  const impotIFRS = round2(impotCGNC + sumPl('IMPOT', 'ajustement'));

  /* --------------------------------------- 5. Rapprochement des capitaux propres */
  const equityRows = allRows
    .filter((r) => r.group === 'CAPITAUX_PROPRES')
    .map((r) => ({ rubric: r.rubric, cgnc: r.soldeCGNC, ajustement: round2(r.reclassements + r.ajustements), ifrs: r.soldeIFRS }));
  const totalEquityImpact = round2(equityRows.reduce((s, r) => s + r.ajustement, 0));

  return {
    onlyApproved,
    sections,
    rows: allRows,
    resultInjected,
    balance: {
      actifCGNC,
      actifIFRS,
      cpCGNC,
      cpIFRS,
      passifCGNC,
      passifIFRS,
      ecartCGNC: round2(actifCGNC - (cpCGNC + passifCGNC)),
      ecartIFRS: round2(actifIFRS - (cpIFRS + passifIFRS)),
      equilibreCGNC: Math.abs(actifCGNC - (cpCGNC + passifCGNC)) < 0.05,
      equilibreIFRS: Math.abs(actifIFRS - (cpIFRS + passifIFRS)) < 0.05,
    },
    result: {
      produitsCGNC,
      chargesCGNC,
      impotCGNC,
      resultatCGNC: round2(produitsCGNC - chargesCGNC - impotCGNC),
      produitsIFRS,
      chargesIFRS,
      impotIFRS,
      resultatIFRS: round2(produitsIFRS - chargesIFRS - impotIFRS),
      detail,
    },
    equity: equityRows,
    totalEquityImpact,
    adjustments: usage,
    generatedAt: new Date().toISOString(),
  };
}

function safeParse<T>(s: string | null | undefined): T {
  if (!s) return {} as T;
  try {
    return JSON.parse(s) as T;
  } catch {
    return {} as T;
  }
}

export function passageToRows(p: Passage) {
  const out: (string | number)[][] = [];
  for (const s of p.sections) {
    for (const r of s.rows) {
      out.push([s.label, r.rubric, r.soldeCGNC, r.reclassements, r.ajustements, r.soldeIFRS]);
    }
    out.push([
      s.label,
      `TOTAL ${s.label.toUpperCase()}`,
      s.totalCGNC,
      s.totalReclassements,
      s.totalAjustements,
      s.totalIFRS,
    ]);
  }
  out.push([
    'Contrôle',
    'TOTAL ACTIF',
    p.balance.actifCGNC,
    '',
    '',
    p.balance.actifIFRS,
  ]);
  out.push([
    'Contrôle',
    'TOTAL CAPITAUX PROPRES + PASSIFS',
    round2(p.balance.cpCGNC + p.balance.passifCGNC),
    '',
    '',
    round2(p.balance.cpIFRS + p.balance.passifIFRS),
  ]);
  return out;
}

export function dossierExists(dossierId: string) {
  return !!get('SELECT id FROM dossiers WHERE id = ?', [dossierId]);
}
