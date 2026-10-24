/**
 * ÉTATS FINANCIERS IFRS RETRAITÉS
 * ---------------------------------------------------------------------------
 * Les états sont construits à partir du tableau de passage. Un état incomplet
 * n'est jamais présenté comme conforme : chaque état porte un statut de
 * périmètre (`complet` | `partiel` | `indisponible`) et la liste des éléments
 * non couverts.
 */
import { all, get } from '../db.ts';
import { buildPassage, groupLabel, type Passage } from './statements.ts';
import { round2 } from './compute.ts';

export type Coverage = {
  status: 'complet' | 'partiel' | 'indisponible';
  covered: string[];
  notCovered: string[];
  reason?: string;
};

export type FinancialStatements = {
  dossier: any;
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

export function buildFinancialStatements(dossierId: string, onlyApproved = true): FinancialStatements {
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [dossierId]);
  const p = buildPassage(dossierId, onlyApproved);
  const sec = (g: string) => p.sections.find((s) => s.group === g);
  const mapRows = (g: string) =>
    (sec(g)?.rows ?? []).map((r) => ({
      rubric: r.rubric,
      cgnc: r.soldeCGNC,
      ajustement: round2(r.reclassements + r.ajustements),
      ifrs: r.soldeIFRS,
    }));

  const documents = all('SELECT kind, filename FROM documents WHERE dossier_id = ?', [dossierId]);
  const kinds = new Set(documents.map((d) => d.kind as string));
  const entries = all('SELECT * FROM entries WHERE dossier_id = ?', [dossierId]);
  const adjustments = all("SELECT * FROM adjustments WHERE dossier_id = ? AND status <> 'rejete'", [dossierId]);
  const assumptions = all('SELECT * FROM assumptions WHERE dossier_id = ?', [dossierId]);
  const missing = adjustments.flatMap((a) => {
    try {
      return JSON.parse(a.missing_json || '[]');
    } catch {
      return [];
    }
  });

  /* ------------------------------------------------- 1. Situation financière */
  const sofpCoverage: Coverage = {
    status: p.balance.equilibreIFRS ? 'complet' : 'partiel',
    covered: [
      'Actifs non courants et courants',
      'Capitaux propres',
      'Passifs non courants et courants',
      "Contrôle de l'équation comptable",
    ],
    notCovered: [
      'Informations à fournir détaillées par catégorie d’actifs (annexe IAS 16/38/IFRS 16)',
      'Décomposition des créances par ancienneté (IFRS 7 / IFRS 9)',
    ],
    reason: p.balance.equilibreIFRS
      ? undefined
      : "L'équation comptable n'est pas vérifiée après retraitements : la présentation reste provisoire.",
  };

  /* --------------------------------------------------------- 2. Résultat + OCI */
  const produits = p.result.detail.filter((d) => d.group === 'PRODUIT').map((d) => ({ rubric: d.rubric, cgnc: d.cgnc, ajustement: d.ajustement, ifrs: round2(d.cgnc + d.ajustement) }));
  const charges = p.result.detail.filter((d) => d.group === 'CHARGE').map((d) => ({ rubric: d.rubric, cgnc: d.cgnc, ajustement: d.ajustement, ifrs: round2(d.cgnc + d.ajustement) }));
  const impot = p.result.detail.filter((d) => d.group === 'IMPOT').map((d) => ({ rubric: d.rubric, cgnc: d.cgnc, ajustement: d.ajustement, ifrs: round2(d.cgnc + d.ajustement) }));

  const oci: { rubric: string; amount: number }[] = [];
  // Aucun élément de réévaluation ou d'écart actuariel documenté dans les données
  // du dossier : l'OCI n'est pas alimenté artificiellement.
  const ociNote =
    "Aucun élément du résultat global (réévaluation IAS 16/38, écarts actuariels IAS 19, écarts de conversion de conversion IAS 21) n'est documenté dans les données du dossier. L'état des autres éléments du résultat global est présenté vide, sans montant inventé.";

  const plCoverage: Coverage = {
    status: p.result.detail.length === 0 ? 'indisponible' : 'complet',
    covered: ["Chiffre d'affaires et autres produits", 'Charges par nature', "Charge d'impôt (exigible et différé)"],
    notCovered: [
      "Classement IFRS 18 par catégories (exploitation / investissement / financement) : applicable aux exercices ouverts à compter du 1er janvier 2027",
      'Informations sectorielles (IFRS 8) : non requises pour ce périmètre',
    ],
    reason:
      p.result.detail.length === 0
        ? "Aucun compte de charge ou de produit (classes 6 et 7) n'est présent dans la source de référence."
        : undefined,
  };

  /* ------------------------------------------------------- 3. Flux de trésorerie */
  const hasJournal = kinds.has('journal');
  const hasOpening = all(
    "SELECT id FROM dossiers WHERE user_id = ? AND id <> ? AND closing_date < ?",
    [dossier?.user_id, dossierId, dossier?.closing_date],
  ).length > 0;
  const cashflowLines: { rubric: string; amount: number | null; note?: string }[] = [
    { rubric: "Flux nets des activités d'exploitation", amount: null, note: "Nécessite le résultat ajusté des éléments non monétaires et la variation du besoin en fonds de roulement (bilan d'ouverture requis)." },
    { rubric: "Flux nets des activités d'investissement", amount: null, note: "Nécessite le détail des acquisitions et cessions de la période." },
    { rubric: "Flux nets des activités de financement", amount: null, note: "Nécessite le détail des emprunts, remboursements et distributions de la période." },
    { rubric: 'Trésorerie et équivalents de trésorerie à la clôture', amount: round2((sec('ACTIF_COURANT')?.rows ?? []).filter((r) => /trésorerie|caisse|banque/i.test(r.rubric)).reduce((s, r) => s + r.soldeIFRS, 0)) },
  ];
  const cashflowCoverage: Coverage = {
    status: hasOpening ? 'partiel' : 'indisponible',
    covered: ['Trésorerie et équivalents de trésorerie à la clôture'],
    notCovered: [
      "Flux d'exploitation (méthode indirecte)",
      "Flux d'investissement",
      "Flux de financement",
    ],
    reason: hasOpening
      ? "Un exercice précédent est disponible : la reconstitution des flux reste partielle tant que les mouvements de trésorerie ne sont pas détaillés."
      : "Aucun bilan d'ouverture ni détail des mouvements de trésorerie de la période n'est disponible. Le tableau des flux de trésorerie (IAS 7) ne peut pas être produit : les trois catégories de flux resteraient des montants inventés.",
  };

  /* ------------------------------------------- 4. Variation des capitaux propres */
  const openingEquity = hasOpening ? null : null;
  const socieCoverage: Coverage = {
    status: 'partiel',
    covered: [
      'Composition des capitaux propres à la clôture (CGNC et IFRS)',
      'Effet des retraitements sur les capitaux propres',
    ],
    notCovered: [
      "Capitaux propres à l'ouverture",
      'Apports, augmentations de capital et distributions de la période',
      "Mouvements enregistrés directement en capitaux propres (OCI)",
    ],
    reason:
      "Les mouvements de capitaux propres de la période (apports, affectation du résultat, dividendes) ne sont pas documentés dans les données importées : l'état des variations présente donc la variation totale sans décomposition des mouvements.",
  };

  /* ------------------------------------------------------------------ 5. Notes */
  const notes: { title: string; body: string }[] = [];
  notes.push({
    title: 'Note 1 — Base de préparation',
    body: `Les états présentés ont été établis à partir des comptes sociaux de ${dossier?.company_name} arrêtés au ${dossier?.closing_date} selon le référentiel marocain (CGNC), puis retraités pour refléter les normes IAS/IFRS. Le référentiel de présentation retenu est ${dossier?.framework || 'IAS 1'}. Les montants sont exprimés en ${dossier?.currency || 'MAD'}.`,
  });
  notes.push({
    title: 'Note 2 — Méthodes comptables retenues pour les retraitements',
    body: assumptions.length
      ? `Les retraitements reposent sur les hypothèses et faits suivants, saisis et tracés dans le dossier : ${assumptions
          .map((a) => `${a.norm_code} · ${a.key} = ${a.value}`)
          .join(' ; ')}.`
      : "Aucune hypothèse de calcul n'a été saisie : les retraitements chiffrés sont limités aux cas ne nécessitant pas d'hypothèse.",
  });
  notes.push({
    title: 'Note 3 — Immobilisations corporelles (IAS 16)',
    body: "L'amortissement IFRS est calculé sur la base de la durée d'utilité économique documentée et de la valeur résiduelle, en substitution de la dotation CGNC. Les écarts sont comptabilisés en dotation complémentaire (ou reprise) et génèrent, le cas échéant, des impôts différés.",
  });
  notes.push({
    title: 'Note 4 — Contrats de location (IFRS 16)',
    body: "Les contrats de location identifiés donnent lieu à la comptabilisation d'un actif au titre du droit d'utilisation et d'un passif locatif évalué à la valeur actualisée des paiements locatifs. La charge locative CGNC est annulée et remplacée par l'amortissement du droit d'utilisation et la charge d'intérêt. Les exemptions (court terme, faible valeur) sont appliquées lorsqu'elles sont retenues et documentées.",
  });
  notes.push({
    title: 'Note 5 — Impôts différés (IAS 12)',
    body: "Les retraitements générant des différences temporelles donnent lieu à la comptabilisation d'actifs et passifs d'impôt différé, évalués au taux d'impôt attendu pour la période de règlement, non actualisés. La probabilité de bénéfice imposable futur conditionne la comptabilisation des actifs d'impôt différé.",
  });
  notes.push({
    title: 'Note 6 — Éléments non comptabilisés en IFRS',
    body: "Les dépenses ne satisfaisant pas aux critères de comptabilisation en actif (frais d'établissement, dépenses de recherche, développement non documenté) sont constatées en charges, avec sortie simultanée des amortissements cumulés correspondants.",
  });
  notes.push({
    title: 'Note 7 — Informations complémentaires requises',
    body: missing.length
      ? `Les retraitements suivants ne peuvent être chiffrés faute d'informations : ${missing.map((m: any) => m.label).join(' ; ')}. Aucun montant n'a été estimé pour ces postes.`
      : "Toutes les informations nécessaires aux retraitements identifiés ont été fournies.",
  });
  notes.push({
    title: 'Note 8 — Limites du périmètre',
    body: `Périmètre couvert : état de la situation financière, état du résultat. Périmètre non couvert : tableau des flux de trésorerie (${cashflowCoverage.reason}), variations détaillées des capitaux propres, informations sectorielles. La conversion porte sur des comptes sociaux : elle ne constitue pas une consolidation au sens d'IFRS 10.`,
  });
  notes.push({
    title: 'Note 9 — Revue professionnelle',
    body: "Ces états constituent une aide à la conversion et ne se substituent pas à une revue professionnelle. Ils ne doivent pas être présentés comme un jeu d'états financiers IFRS entièrement conforme.",
  });

  return {
    dossier,
    generatedAt: new Date().toISOString(),
    onlyApproved,
    sofp: {
      coverage: sofpCoverage,
      assetsNonCurrent: mapRows('ACTIF_NON_COURANT'),
      assetsCurrent: mapRows('ACTIF_COURANT'),
      equity: mapRows('CAPITAUX_PROPRES'),
      liabilitiesNonCurrent: mapRows('PASSIF_NON_COURANT'),
      liabilitiesCurrent: mapRows('PASSIF_COURANT'),
      totals: p.balance,
    },
    ploci: {
      coverage: plCoverage,
      produits,
      charges,
      impot,
      totalProduits: p.result.produitsIFRS,
      totalCharges: p.result.chargesIFRS,
      totalImpot: p.result.impotIFRS,
      resultatNet: p.result.resultatIFRS,
      resultatNetCGNC: p.result.resultatCGNC,
      oci,
      ociNote,
    },
    cashflow: { coverage: cashflowCoverage, lines: cashflowLines },
    socie: {
      coverage: socieCoverage,
      openingEquity,
      movements: [
        { label: "Capitaux propres à l'ouverture", amount: null, note: 'Non documenté dans les données importées.' },
        { label: 'Résultat net de la période', amount: p.result.resultatIFRS },
        { label: 'Autres mouvements (apports, distributions, OCI)', amount: null, note: 'Non documentés.' },
        { label: 'Effet cumulé des retraitements sur les capitaux propres', amount: p.totalEquityImpact },
      ],
      closingEquity: p.balance.cpIFRS,
      detail: mapRows('CAPITAUX_PROPRES'),
    },
    notes,
  };
}
