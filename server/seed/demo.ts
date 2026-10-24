/**
 * DOSSIER DE DÉMONSTRATION UNIVERSITAIRE
 * ---------------------------------------------------------------------------
 * Dossier fictif clairement identifié comme exemple pédagogique. Il est marqué
 * `is_demo = 1` et n'est jamais mélangé aux dossiers réels de l'utilisateur.
 * Les données sont cohérentes et équilibrées ; les hypothèses de calcul sont
 * explicitement identifiées comme hypothèses de l'exercice.
 */
import { all, get, id, insert, now, run } from '../db.ts';
import { proposeAdjustments, proposeMappings, saveAdjustments, saveMappings } from '../engine/analysis.ts';

type Line = [string, string, number, number];

const BALANCE: Line[] = [
  ['2110', 'Frais de constitution', 20000, 0],
  ['2210', 'Frais de recherche et développement', 60000, 0],
  ['2310', 'Terrains', 400000, 0],
  ['2320', 'Constructions', 600000, 0],
  ['2340', 'Matériel et outillage', 100000, 0],
  ['2350', 'Matériel de transport', 180000, 0],
  ['2510', 'Prêts au personnel', 40000, 0],
  ['2811', 'Amortissements des frais de constitution', 0, 4000],
  ['2820', 'Amortissements des frais de recherche et développement', 0, 24000],
  ['2832', 'Amortissements des constructions', 0, 180000],
  ['2834', 'Amortissements du matériel et outillage', 0, 10000],
  ['2835', 'Amortissements du matériel de transport', 0, 60000],
  ['3110', 'Marchandises', 250000, 0],
  ['3421', 'Clients', 320000, 0],
  ['3422', 'Clients douteux', 30000, 0],
  ['3942', 'Provisions pour dépréciation des clients douteux', 0, 15000],
  ['5111', 'Caisse', 5000, 0],
  ['5141', 'Banques (solde débiteur)', 150000, 0],
  ['1111', 'Capital social', 0, 800000],
  ['1140', 'Réserve légale', 0, 100000],
  ['1160', 'Report à nouveau', 0, 60000],
  ['1486', 'Emprunts auprès des établissements de crédit', 0, 300000],
  ['1511', 'Provisions pour risques', 0, 30000],
  ['4411', 'Fournisseurs', 0, 210000],
  ['4432', 'Rémunérations dues au personnel', 0, 40000],
  ['6111', 'Achats de marchandises', 620000, 0],
  ['6122', 'Locations', 60000, 0],
  ['6125', 'Autres charges externes', 120000, 0],
  ['6311', 'Impôts et taxes', 12000, 0],
  ['6411', 'Charges de personnel', 300000, 0],
  ['6511', "Autres charges d'exploitation", 40000, 0],
  ['6611', "Charges d'intérêts", 12000, 0],
  ['6811', "Dotations d'exploitation aux amortissements", 206000, 0],
  ['6701', 'Impôts sur les résultats', 20000, 0],
  ['7111', 'Ventes de marchandises au Maroc', 0, 1200000],
  ['7211', 'Ventes de produits finis', 0, 500000],
  ['7511', 'Produits financiers', 0, 12000],
];

const BILAN: Line[] = [
  ['2110', 'Frais de constitution (brut)', 20000, 0],
  ['2210', 'Frais de recherche et développement (brut)', 60000, 0],
  ['2310', 'Terrains', 400000, 0],
  ['2320', 'Constructions', 600000, 0],
  ['2340', 'Matériel et outillage', 100000, 0],
  ['2350', 'Matériel de transport', 180000, 0],
  ['2510', 'Prêts au personnel', 40000, 0],
  ['2811', 'Amortissements des frais de constitution', 0, 4000],
  ['2820', 'Amortissements des frais de recherche et développement', 0, 24000],
  ['2832', 'Amortissements des constructions', 0, 180000],
  ['2834', 'Amortissements du matériel et outillage', 0, 10000],
  ['2835', 'Amortissements du matériel de transport', 0, 60000],
  ['3110', 'Marchandises', 250000, 0],
  ['3421', 'Clients', 320000, 0],
  ['3422', 'Clients douteux', 30000, 0],
  ['3942', 'Provisions pour dépréciation des clients douteux', 0, 15000],
  ['5111', 'Caisse', 5000, 0],
  ['5141', 'Banques (solde débiteur)', 150000, 0],
  ['1111', 'Capital social', 0, 800000],
  ['1140', 'Réserve légale', 0, 100000],
  ['1160', 'Report à nouveau', 0, 60000],
  ['1190', "Résultat net de l'exercice", 0, 322000],
  ['1486', 'Emprunts auprès des établissements de crédit', 0, 300000],
  ['1511', 'Provisions pour risques', 0, 30000],
  ['4411', 'Fournisseurs', 0, 210000],
  ['4432', 'Rémunérations dues au personnel', 0, 40000],
];

const CPC: Line[] = [
  ['7111', 'Ventes de marchandises au Maroc', 0, 1200000],
  ['7211', 'Ventes de produits finis', 0, 500000],
  ['7511', 'Produits financiers', 0, 12000],
  ['6111', 'Achats de marchandises', 620000, 0],
  ['6122', 'Locations', 60000, 0],
  ['6125', 'Autres charges externes', 120000, 0],
  ['6311', 'Impôts et taxes', 12000, 0],
  ['6411', 'Charges de personnel', 300000, 0],
  ['6511', "Autres charges d'exploitation", 40000, 0],
  ['6611', "Charges d'intérêts", 12000, 0],
  ['6811', "Dotations d'exploitation aux amortissements", 206000, 0],
  ['6701', 'Impôts sur les résultats', 20000, 0],
];

const JOURNAL: [string, string, string, number, number][] = [
  ['4111', 'Clients — facture n° F2025-0148', '2025-03-15', 216000, 0],
  ['7111', 'Ventes de marchandises au Maroc', '2025-03-15', 0, 180000],
  ['4455', 'État, TVA facturée', '2025-03-15', 0, 36000],
  ['6122', 'Locations — loyer annuel local commercial', '2025-12-31', 60000, 0],
  ['5141', 'Banques', '2025-12-31', 0, 60000],
];

const IMMOBILISATIONS = {
  type: 'immobilisations',
  source: 'Dossier d’immobilisations 2025 — Atlas Composants SARL (exemple pédagogique)',
  actifs: [
    {
      compte: '2340',
      libelle: 'Machine de découpe CNC (MAC-CNC-01)',
      cout: 100000,
      mise_en_service: '2025-01-01',
      duree_fiscale_cgnc: 10,
      duree_utilite_ifrs: 5,
      justification_duree:
        "Durée d'utilité économique de 5 ans retenue en IFRS : cadence d'utilisation en 2 postes, contrat de production triennal renouvelable et usure technique constatée sur des équipements comparables. Durée fiscale CGNC de 10 ans inadaptée à la consommation réelle des avantages économiques.",
      valeur_residuelle: 0,
      methode: 'linéaire',
      amortissements_cgnc_cumules: 10000,
      compte_amortissements: '2834',
    },
    {
      compte: '2350',
      libelle: 'Camion de livraison (CAM-02)',
      cout: 180000,
      mise_en_service: '2024-01-01',
      duree_fiscale_cgnc: 5,
      duree_utilite_ifrs: null,
      justification_duree: "Non documentée à ce stade : informations complémentaires requises.",
      valeur_residuelle: null,
      methode: 'linéaire',
      amortissements_cgnc_cumules: 60000,
      compte_amortissements: '2835',
    },
    {
      compte: '2320',
      libelle: 'Bâtiment industriel (SIÈGE-1)',
      cout: 600000,
      mise_en_service: '2020-01-01',
      duree_fiscale_cgnc: 20,
      duree_utilite_ifrs: null,
      justification_duree: "Analyse par composants non réalisée : informations complémentaires requises.",
      valeur_residuelle: null,
      methode: 'linéaire',
      amortissements_cgnc_cumules: 180000,
      compte_amortissements: '2832',
    },
  ],
};

const CONTRAT_LOCATION = {
  type: 'contrat_location',
  source: 'Fiche de synthèse — contrat de location du local commercial (exemple pédagogique)',
  reference: 'LOC-2025-01',
  preneur: 'Atlas Composants SARL',
  bailleur: 'SCI Anfa Immobilier',
  objet: 'Local commercial de 320 m² — Zone industrielle Sidi Bernoussi, Casablanca',
  date_signature: '2024-12-15',
  date_debut: '2025-01-01',
  duree_mois: 48,
  loyer_annuel: 60000,
  periodicite: 'annuelle, à terme échu',
  taux_implicite: null,
  taux_emprunt_marginal: 0.08,
  option_renouvellement: 'aucune',
  option_achat: 'aucune',
  depenses_directes_initiales: 0,
  paiements_avance: 0,
  avantages_incitatifs: 0,
  exemption: 'aucune',
  commentaire:
    "Le taux implicite du contrat n'est pas communiqué par le bailleur : le taux d'emprunt marginal du preneur (8 %) est retenu conformément à IFRS 16. Durée supérieure à 12 mois et loyer mensuel supérieur au seuil des actifs de faible valeur : aucune exemption applicable.",
};

const ANNEXE_PROVISIONS = {
  type: 'annexe',
  source: 'Annexe — provisions pour risques et charges (exemple pédagogique)',
  provisions: [
    {
      compte: '1511',
      libelle: 'Provision pour litige commercial avec le fournisseur Metal Supply',
      montant: 30000,
      nature: 'Litige prud’homal en cours',
      obligation: 'Obligation éventuelle — issue non déterminée à la date de clôture',
      probabilite: 'non documentée',
      echeance: 'non documentée',
      commentaire:
        "Informations insuffisantes pour conclure au respect des trois critères d'IAS 37 : la provision doit être requalifiée en passif éventuel à mentionner en annexe, ou maintenue si l'obligation est confirmée. Informations complémentaires requises.",
    },
  ],
};

export function createDemoDossier(userId: string, companyName = 'Atlas Composants SARL (exemple pédagogique)'): string {
  const dossierId = id('dos');
  const ts = now();
  const closingDate = '2025-12-31';

  insert('companies', {
    id: id('cmp'),
    user_id: userId,
    name: companyName,
    ice: 'DEMO-000000000000000',
    identifiant_fiscal: '00000000',
    city: 'Casablanca',
    secteur: 'Métallurgie / assemblage industriel',
    created_at: ts,
  });

  insert('dossiers', {
    id: dossierId,
    user_id: userId,
    company_id: null,
    name: 'Démonstration universitaire — Conversion CGNC → IFRS 2025',
    company_name: companyName,
    exercice: '2025',
    closing_date: closingDate,
    currency: 'MAD',
    conversion_type: 'premiere_adoption',
    framework: 'IAS 1',
    is_demo: 1,
    status: 'analyse',
    notes:
      "Dossier fictif créé par le mode démonstration. Les données sont cohérentes et équilibrées. Les hypothèses de calcul (durée d'utilité, taux d'actualisation, taux d'impôt) sont explicitement identifiées comme hypothèses de l'exercice pédagogique et doivent être validées par l'utilisateur. Aucune donnée réelle n'est utilisée.",
    created_at: ts,
    updated_at: ts,
  });

  /* ---------------------------------------------------------- Documents */
  const docBalance = id('doc');
  const totalDebit = BALANCE.reduce((s, l) => s + l[2], 0);
  const totalCredit = BALANCE.reduce((s, l) => s + l[3], 0);
  insert('documents', {
    id: docBalance,
    dossier_id: dossierId,
    kind: 'balance',
    filename: 'Balance générale 2025 — Atlas Composants SARL.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 18432,
    stored_name: '',
    status: 'extrait',
    message: `Balance équilibrée : total débit = total crédit = ${totalDebit.toFixed(2)} MAD. Document de référence pour le tableau de passage.`,
    rows: BALANCE.length,
    columns_json: JSON.stringify(['Compte', 'Libellé', 'Débit', 'Crédit']),
    parsed_json: JSON.stringify({ type: 'balance', totalDebit, totalCredit, equilibre: totalDebit === totalCredit }),
    uploaded_at: ts,
  });

  const docBilan = id('doc');
  insert('documents', {
    id: docBilan,
    dossier_id: dossierId,
    kind: 'bilan',
    filename: 'Bilan CGNC 2025 — Atlas Composants SARL.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 12288,
    stored_name: '',
    status: 'extrait',
    message:
      "Bilan après affectation : le résultat net de l'exercice (322 000,00 MAD) y figure au compte 1190. Document de contrôle, non utilisé comme source du tableau de passage (priorité à la balance générale).",
    rows: BILAN.length,
    columns_json: JSON.stringify(['Compte', 'Libellé', 'Débit', 'Crédit']),
    parsed_json: JSON.stringify({ type: 'bilan' }),
    uploaded_at: ts,
  });

  const docCpc = id('doc');
  insert('documents', {
    id: docCpc,
    dossier_id: dossierId,
    kind: 'cpc',
    filename: 'Compte de produits et charges 2025 — Atlas Composants SARL.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 10240,
    stored_name: '',
    status: 'extrait',
    message:
      'Produits 1 712 000,00 MAD — charges 1 390 000,00 MAD — résultat net 322 000,00 MAD. Document de contrôle.',
    rows: CPC.length,
    columns_json: JSON.stringify(['Compte', 'Libellé', 'Débit', 'Crédit']),
    parsed_json: JSON.stringify({ type: 'cpc', produits: 1712000, charges: 1390000, resultat: 322000 }),
    uploaded_at: ts,
  });

  const docJournal = id('doc');
  insert('documents', {
    id: docJournal,
    dossier_id: dossierId,
    kind: 'journal',
    filename: 'Extrait du journal comptable 2025 — Atlas Composants SARL.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 8192,
    stored_name: '',
    status: 'extrait',
    message: 'Extrait du journal (document illustratif). Non utilisé comme source du tableau de passage.',
    rows: JOURNAL.length,
    columns_json: JSON.stringify(['Compte', 'Libellé', 'Date', 'Débit', 'Crédit']),
    parsed_json: JSON.stringify({ type: 'journal' }),
    uploaded_at: ts,
  });

  insert('documents', {
    id: id('doc'),
    dossier_id: dossierId,
    kind: 'immobilisations',
    filename: "Détail des immobilisations et durées d'utilité 2025.xlsx",
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 9216,
    stored_name: '',
    status: 'extrait',
    message:
      "3 immobilisations corporelles. La machine MAC-CNC-01 dispose d'une durée d'utilité IFRS documentée (5 ans). Le camion et le bâtiment sont en attente d'informations complémentaires.",
    rows: IMMOBILISATIONS.actifs.length,
    columns_json: JSON.stringify(['Compte', 'Libellé', 'Coût', 'Mise en service', 'Durée CGNC', 'Durée IFRS']),
    parsed_json: JSON.stringify(IMMOBILISATIONS),
    uploaded_at: ts,
  });

  insert('documents', {
    id: id('doc'),
    dossier_id: dossierId,
    kind: 'contrat',
    filename: 'Contrat de location — local commercial (fiche de synthèse).pdf',
    mime: 'application/pdf',
    size: 65536,
    stored_name: '',
    status: 'extrait',
    message:
      "Contrat identifié pour IFRS 16 : durée 48 mois, loyer annuel 60 000 MAD à terme échu, taux d'emprunt marginal 8 %, aucune exemption applicable.",
    rows: 1,
    columns_json: JSON.stringify(['Référence', 'Objet', 'Début', 'Durée', 'Loyer annuel', 'Taux']),
    parsed_json: JSON.stringify(CONTRAT_LOCATION),
    uploaded_at: ts,
  });

  insert('documents', {
    id: id('doc'),
    dossier_id: dossierId,
    kind: 'annexe',
    filename: 'Annexe — provisions pour risques et charges 2025.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 7168,
    stored_name: '',
    status: 'extrait',
    message:
      "Provision pour litige commercial de 30 000 MAD : informations insuffisantes pour vérifier les critères de comptabilisation d'IAS 37.",
    rows: ANNEXE_PROVISIONS.provisions.length,
    columns_json: JSON.stringify(['Compte', 'Libellé', 'Montant', 'Nature', 'Probabilité']),
    parsed_json: JSON.stringify(ANNEXE_PROVISIONS),
    uploaded_at: ts,
  });

  /* --------------------------------------------------------- Lignes CGNC */
  const pushLines = (docId: string, lines: Line[], source: string, withDate = false) => {
    lines.forEach((l, i) => {
      insert('gl_lines', {
        id: id('gl'),
        dossier_id: dossierId,
        document_id: docId,
        account_code: l[0],
        account_label: l[1],
        debit: l[2],
        credit: l[3],
        balance: Math.round((l[2] - l[3]) * 100) / 100,
        aux: '',
        source,
        raw_json: JSON.stringify({ line: i + 1, date: withDate ? '2025-12-31' : undefined }),
        sort_order: i,
        created_at: ts,
      });
    });
  };
  pushLines(docBalance, BALANCE, 'balance');
  pushLines(docBilan, BILAN, 'bilan');
  pushLines(docCpc, CPC, 'cpc');
  JOURNAL.forEach((j, i) => {
    insert('gl_lines', {
      id: id('gl'),
      dossier_id: dossierId,
      document_id: docJournal,
      account_code: j[0],
      account_label: j[1],
      debit: j[3],
      credit: j[4],
      balance: Math.round((j[3] - j[4]) * 100) / 100,
      aux: j[2],
      source: 'journal',
      raw_json: JSON.stringify({ line: i + 1, date: j[2] }),
      sort_order: i,
      created_at: ts,
    });
  });

  /* -------------------------------------------------------- Hypothèses */
  const hyp = (
    normCode: string,
    scope: string,
    key: string,
    label: string,
    value: string | number,
    unit: string,
    kind: 'fait' | 'hypothese',
    source: string,
    validated = 1,
  ) =>
    insert('assumptions', {
      id: id('asm'),
      dossier_id: dossierId,
      norm_code: normCode,
      scope,
      key,
      label,
      value: String(value),
      unit,
      kind,
      source,
      validated,
      required: 1,
      note: kind === 'hypothese' ? "Hypothèse de l'exercice pédagogique — à valider par l'utilisateur." : '',
      created_at: ts,
    });

  const HYP_SRC = "Hypothèse de l'exercice pédagogique (mode démonstration)";

  hyp('IAS 16', 'ias16:2340', 'in_service_date', 'Date de mise en service', '2025-01-01', 'date', 'fait', 'Dossier d’immobilisations 2025');
  hyp('IAS 16', 'ias16:2340', 'useful_life_years', "Durée d'utilité estimée en IFRS", 5, 'années', 'hypothese', HYP_SRC);
  hyp('IAS 16', 'ias16:2340', 'useful_life_justification', "Justification de la durée d'utilité retenue", "Cadence en 2 postes, contrat de production triennal renouvelable, usure technique constatée sur équipements comparables.", 'texte', 'fait', 'Dossier d’immobilisations 2025');
  hyp('IAS 16', 'ias16:2340', 'residual_value', 'Valeur résiduelle estimée', 0, 'MAD', 'hypothese', HYP_SRC);
  hyp('IAS 16', 'ias16:2340', 'method', "Méthode d'amortissement retenue", 'lineaire', 'texte', 'hypothese', HYP_SRC);
  hyp('IAS 16', 'ias16:2340', 'accum_account', 'Compte CGNC des amortissements cumulés rattaché', '2834', 'compte', 'fait', 'Balance générale 2025');
  hyp('IAS 16', 'ias16:2340', 'cgnc_useful_life_years', 'Durée retenue en CGNC (fiscale)', 10, 'années', 'fait', 'Balance générale 2025 / pratique fiscale');

  hyp('IFRS 16', 'ifrs16:LOC-2025-01', 'contract_label', 'Libellé du contrat', 'Local commercial — Zone industrielle Sidi Bernoussi, Casablanca', 'texte', 'fait', 'Contrat de location');
  hyp('IFRS 16', 'ifrs16:LOC-2025-01', 'rent_account', 'Compte CGNC de charge locative concerné', '6122', 'compte', 'fait', 'Balance générale 2025');
  hyp('IFRS 16', 'ifrs16:LOC-2025-01', 'start_date', 'Date de début du contrat', '2025-01-01', 'date', 'fait', 'Contrat de location');
  hyp('IFRS 16', 'ifrs16:LOC-2025-01', 'term_months', 'Durée de location', 48, 'mois', 'fait', 'Contrat de location');
  hyp('IFRS 16', 'ifrs16:LOC-2025-01', 'payment_amount', 'Montant du loyer par période', 60000, 'MAD', 'fait', 'Contrat de location');
  hyp('IFRS 16', 'ifrs16:LOC-2025-01', 'payments_per_year', 'Nombre de paiements par an', 1, 'nombre', 'fait', 'Contrat de location');
  hyp('IFRS 16', 'ifrs16:LOC-2025-01', 'payment_timing', 'Paiement en début ou en fin de période', 'fin', 'texte', 'fait', 'Contrat de location');
  hyp('IFRS 16', 'ifrs16:LOC-2025-01', 'discount_rate', "Taux d'actualisation retenu", 0.08, 'taux', 'hypothese', "Taux d'emprunt marginal du preneur (le taux implicite n'est pas communiqué par le bailleur) — " + HYP_SRC);
  hyp('IFRS 16', 'ifrs16:LOC-2025-01', 'exemption', 'Exemption applicable', 'aucune', 'texte', 'fait', 'Contrat de location');
  hyp('IFRS 16', 'ifrs16:LOC-2025-01', 'initial_direct_costs', 'Dépenses initiales directes', 0, 'MAD', 'fait', 'Contrat de location');
  hyp('IFRS 16', 'ifrs16:LOC-2025-01', 'prepaid_payments', "Paiements d'avance", 0, 'MAD', 'fait', 'Contrat de location');
  hyp('IFRS 16', 'ifrs16:LOC-2025-01', 'incentives', 'Avantages incitatifs', 0, 'MAD', 'fait', 'Contrat de location');

  hyp('IAS 38', 'ias38:2110', 'accum_account', 'Compte des amortissements cumulés rattaché', '2811', 'compte', 'fait', 'Balance générale 2025');
  hyp('IAS 38', 'ias38:2110', 'nature', 'Nature des dépenses', 'non_valeurs', 'texte', 'fait', 'Balance générale 2025 — frais de constitution');

  hyp('IAS 12', 'ias12', 'tax_rate', "Taux d'impôt sur les sociétés à appliquer", 0.2, 'taux', 'hypothese', HYP_SRC + " — taux d'IS de 20 % retenu pour l'exercice ; à remplacer par le taux effectivement applicable et sa source officielle.");
  hyp('IAS 12', 'ias12', 'tax_rate_source', 'Source du taux', "Hypothèse pédagogique (mode démonstration) — à remplacer par la référence fiscale officielle applicable à l'entreprise.", 'texte', 'fait', 'Mode démonstration');

  hyp('IAS 1', 'ias1:2510', 'current_portion', 'Montant remboursable à moins de douze mois', 40000, 'MAD', 'fait', 'Échéancier des prêts au personnel — 12 mensualités à compter de janvier 2025');

  /* --------------------------------------- Correspondances et retraitements */
  saveMappings(dossierId, proposeMappings(dossierId), userId);
  const proposed = proposeAdjustments(dossierId);
  saveAdjustments(dossierId, proposed);

  return dossierId;
}

export function resetDemoDossier(userId: string) {
  const demos = all('SELECT id FROM dossiers WHERE user_id = ? AND is_demo = 1', [userId]);
  for (const d of demos) {
    run('DELETE FROM entries WHERE dossier_id = ?', [d.id]);
    run('DELETE FROM adjustments WHERE dossier_id = ?', [d.id]);
    run('DELETE FROM mappings WHERE dossier_id = ?', [d.id]);
    run('DELETE FROM assumptions WHERE dossier_id = ?', [d.id]);
    run('DELETE FROM gl_lines WHERE dossier_id = ?', [d.id]);
    run('DELETE FROM documents WHERE dossier_id = ?', [d.id]);
    run('DELETE FROM statements WHERE dossier_id = ?', [d.id]);
    run('DELETE FROM chat_messages WHERE dossier_id = ?', [d.id]);
    run('DELETE FROM dossiers WHERE id = ?', [d.id]);
  }
  return demos.length;
}

export function demoStats(dossierId: string) {
  const d = get('SELECT * FROM dossiers WHERE id = ?', [dossierId]);
  return {
    dossier: d,
    documents: all('SELECT kind, filename, rows, status, message FROM documents WHERE dossier_id = ?', [dossierId]),
    lines: all('SELECT COUNT(*) AS n FROM gl_lines WHERE dossier_id = ?', [dossierId])[0]?.n,
    assumptions: all('SELECT COUNT(*) AS n FROM assumptions WHERE dossier_id = ?', [dossierId])[0]?.n,
  };
}
