/**
 * MOTEUR D'ANALYSE NORMATIVE CGNC → IFRS
 * ---------------------------------------------------------------------------
 * 1. Correspondance des comptes CGNC vers les rubriques IFRS (règles de
 *    présentation + nature économique + échéance + justificatifs).
 * 2. Détection des divergences potentielles (règles de vigilance).
 * 3. Alimentation de l'assistant de renseignements complémentaires : un
 *    retraitement n'est proposé QUE si les informations nécessaires existent.
 * 4. Proposition de retraitements chiffrés par le moteur de calcul déterministe.
 *
 * Principe absolu : aucun poste n'est retraité par défaut ; aucune donnée n'est
 * inventée ; un poste sans information suffisante porte le statut
 * « Informations complémentaires requises ».
 */
import { all, get, id, now, run, insert } from '../db.ts';
import { findRule, WATCH_RULES, type IfrsGroup, type WatchRule } from '../seed/cgnc-map.ts';
import {
  computeIas12,
  computeIas16,
  computeIas38WriteOff,
  computeIfrs16,
  computeReclassification,
  round2,
  type CalcStep,
  type ComputeResult,
  type DeferredItem,
  type EngineEntry,
  type PlEffect,
  type RubricEffect,
} from './compute.ts';

export type AccountTotal = {
  code: string;
  label: string;
  debit: number;
  credit: number;
  balance: number;
  sources: string[];
};

const REFERENCE_PRIORITY: string[][] = [
  ['balance'],
  ['saisie'],
  ['bilan', 'cpc'],
  ['journal'],
];

export function referenceKinds(dossierId: string): string[] {
  const kinds = new Set(
    all('SELECT DISTINCT kind FROM documents WHERE dossier_id = ? AND rows > 0', [dossierId]).map(
      (r) => r.kind as string,
    ),
  );
  for (const group of REFERENCE_PRIORITY) {
    if (group.some((k) => kinds.has(k))) return group;
  }
  return [];
}

export function accountTotals(dossierId: string, kinds?: string[]): AccountTotal[] {
  const k = kinds ?? referenceKinds(dossierId);
  if (k.length === 0) return [];
  const placeholders = k.map(() => '?').join(', ');
  const docs = all(
    `SELECT id FROM documents WHERE dossier_id = ? AND kind IN (${placeholders})`,
    [dossierId, ...k],
  ).map((d) => d.id as string);
  if (docs.length === 0) return [];
  const docPh = docs.map(() => '?').join(', ');
  const rows = all(
    `SELECT account_code AS code, account_label AS label, debit, credit, source
     FROM gl_lines WHERE document_id IN (${docPh})`,
    docs,
  );

  const map = new Map<string, AccountTotal>();
  for (const r of rows) {
    const code = String(r.code || '').trim();
    if (!code) continue;
    let entry = map.get(code);
    if (!entry) {
      entry = { code, label: String(r.label || ''), debit: 0, credit: 0, balance: 0, sources: [] };
      map.set(code, entry);
    }
    if (r.label && !entry.label) entry.label = String(r.label);
    entry.debit = round2(entry.debit + Number(r.debit || 0));
    entry.credit = round2(entry.credit + Number(r.credit || 0));
    if (r.source && !entry.sources.includes(String(r.source))) entry.sources.push(String(r.source));
  }
  for (const entry of map.values()) entry.balance = round2(entry.debit - entry.credit);
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export function cpcTotals(dossierId: string): AccountTotal[] {
  const rows = accountTotals(dossierId);
  return rows.filter((r) => r.code.startsWith('6') || r.code.startsWith('7') || r.code.startsWith('8'));
}

/* ------------------------------------------------------------------ Mapping */

export type ProposedMapping = {
  account_code: string;
  account_label: string;
  cgnc_class: number | null;
  cgnc_group: string;
  amount: number;
  side: 'debit' | 'credit';
  ifrs_line: string;
  ifrs_group: IfrsGroup | '';
  nature: string;
  justification: string;
  norm_code: string;
  confidence: number;
  status: string;
};

export function proposeMappings(dossierId: string): ProposedMapping[] {
  const totals = accountTotals(dossierId);
  const out: ProposedMapping[] = [];
  for (const t of totals) {
    const rule = findRule(t.code);
    const balance = t.balance;
    if (!rule) {
      out.push({
        account_code: t.code,
        account_label: t.label,
        cgnc_class: Number(t.code[0]) || null,
        cgnc_group: 'Non référencé',
        amount: round2(Math.abs(balance)),
        side: balance >= 0 ? 'debit' : 'credit',
        ifrs_line: 'À classer',
        ifrs_group: '',
        nature: 'information',
        justification:
          "Compte absent de la table de correspondance CGNC→IFRS. Une affectation manuelle est requise avant la génération du tableau de passage.",
        norm_code: 'IAS 1',
        confidence: 0,
        status: 'a_affecter',
      });
      continue;
    }
    out.push({
      account_code: t.code,
      account_label: t.label || rule.label,
      cgnc_class: rule.cgncClass,
      cgnc_group: rule.cgncGroup,
      amount: round2(Math.abs(balance)),
      side: rule.sign,
      ifrs_line: rule.ifrsLine,
      ifrs_group: rule.ifrsGroup,
      nature: rule.nature,
      justification: rule.justification,
      norm_code: rule.normCode,
      confidence: 0.9,
      status: rule.nature === 'aucun' || rule.nature === 'presentation' ? 'conforme' : 'a_examiner',
    });
  }
  return out;
}

/* ---------------------------------------------------------------- Findings */

export type NormRef = {
  norm: string;
  title: string;
  number: string;
  text: string;
  source: string;
  sourceUrl: string;
  verified: boolean;
  note: string;
};

export function normRefs(normCode: string, limit = 3): NormRef[] {
  const norm = get('SELECT * FROM norms WHERE code = ?', [normCode]);
  if (!norm) {
    return [
      {
        norm: normCode,
        title: '',
        number: '—',
        text: "Aucun extrait indexé pour cette norme dans la bibliothèque documentaire. Ajoutez le document de référence dans « Référentiel normatif » pour rattacher les conclusions à une source vérifiable.",
        source: 'Bibliothèque documentaire (non renseignée)',
        sourceUrl: '',
        verified: false,
        note: 'Référence à vérifier',
      },
    ];
  }
  const paras = all(
    'SELECT * FROM norm_paragraphs WHERE norm_id = ? ORDER BY rowid LIMIT ?',
    [norm.id, limit],
  );
  if (paras.length === 0) {
    return [
      {
        norm: normCode,
        title: norm.title,
        number: '—',
        text: `Norme référencée : ${norm.title}. Aucun paragraphe indexé : référence à vérifier dans le texte officiel.`,
        source: norm.source || 'Bibliothèque documentaire',
        sourceUrl: norm.source_url || '',
        verified: false,
        note: 'Référence à vérifier',
      },
    ];
  }
  return paras.map((p) => ({
    norm: normCode,
    title: norm.title,
    number: p.number,
    text: p.text,
    source: p.source || norm.source,
    sourceUrl: norm.source_url || '',
    verified: Number(p.verified) === 1,
    note: p.note || 'Référence à vérifier dans le texte officiel',
  }));
}

export type Finding = {
  key: string;
  normCode: string;
  type: string;
  severity: 'bloquant' | 'a_verifier' | 'information';
  title: string;
  message: string;
  analyzer: string;
  accounts: { code: string; label: string; amount: number; balance: number }[];
  totalAmount: number;
  requiredInfo: { key: string; label: string }[];
  provided: { key: string; label: string; value: string; validated: boolean }[];
  missing: { key: string; label: string }[];
  status: 'pret' | 'informations_requises' | 'conforme' | 'a_examiner';
  recommendation: string;
};

export function getAssumptions(dossierId: string, normCode?: string, scope?: string) {
  if (normCode && scope) {
    return all('SELECT * FROM assumptions WHERE dossier_id = ? AND norm_code = ? AND scope = ?', [
      dossierId,
      normCode,
      scope,
    ]);
  }
  if (normCode) {
    return all('SELECT * FROM assumptions WHERE dossier_id = ? AND norm_code = ?', [dossierId, normCode]);
  }
  return all('SELECT * FROM assumptions WHERE dossier_id = ?', [dossierId]);
}

function assumptionMap(rows: any[]): Map<string, any> {
  const m = new Map<string, any>();
  for (const r of rows) m.set(r.key, r);
  return m;
}

function resolveRequired(
  map: Map<string, any>,
  required: { key: string; label: string }[],
): {
  provided: Finding['provided'];
  missing: Finding['missing'];
} {
  const provided: Finding['provided'] = [];
  const missing: Finding['missing'] = [];
  for (const req of required) {
    const a = map.get(req.key);
    const hasValue = a && String(a.value ?? '').trim() !== '';
    if (!hasValue) {
      missing.push(req);
    } else {
      provided.push({
        key: req.key,
        label: req.label,
        value: String(a.value),
        validated: Number(a.validated) === 1,
      });
      if (Number(a.validated) !== 1) missing.push({ key: req.key, label: `${req.label} (à valider)` });
    }
  }
  return { provided, missing };
}

export const IAS16_REQUIRED = [
  { key: 'in_service_date', label: 'Date de mise en service' },
  { key: 'useful_life_years', label: "Durée d'utilité estimée en IFRS (années) — justification requise" },
  { key: 'useful_life_justification', label: "Justification de la durée d'utilité retenue" },
  { key: 'residual_value', label: 'Valeur résiduelle estimée (MAD)' },
  { key: 'method', label: "Méthode d'amortissement retenue" },
  { key: 'accum_account', label: 'Compte CGNC des amortissements cumulés rattaché' },
];

export const IFRS16_REQUIRED = [
  { key: 'start_date', label: 'Date de début du contrat' },
  { key: 'term_months', label: 'Durée de location (mois)' },
  { key: 'payment_amount', label: 'Montant du loyer par période (MAD)' },
  { key: 'payments_per_year', label: 'Nombre de paiements par an' },
  { key: 'payment_timing', label: 'Paiement en début ou en fin de période' },
  { key: 'discount_rate', label: "Taux d'actualisation retenu (taux implicite ou taux d'emprunt marginal)" },
  { key: 'rent_account', label: 'Compte CGNC de charge locative concerné' },
  { key: 'exemption', label: 'Exemption applicable (aucune / court terme / faible valeur)' },
];

export const IAS12_REQUIRED = [
  { key: 'tax_rate', label: "Taux d'impôt sur les sociétés à appliquer" },
  { key: 'tax_rate_source', label: 'Source du taux (texte fiscal, note fiscale, décision)' },
];

export const IAS37_REQUIRED = [
  { key: 'obligation_nature', label: "Nature de l'obligation (juridique, contractuelle ou implicite)" },
  { key: 'past_event', label: "Événement passé à l'origine de l'obligation" },
  { key: 'probability', label: 'Probabilité de sortie de ressources' },
  { key: 'best_estimate', label: 'Meilleure estimation du montant et de son échéance' },
];

export function runAnalysis(dossierId: string): { findings: Finding[]; mappings: ProposedMapping[]; totals: AccountTotal[] } {
  const totals = accountTotals(dossierId);
  const mappings = proposeMappings(dossierId);
  const findings: Finding[] = [];

  for (const rule of WATCH_RULES) {
    const matching = totals.filter((t) => rule.prefixes.some((p) => t.code.startsWith(p)));
    if (matching.length === 0) continue;

    const accounts = matching.map((m) => ({
      code: m.code,
      label: m.label,
      amount: round2(Math.abs(m.balance)),
      balance: m.balance,
    }));
    const totalAmount = round2(accounts.reduce((s, a) => s + a.amount, 0));

    let requiredInfo = rule.requiresInfo.map((label, i) => ({ key: slug(label, i), label }));
    let provided: Finding['provided'] = [];
    let missing: Finding['missing'] = requiredInfo;
    let status: Finding['status'] = 'a_examiner';

    if (rule.analyzer === 'ias16') {
      const assets = matching.filter((m) => m.balance > 0 && m.code.startsWith('23'));
      const perAsset: Finding['missing'] = [];
      const prov: Finding['provided'] = [];
      for (const asset of assets) {
        const rows = getAssumptions(dossierId, 'IAS 16', `ias16:${asset.code}`);
        const map = assumptionMap(rows);
        const res = resolveRequired(map, IAS16_REQUIRED);
        prov.push(...res.provided.map((p) => ({ ...p, label: `${asset.code} — ${p.label}` })));
        perAsset.push(...res.missing.map((p) => ({ ...p, label: `${asset.code} — ${p.label}` })));
      }
      provided = prov;
      missing = perAsset;
      requiredInfo = assets.length
        ? assets.flatMap((a) =>
            IAS16_REQUIRED.map((r) => ({ key: `${a.code}:${r.key}`, label: `${a.code} — ${r.label}` })),
          )
        : [];
      status = assets.length === 0 ? 'conforme' : missing.length === 0 ? 'pret' : 'informations_requises';
    } else if (rule.analyzer === 'ifrs16') {
      const rentAccounts = matching;
      const contracts = all(
        "SELECT DISTINCT scope FROM assumptions WHERE dossier_id = ? AND norm_code = 'IFRS 16'",
        [dossierId],
      );
      if (contracts.length === 0) {
        missing = IFRS16_REQUIRED;
        requiredInfo = IFRS16_REQUIRED;
        status = 'informations_requises';
      } else {
        const prov: Finding['provided'] = [];
        const miss: Finding['missing'] = [];
        for (const c of contracts) {
          const map = assumptionMap(getAssumptions(dossierId, 'IFRS 16', c.scope as string));
          const res = resolveRequired(map, IFRS16_REQUIRED);
          prov.push(...res.provided.map((p) => ({ ...p, label: `${c.scope} — ${p.label}` })));
          miss.push(...res.missing.map((p) => ({ ...p, label: `${c.scope} — ${p.label}` })));
        }
        provided = prov;
        missing = miss;
        requiredInfo = IFRS16_REQUIRED;
        status = miss.length === 0 ? 'pret' : 'informations_requises';
      }
      void rentAccounts;
    } else if (rule.analyzer === 'ias12') {
      const map = assumptionMap(getAssumptions(dossierId, 'IAS 12', 'ias12'));
      const res = resolveRequired(map, IAS12_REQUIRED);
      provided = res.provided;
      missing = res.missing;
      requiredInfo = IAS12_REQUIRED;
      status = missing.length === 0 ? 'pret' : 'informations_requises';
    } else if (rule.analyzer === 'ias38') {
      const map = assumptionMap(getAssumptions(dossierId, 'IAS 38', `ias38:${matching[0].code}`));
      const res = resolveRequired(map, [
        { key: 'accum_account', label: 'Compte des amortissements cumulés rattaché' },
        { key: 'nature', label: 'Nature des dépenses (non-valeurs, recherche, développement)' },
      ]);
      provided = res.provided;
      missing = res.missing;
      requiredInfo = [
        { key: 'accum_account', label: 'Compte des amortissements cumulés rattaché' },
        { key: 'nature', label: 'Nature des dépenses (non-valeurs, recherche, développement)' },
      ];
      status = missing.length === 0 ? 'pret' : 'informations_requises';
    } else {
      // Analyse non chiffrable : informations à obtenir, aucun montant inventé.
      status = rule.severity === 'information' ? 'a_examiner' : 'informations_requises';
    }

    if (rule.analyzer === 'ias12') {
      const others = all(
        "SELECT ref FROM adjustments WHERE dossier_id = ? AND norm_code <> 'IAS 12' AND status <> 'rejete'",
        [dossierId],
      );
      if (others.length === 0) {
        status = 'conforme';
        missing = [];
      }
    }

    findings.push({
      key: rule.id,
      normCode: rule.normCode,
      type: rule.type,
      severity: rule.severity,
      title: rule.title,
      message: rule.message,
      analyzer: rule.analyzer,
      accounts,
      totalAmount,
      requiredInfo,
      provided,
      missing,
      status,
      recommendation: recommendationFor(rule, accounts, status),
    });
  }

  return { findings, mappings, totals };
}

function recommendationFor(rule: WatchRule, accounts: { code: string; label: string }[], status: string) {
  const list = accounts.map((a) => a.code).join(', ');
  if (status === 'informations_requises') {
    return `Compléter les informations requises (onglet « Informations complémentaires ») avant de pouvoir chiffrer le retraitement. Comptes concernés : ${list}.`;
  }
  if (status === 'pret') {
    return `Toutes les informations nécessaires sont disponibles : le moteur de calcul peut chiffrer le retraitement ${rule.normCode}. Comptes concernés : ${list}.`;
  }
  if (status === 'conforme') {
    return `Aucun retraitement chiffré requis au vu des données disponibles. Comptes analysés : ${list}.`;
  }
  return `${rule.message} Comptes analysés : ${list}.`;
}

function slug(label: string, i: number) {
  return (
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || `info_${i}`
  );
}

/* -------------------------------------------------- Proposition de retraitements */

export type ProposedAdjustment = {
  ref: string;
  title: string;
  poste_cgnc: string;
  account_code: string;
  norm_code: string;
  type: string;
  category: 'ajustement' | 'reclassement';
  amount: number;
  direction: string;
  details: Record<string, any>;
  computations: CalcStep[];
  refs: NormRef[];
  missing: { key: string; label: string }[];
  rationale: string;
  status: 'a_valider' | 'informations_requises';
  entries: EngineEntry[];
  impacts: ComputeResult['impacts'];
  rubricEffects: RubricEffect[];
  plEffects: PlEffect[];
  deferredItems: DeferredItem[];
  notes: string[];
  origin: string;
};

export function proposeAdjustments(dossierId: string): ProposedAdjustment[] {
  const totals = accountTotals(dossierId);
  const props: ProposedAdjustment[] = [];
  let counter = 0;
  const nextRef = () => `R${String(++counter).padStart(3, '0')}`;

  const findAccount = (code: string) => totals.find((t) => t.code === code);
  const accumAmount = (code: string) => {
    const a = findAccount(code);
    if (!a) return 0;
    return round2(Math.max(0, a.credit - a.debit));
  };

  /* ------------------------------ IAS 16 */
  // Les actifs non amortissables identifiés par la table de correspondance
  // (nature « aucun », ex. terrains) sont exclus : aucune durée d'utilité n'est
  // requise. Tout autre actif corporel dont les informations font défaut porte le
  // statut « Informations complémentaires requises » (aucun montant inventé).
  const fixedAssets = totals.filter(
    (t) => t.code.startsWith('23') && t.balance > 0 && findRule(t.code)?.nature !== 'aucun',
  );
  for (const asset of fixedAssets) {
    const rows = getAssumptions(dossierId, 'IAS 16', `ias16:${asset.code}`);
    const map = assumptionMap(rows);
    const res = resolveRequired(map, IAS16_REQUIRED);
    const cost = asset.balance;
    const accumAccount = String(map.get('accum_account')?.value || '');
    const cgncAccumulated = accumAccount ? accumAmount(accumAccount) : 0;

    if (res.missing.length > 0) {
      props.push({
        ref: nextRef(),
        title: `IAS 16 — ${asset.label} (${asset.code})`,
        poste_cgnc: `${asset.code} — ${asset.label}`,
        account_code: asset.code,
        norm_code: 'IAS 16',
        type: 'evaluation',
        category: 'ajustement',
        amount: 0,
        direction: 'neutre',
        details: { cost, cgnc_accumulated: cgncAccumulated, required: IAS16_REQUIRED },
        computations: [],
        refs: normRefs('IAS 16', 2),
        missing: res.missing,
        rationale:
          "Les informations nécessaires au calcul de l'amortissement IFRS sont incomplètes. Aucun montant n'est calculé : un retraitement ne peut être inventé.",
        status: 'informations_requises',
        entries: [],
        impacts: { actif: 0, passif: 0, capitaux_propres: 0, resultat: 0 },
        rubricEffects: [],
        plEffects: [],
        deferredItems: [],
        notes: [],
        origin: 'moteur',
      });
      continue;
    }

    const result = computeIas16({
      assetLabel: `${asset.label} (${asset.code})`,
      accountCode: accumAccount || asset.code,
      cost,
      inServiceDate: String(map.get('in_service_date')!.value),
      closingDate: getDossier(dossierId).closing_date,
      usefulLifeYears: Number(map.get('useful_life_years')!.value),
      residualValue: Number(map.get('residual_value')!.value || 0),
      method: String(map.get('method')!.value || 'lineaire') === 'degressif' ? 'degressif' : 'lineaire',
      cgncUsefulLifeYears: map.get('cgnc_useful_life_years')
        ? Number(map.get('cgnc_useful_life_years')!.value)
        : undefined,
      cgncAccumulated,
    });

    const deferredItems: DeferredItem[] =
      Math.abs(result.amount) > 0.01
        ? [
            {
              label: asset.label,
              origin: `IAS 16 — ${asset.code}`,
              taxableTemporaryDifference: result.amount < 0 ? Math.abs(result.amount) : 0,
              deductibleTemporaryDifference: result.amount > 0 ? result.amount : 0,
            },
          ]
        : [];

    props.push({
      ref: nextRef(),
      title: `IAS 16 — Ajustement d'amortissement : ${asset.label}`,
      poste_cgnc: `${asset.code} — ${asset.label}`,
      account_code: accumAccount || asset.code,
      norm_code: 'IAS 16',
      type: 'evaluation',
      category: 'ajustement',
      amount: result.amount,
      direction: result.direction,
      details: {
        cost,
        cgnc_accumulated: cgncAccumulated,
        cgnc_useful_life_years: map.get('cgnc_useful_life_years')?.value ?? null,
        in_service_date: String(map.get('in_service_date')!.value),
        useful_life_years: Number(map.get('useful_life_years')!.value),
        residual_value: Number(map.get('residual_value')!.value || 0),
        method: String(map.get('method')!.value || 'lineaire'),
        accum_account: accumAccount,
      },
      computations: result.steps,
      refs: normRefs('IAS 16', 3),
      missing: [],
      rationale: `La durée d'amortissement retenue en CGNC (${map.get('cgnc_useful_life_years')?.value ?? 'non précisée'} ans) et la durée d'utilité économique IFRS (${map.get('useful_life_years')!.value} ans) conduisent à un amortissement cumulé IFRS de ${result.steps.find((s) => s.label.startsWith('Amortissement cumulé'))?.result ?? 0} MAD contre ${cgncAccumulated} MAD en CGNC. L'écart constitue le retraitement IAS 16.`,
      status: 'a_valider',
      entries: result.entries,
      impacts: result.impacts,
      rubricEffects: result.rubricEffects,
      plEffects: result.plEffects,
      deferredItems,
      notes: result.notes,
      origin: 'moteur',
    });
  }

  /* ------------------------------ IFRS 16 */
  const contracts = all(
    "SELECT DISTINCT scope FROM assumptions WHERE dossier_id = ? AND norm_code = 'IFRS 16'",
    [dossierId],
  );
  for (const c of contracts) {
    const scope = String(c.scope);
    const map = assumptionMap(getAssumptions(dossierId, 'IFRS 16', scope));
    const res = resolveRequired(map, IFRS16_REQUIRED);
    const rentAccount = String(map.get('rent_account')?.value || '');
    const rentAccountRow = rentAccount ? findAccount(rentAccount) : undefined;
    const cgncRentExpense = rentAccountRow ? round2(Math.abs(rentAccountRow.balance)) : 0;
    const label = String(map.get('contract_label')?.value || scope);

    if (res.missing.length > 0) {
      props.push({
        ref: nextRef(),
        title: `IFRS 16 — ${label}`,
        poste_cgnc: rentAccount ? `${rentAccount} — ${rentAccountRow?.label ?? 'Charges locatives'}` : 'Charges locatives',
        account_code: rentAccount,
        norm_code: 'IFRS 16',
        type: 'comptabilisation',
        category: 'ajustement',
        amount: 0,
        direction: 'neutre',
        details: { contract: scope, required: IFRS16_REQUIRED },
        computations: [],
        refs: normRefs('IFRS 16', 2),
        missing: res.missing,
        rationale:
          "Le contrat de location est identifié mais les caractéristiques nécessaires (durée, loyers, taux d'actualisation, exemptions) ne sont pas complètes : aucun actif ni passif locatif ne peut être calculé.",
        status: 'informations_requises',
        entries: [],
        impacts: { actif: 0, passif: 0, capitaux_propres: 0, resultat: 0 },
        rubricEffects: [],
        plEffects: [],
        deferredItems: [],
        notes: [],
        origin: 'moteur',
      });
      continue;
    }

    const result = computeIfrs16({
      contractLabel: label,
      startDate: String(map.get('start_date')!.value),
      closingDate: getDossier(dossierId).closing_date,
      termMonths: Number(map.get('term_months')!.value),
      paymentAmount: Number(map.get('payment_amount')!.value),
      paymentsPerYear: Number(map.get('payments_per_year')!.value || 1),
      paymentTiming: String(map.get('payment_timing')!.value || 'fin') === 'debut' ? 'debut' : 'fin',
      annualDiscountRate: Number(map.get('discount_rate')!.value),
      exemption: (String(map.get('exemption')!.value || 'aucune') as any) || 'aucune',
      initialDirectCosts: Number(map.get('initial_direct_costs')?.value || 0),
      prepaidPayments: Number(map.get('prepaid_payments')?.value || 0),
      incentives: Number(map.get('incentives')?.value || 0),
      cgncRentExpense,
      cgncRentAccount: rentAccount || '6122',
    });

    const deferredItems: DeferredItem[] =
      Math.abs(result.impacts.actif) > 0.01 || Math.abs(result.impacts.passif) > 0.01
        ? [
            {
              label: `${label} — actif au titre du droit d'utilisation`,
              origin: `IFRS 16 — ${scope} (actif)`,
              taxableTemporaryDifference: round2(Math.max(0, result.impacts.actif)),
              deductibleTemporaryDifference: 0,
            },
            {
              label: `${label} — passif locatif`,
              origin: `IFRS 16 — ${scope} (passif)`,
              taxableTemporaryDifference: 0,
              deductibleTemporaryDifference: round2(Math.max(0, result.impacts.passif)),
            },
          ]
        : [];

    props.push({
      ref: nextRef(),
      title: `IFRS 16 — Droit d'utilisation et passif locatif : ${label}`,
      poste_cgnc: rentAccount ? `${rentAccount} — ${rentAccountRow?.label ?? 'Charges locatives'}` : 'Charges locatives',
      account_code: rentAccount,
      norm_code: 'IFRS 16',
      type: 'comptabilisation',
      category: 'ajustement',
      amount: result.amount,
      direction: result.direction,
      details: {
        contract: scope,
        cgnc_rent_expense: cgncRentExpense,
        payment_amount: Number(map.get('payment_amount')!.value),
        term_months: Number(map.get('term_months')!.value),
        discount_rate: Number(map.get('discount_rate')!.value),
        start_date: String(map.get('start_date')!.value),
      },
      computations: result.steps,
      refs: normRefs('IFRS 16', 3),
      missing: [],
      rationale: result.notes.join(' '),
      status: 'a_valider',
      entries: result.entries,
      impacts: result.impacts,
      rubricEffects: result.rubricEffects,
      plEffects: result.plEffects,
      deferredItems,
      notes: result.notes,
      origin: 'moteur',
    });
  }

  /* ------------------------------ IAS 38 */
  const nonValues = totals.filter((t) => t.code.startsWith('21') && t.balance > 0);
  for (const nv of nonValues) {
    const rows = getAssumptions(dossierId, 'IAS 38', `ias38:${nv.code}`);
    const map = assumptionMap(rows);
    const accumAccount = String(map.get('accum_account')?.value || '');
    const nature = String(map.get('nature')?.value || 'non_valeurs');
    if (!accumAccount) {
      props.push({
        ref: nextRef(),
        title: `IAS 38 — ${nv.label} (${nv.code})`,
        poste_cgnc: `${nv.code} — ${nv.label}`,
        account_code: nv.code,
        norm_code: 'IAS 38',
        type: 'comptabilisation',
        category: 'ajustement',
        amount: 0,
        direction: 'neutre',
        details: { gross: nv.balance },
        computations: [],
        refs: normRefs('IAS 38', 2),
        missing: [{ key: 'accum_account', label: 'Compte des amortissements cumulés rattaché' }],
        rationale:
          "Le compte des amortissements cumulés rattaché n'est pas renseigné : la valeur nette comptable à radier ne peut être déterminée de façon fiable.",
        status: 'informations_requises',
        entries: [],
        impacts: { actif: 0, passif: 0, capitaux_propres: 0, resultat: 0 },
        rubricEffects: [],
        plEffects: [],
        deferredItems: [],
        notes: [],
        origin: 'moteur',
      });
      continue;
    }
    const acc = accumAccount ? accumAmount(accumAccount) : 0;
    const nvRule = findRule(nv.code);
    const result = computeIas38WriteOff({
      label: `${nv.label} (${nv.code})`,
      grossAccount: nv.code,
      accumulatedAccount: accumAccount,
      grossCarryingAmount: nv.balance,
      accumulatedAmortization: acc,
      closingDate: getDossier(dossierId).closing_date,
      reason: nature as any,
      rubric: nvRule?.ifrsLine,
    });
    props.push({
      ref: nextRef(),
      title: `IAS 38 — Radiation de dépenses non comptabilisables : ${nv.label}`,
      poste_cgnc: `${nv.code} — ${nv.label}`,
      account_code: nv.code,
      norm_code: 'IAS 38',
      type: 'comptabilisation',
      category: 'ajustement',
      amount: result.amount,
      direction: result.direction,
      details: { gross: nv.balance, accumulated: acc, accum_account: accumAccount, nature },
      computations: result.steps,
      refs: normRefs('IAS 38', 3),
      missing: [],
      rationale: result.notes.join(' '),
      status: 'a_valider',
      entries: result.entries,
      impacts: result.impacts,
      rubricEffects: result.rubricEffects,
      plEffects: result.plEffects,
      deferredItems: [],
      notes: result.notes,
      origin: 'moteur',
    });
  }

  /* ------------------------------ IAS 37 (provisions pour risques et charges) */
  // Une provision CGNC n'est pas reprise telle quelle : IAS 37 exige une
  // obligation actuelle, une sortie de ressources probable et une estimation
  // fiable. En l'absence de ces éléments, le poste reste en « Informations
  // complémentaires requises » (aucun montant n'est calculé ni inventé).
  const provisions = totals.filter((t) => t.code.startsWith('15') && t.credit - t.debit > 0);
  for (const prov of provisions) {
    const rows = getAssumptions(dossierId, 'IAS 37', `ias37:${prov.code}`);
    const map = assumptionMap(rows);
    const res = resolveRequired(map, IAS37_REQUIRED);
    props.push({
      ref: nextRef(),
      title: `IAS 37 — Reprise du critère de comptabilisation : ${prov.label}`,
      poste_cgnc: `${prov.code} — ${prov.label}`,
      account_code: prov.code,
      norm_code: 'IAS 37',
      type: 'comptabilisation',
      category: 'ajustement',
      amount: 0,
      direction: 'neutre',
      details: { amount: round2(prov.credit - prov.debit), required: IAS37_REQUIRED },
      computations: [],
      refs: normRefs('IAS 37', 2),
      missing: res.missing,
      rationale:
        "IAS 37 exige une obligation actuelle résultant d'un événement passé, une sortie de ressources probable et une estimation fiable. Ces éléments ne sont pas documentés : la provision ne peut être ni maintenue telle quelle ni requalifiée en passif éventuel sans information complémentaire. Aucun montant n'est calculé.",
      status: 'informations_requises',
      entries: [],
      impacts: { actif: 0, passif: 0, capitaux_propres: 0, resultat: 0 },
      rubricEffects: [],
      plEffects: [],
      deferredItems: [],
      notes: [],
      origin: 'moteur',
    });
  }

  /* ------------------------------ IAS 12 (après les autres retraitements) */
  const deferred = props.flatMap((p) => p.deferredItems);
  if (deferred.length > 0) {
    const map = assumptionMap(getAssumptions(dossierId, 'IAS 12', 'ias12'));
    const res = resolveRequired(map, IAS12_REQUIRED);
    if (res.missing.length > 0) {
      props.push({
        ref: nextRef(),
        title: 'IAS 12 — Impôts différés sur retraitements',
        poste_cgnc: 'Impôts différés (calcul)',
        account_code: '',
        norm_code: 'IAS 12',
        type: 'comptabilisation',
        category: 'ajustement',
        amount: 0,
        direction: 'neutre',
        details: { items: deferred },
        computations: [],
        refs: normRefs('IAS 12', 2),
        missing: res.missing,
        rationale:
          "Des différences temporelles sont identifiées mais le taux d'impôt applicable et sa source ne sont pas renseignés. Aucun impôt différé n'est calculé.",
        status: 'informations_requises',
        entries: [],
        impacts: { actif: 0, passif: 0, capitaux_propres: 0, resultat: 0 },
        rubricEffects: [],
        plEffects: [],
        deferredItems: [],
        notes: [],
        origin: 'moteur',
      });
    } else {
      const result = computeIas12({
        items: deferred,
        taxRate: Number(map.get('tax_rate')!.value),
        rateSource: String(map.get('tax_rate_source')!.value),
        closingDate: getDossier(dossierId).closing_date,
      });
      props.push({
        ref: nextRef(),
        title: 'IAS 12 — Impôts différés sur retraitements IFRS',
        poste_cgnc: 'Différences temporelles issues des retraitements',
        account_code: '',
        norm_code: 'IAS 12',
        type: 'comptabilisation',
        category: 'ajustement',
        amount: result.amount,
        direction: result.direction,
        details: { items: deferred, tax_rate: Number(map.get('tax_rate')!.value) },
        computations: result.steps,
        refs: normRefs('IAS 12', 3),
        missing: [],
        rationale: `Les différences temporelles générées par les retraitements s'élèvent à ${round2(deferred.reduce((s, d) => s + d.deductibleTemporaryDifference - d.taxableTemporaryDifference, 0))} MAD (base nette). Au taux de ${(Number(map.get('tax_rate')!.value) * 100).toFixed(2)} %, l'impôt différé net s'élève à ${result.amount} MAD (${result.amount >= 0 ? 'actif' : 'passif'} net).`,
        status: 'a_valider',
        entries: result.entries,
        impacts: result.impacts,
        rubricEffects: result.rubricEffects,
        plEffects: result.plEffects,
        deferredItems: [],
        notes: result.notes,
        origin: 'moteur',
      });
    }
  }

  /* ------------------------------ Reclassements (IAS 1) — sans impact CP */
  for (const t of totals) {
    if (!t.code.startsWith('25') || t.balance <= 0) continue;
    const rows = getAssumptions(dossierId, 'IAS 1', `ias1:${t.code}`);
    const map = assumptionMap(rows);
    const currentPortion = Number(map.get('current_portion')?.value ?? NaN);
    if (!Number.isFinite(currentPortion) || currentPortion <= 0) {
      props.push({
        ref: nextRef(),
        title: `IAS 1 — Ventilation courant / non courant : ${t.label}`,
        poste_cgnc: `${t.code} — ${t.label}`,
        account_code: t.code,
        norm_code: 'IAS 1',
        type: 'reclassement',
        category: 'reclassement',
        amount: 0,
        direction: 'neutre',
        details: { amount: t.balance },
        computations: [],
        refs: normRefs('IAS 1', 1),
        missing: [
          {
            key: 'current_portion',
            label: "Montant remboursable à moins de douze mois (MAD)",
          },
        ],
        rationale:
          "Le caractère non courant du poste ne peut être repris tel quel : IAS 1 exige une ventilation fondée sur l'échéance effective. L'échéancier n'est pas fourni.",
        status: 'informations_requises',
        entries: [],
        impacts: { actif: 0, passif: 0, capitaux_propres: 0, resultat: 0 },
        rubricEffects: [],
        plEffects: [],
        deferredItems: [],
        notes: [],
        origin: 'moteur',
      });
      continue;
    }
    const result = computeReclassification({
      label: `${t.label} (${t.code})`,
      accountCode: t.code,
      amount: currentPortion,
      closingDate: getDossier(dossierId).closing_date,
      fromRubric: 'Actifs non courants — immobilisations financières',
      toRubric: 'Actifs courants — autres créances',
      fromGroup: 'ACTIF_NON_COURANT',
      toGroup: 'ACTIF_COURANT',
      justification:
        "Reclassement de présentation consécutif à l'analyse de l'échéance : la fraction exigible à moins de douze mois ne peut rester en actifs non courants (IAS 1). Aucun impact sur les capitaux propres.",
    });
    props.push({
      ref: nextRef(),
      title: `IAS 1 — Reclassement courant / non courant : ${t.label}`,
      poste_cgnc: `${t.code} — ${t.label}`,
      account_code: t.code,
      norm_code: 'IAS 1',
      type: 'reclassement',
      category: 'reclassement',
      amount: 0,
      direction: 'neutre',
      details: { amount: t.balance, current_portion: currentPortion },
      computations: result.steps,
      refs: normRefs('IAS 1', 2),
      missing: [],
      rationale: `Sur ${t.balance} MAD inscrits en immobilisations financières, ${currentPortion} MAD sont remboursables à moins de douze mois : cette fraction est reclassée en actifs courants sans impact sur les capitaux propres.`,
      status: 'a_valider',
      entries: result.entries,
      impacts: result.impacts,
      rubricEffects: result.rubricEffects,
      plEffects: result.plEffects,
      deferredItems: [],
      notes: result.notes,
      origin: 'moteur',
    });
  }

  return props;
}

export function dossierById(dossierId: string) {
  return get('SELECT * FROM dossiers WHERE id = ?', [dossierId]);
}

function getDossier(dossierId: string) {
  const d = get('SELECT * FROM dossiers WHERE id = ?', [dossierId]);
  if (!d) throw new Error('Dossier introuvable');
  return d;
}

/* ---------------------------------------------------- Persistance des analyses */

export function saveMappings(dossierId: string, proposed: ProposedMapping[], actor: string) {
  run('DELETE FROM mappings WHERE dossier_id = ? AND origin = ?', [dossierId, 'auto']);
  for (const m of proposed) {
    insert('mappings', {
      id: id('map'),
      dossier_id: dossierId,
      account_code: m.account_code,
      account_label: m.account_label,
      cgnc_class: m.cgnc_class,
      cgnc_group: m.cgnc_group,
      amount: m.amount,
      side: m.side,
      ifrs_line: m.ifrs_line,
      ifrs_group: m.ifrs_group,
      nature: m.nature,
      justification: m.justification,
      norm_code: m.norm_code,
      confidence: m.confidence,
      status: m.status,
      origin: 'auto',
      created_at: now(),
      updated_at: now(),
    });
  }
  void actor;
}

/**
 * Persiste les retraitements proposés. Les retraitements déjà validés ou
 * modifiés manuellement ne sont jamais écrasés.
 */
export function saveAdjustments(dossierId: string, proposed: ProposedAdjustment[]) {
  const existing = all('SELECT ref, status FROM adjustments WHERE dossier_id = ?', [dossierId]);
  const locked = new Set(
    existing.filter((e) => e.status === 'approuve' || e.status === 'modifie').map((e) => e.ref as string),
  );
  const replaced = new Set(existing.map((e) => e.ref as string));

  run(
    "DELETE FROM entries WHERE dossier_id = ? AND adjustment_id IN (SELECT id FROM adjustments WHERE dossier_id = ? AND status NOT IN ('approuve','modifie'))",
    [dossierId, dossierId],
  );
  run("DELETE FROM adjustments WHERE dossier_id = ? AND status NOT IN ('approuve','modifie')", [dossierId]);

  let created = 0;
  let skipped = 0;
  for (const p of proposed) {
    if (locked.has(p.ref) && replaced.has(p.ref)) {
      skipped++;
      continue;
    }
    const adjId = id('adj');
    insert('adjustments', {
      id: adjId,
      dossier_id: dossierId,
      ref: p.ref,
      title: p.title,
      poste_cgnc: p.poste_cgnc,
      account_code: p.account_code,
      norm_code: p.norm_code,
      type: p.type,
      category: p.category,
      amount: p.amount,
      status: p.status,
      direction: p.direction,
      details_json: JSON.stringify({
        ...p.details,
        impacts: p.impacts,
        notes: p.notes,
        rubric_effects: p.rubricEffects,
        pl_effects: p.plEffects,
      }),
      computations_json: JSON.stringify(p.computations),
      refs_json: JSON.stringify(p.refs),
      missing_json: JSON.stringify(p.missing),
      rationale: p.rationale,
      ai_rationale: '',
      origin: p.origin,
      created_at: now(),
      updated_at: now(),
    });
    created++;
    for (const e of p.entries) {
      insert('entries', {
        id: id('ent'),
        dossier_id: dossierId,
        adjustment_id: adjId,
        entry_group: 1,
        date: e.date,
        ref: p.ref,
        account_code: e.accountCode,
        account_label: e.accountLabel,
        label: e.label,
        debit: round2(e.debit),
        credit: round2(e.credit),
        norm_code: p.norm_code,
        doc_ref: '',
        status: p.status === 'informations_requises' ? 'bloque' : 'a_valider',
        created_at: now(),
      });
    }
  }
  return { created, skipped };
}

export { get as dbGet, all as dbAll };
