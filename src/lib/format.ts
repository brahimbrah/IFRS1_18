const nf = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function money(n: number | null | undefined, currency = 'MAD'): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `${nf.format(Number(n))} ${currency}`;
}

export function amount(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return nf.format(Number(n));
}

export function int(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return nf0.format(Number(n));
}

export function pct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `${(Number(n) * 100).toFixed(digits).replace('.', ',')} %`;
}

export function dateFr(s?: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function dateTimeFr(s?: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DOC_KINDS: Record<string, string> = {
  balance: 'Balance générale',
  bilan: 'Bilan CGNC',
  cpc: 'Compte de produits et charges',
  journal: 'Journal comptable',
  saisie: 'Saisie manuelle',
  immobilisations: 'Dossier d’immobilisations',
  contrat: 'Contrat de location',
  annexe: 'Annexe',
  autre: 'Autre document',
};

export const NORM_COLORS: Record<string, string> = {
  'IAS 16': 'bg-teal-50 text-teal-700 border-teal-200',
  'IFRS 16': 'bg-navy-50 text-navy-700 border-navy-200',
  'IAS 12': 'bg-amber-50 text-amber-700 border-amber-200',
  'IAS 38': 'bg-violet-50 text-violet-700 border-violet-200',
  'IAS 37': 'bg-rose-50 text-rose-700 border-rose-200',
  'IAS 1': 'bg-slate-50 text-slate-700 border-slate-200',
};

export function normColor(code: string): string {
  return NORM_COLORS[code] || 'bg-navy-50 text-navy-700 border-navy-200';
}

export const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  donnees_importees: 'Données importées',
  analyse: 'Analyse',
  retraitements: 'Retraitements',
  valide: 'Validé',
  etats_generes: 'États générés',
  a_valider: 'À valider',
  approuve: 'Approuvé',
  modifie: 'Modifié',
  rejete: 'Rejeté',
  informations_requises: 'Informations complémentaires requises',
  justification_demandee: 'Justification demandée',
};

export function statusLabel(s: string): string {
  return STATUS_LABELS[s] || s;
}

export function statusChipClass(s: string): string {
  switch (s) {
    case 'approuve':
    case 'conforme':
    case 'valide':
    case 'pret':
    case 'etats_generes':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'a_valider':
    case 'a_examiner':
    case 'a_verifier':
    case 'a_affecter':
    case 'modifie':
    case 'analyse':
    case 'retraitements':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'informations_requises':
    case 'justification_demandee':
      return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'bloquant':
    case 'rejete':
      return 'bg-red-50 text-red-700 border border-red-200';
    default:
      return 'bg-navy-50 text-navy-600 border border-navy-200';
  }
}
