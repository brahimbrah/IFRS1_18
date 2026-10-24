export type User = { id: string; email: string; name: string; role: string };

export type Dossier = {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  company_name: string;
  exercice: string;
  closing_date: string;
  currency: string;
  conversion_type: string;
  framework: string;
  is_demo: number;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
  // enrichissements éventuels
  documents?: number;
  lines?: number;
  adjustments?: number;
  approved?: number;
  pending?: number;
  needsInfo?: number;
};

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

export type CalcStep = {
  label: string;
  formula: string;
  inputs: Record<string, any>;
  result: number | string;
  unit: string;
};

export type Entry = {
  id: string;
  dossier_id: string;
  adjustment_id: string | null;
  ref: string;
  date: string;
  account_code: string;
  account_label: string;
  label: string;
  debit: number;
  credit: number;
  norm_code: string;
  doc_ref: string;
  status: string;
  adjustment_status?: string;
  adjustment_title?: string;
};

export type Adjustment = {
  id: string;
  dossier_id: string;
  ref: string;
  title: string;
  poste_cgnc: string;
  account_code: string;
  norm_code: string;
  type: string;
  category: 'ajustement' | 'reclassement';
  amount: number;
  direction: string;
  status: string;
  details_json?: string;
  details: any;
  computations: CalcStep[];
  refs: NormRef[];
  missing: { key: string; label: string }[];
  ai: any;
  rationale: string;
  ai_rationale?: string;
  entries: Entry[];
  entryBalance: { debit: number; credit: number; balanced: boolean };
  created_at: string;
  updated_at: string;
};

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

export type Mapping = {
  id: string;
  dossier_id: string;
  account_code: string;
  account_label: string;
  cgnc_class: number | null;
  cgnc_group: string;
  amount: number;
  side: string;
  ifrs_line: string;
  ifrs_group: string;
  nature: string;
  justification: string;
  norm_code: string;
  confidence: number;
  status: string;
  origin: string;
};

export type DocumentRow = {
  id: string;
  dossier_id: string;
  kind: string;
  filename: string;
  mime: string;
  size: number;
  stored_name: string;
  status: string;
  message: string;
  rows: number;
  parsed_json?: string;
  columns_json?: string;
  parsed?: any;
  columns?: string[];
  uploaded_at: string;
};

export type Control = {
  id: string;
  label: string;
  status: 'conforme' | 'a_verifier' | 'bloquant';
  detail: string;
  value?: string;
};

export type PassageRow = {
  rubric: string;
  group: string;
  soldeCGNC: number;
  reclassements: number;
  ajustements: number;
  soldeIFRS: number;
  contributions: { ref: string; title: string; norm: string; status: string; category: string; amount: number }[];
};

export type PassageSection = {
  group: string;
  label: string;
  rows: PassageRow[];
  totalCGNC: number;
  totalReclassements: number;
  totalAjustements: number;
  totalIFRS: number;
};

export type Passage = {
  onlyApproved: boolean;
  sections: PassageSection[];
  rows: PassageRow[];
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
  equity: { rubric: string; cgnc: number; ajustement: number; ifrs: number }[];
  totalEquityImpact: number;
  adjustments: {
    ref: string;
    title: string;
    norm: string;
    status: string;
    amount: number;
    category: string;
    included: boolean;
    reason: string;
  }[];
  generatedAt: string;
};

export type Coverage = {
  status: 'complet' | 'partiel' | 'indisponible';
  covered: string[];
  notCovered: string[];
  reason?: string;
};

export type FinancialStatements = {
  dossier: Dossier;
  generatedAt: string;
  onlyApproved: boolean;
  sofp: {
    coverage: Coverage;
    assetsNonCurrent: { rubric: string; cgnc: number; ajustement: number; ifrs: number }[];
    assetsCurrent: { rubric: string; cgnc: number; ajustement: number; ifrs: number }[];
    equity: { rubric: string; cgnc: number; ajustement: number; ifrs: number }[];
    liabilitiesNonCurrent: { rubric: string; cgnc: number; ajustement: number; ifrs: number }[];
    liabilitiesCurrent: { rubric: string; cgnc: number; ajustement: number; ifrs: number }[];
    totals: Passage['balance'];
  };
  ploci: {
    coverage: Coverage;
    produits: { rubric: string; cgnc: number; ajustement: number; ifrs: number }[];
    charges: { rubric: string; cgnc: number; ajustement: number; ifrs: number }[];
    impot: { rubric: string; cgnc: number; ajustement: number; ifrs: number }[];
    totalProduits: number;
    totalCharges: number;
    totalImpot: number;
    resultatNet: number;
    resultatNetCGNC: number;
    oci: { rubric: string; amount: number }[];
    ociNote: string;
  };
  cashflow: {
    coverage: Coverage;
    lines: { rubric: string; amount: number | null; note?: string }[];
  };
  socie: {
    coverage: Coverage;
    openingEquity: number | null;
    movements: { label: string; amount: number | null; note?: string }[];
    closingEquity: number;
    detail: { rubric: string; cgnc: number; ajustement: number; ifrs: number }[];
  };
  notes: { title: string; body: string }[];
};

export type Assumption = {
  id: string;
  dossier_id: string;
  norm_code: string;
  scope: string;
  key: string;
  label: string;
  value: string;
  unit: string;
  kind: string;
  source: string;
  validated: number;
  required: number;
  note: string;
  created_at: string;
};

export type Norm = {
  id: string;
  code: string;
  title: string;
  kind: string;
  category: string;
  status: string;
  publication_date: string;
  applicable_from: string;
  applicable_note: string;
  summary: string;
  source: string;
  source_url: string;
  paragraphCount?: number;
  verifiedCount?: number;
};

export type NormParagraph = {
  id: string;
  norm_id: string;
  number: string;
  title: string;
  text: string;
  source: string;
  keywords: string;
  verified: number;
  note: string;
};

export type Settings = {
  ai_enabled: boolean;
  ai_provider: string;
  ai_model: string;
  ai_base_url: string;
  ai_api_key_set: boolean;
  ai_api_key_hint: string;
  ai_temperature: number;
  allow_external_ai: boolean;
  default_currency: string;
  default_exercise: string;
};

export type ChatMessage = {
  id: string;
  dossier_id: string;
  role: 'user' | 'assistant';
  content: string;
  refs_json: string;
  provider: string;
  created_at: string;
};
