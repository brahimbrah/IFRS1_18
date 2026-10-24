/**
 * Table de correspondance CGNC → IFRS (données de référence).
 *
 * Elle est *data-driven* et modifiable par l'administrateur : la correspondance
 * n'est pas figée dans le code métier. Le moteur applique la règle du préfixe le
 * plus long, puis tient compte de la nature économique, de l'échéance et des
 * justificatifs avant de proposer un retraitement.
 *
 * Rappel : il n'existe pas de plan de comptes IFRS universel imposé par les
 * normes internationales. Les rubriques IFRS ci-dessous sont des rubriques de
 * présentation normalisées, pas des numéros de comptes.
 */

export type IfrsGroup =
  | 'ACTIF_NON_COURANT'
  | 'ACTIF_COURANT'
  | 'CAPITAUX_PROPRES'
  | 'PASSIF_NON_COURANT'
  | 'PASSIF_COURANT'
  | 'CHARGE'
  | 'PRODUIT'
  | 'IMPOT';

export type NatureType =
  | 'aucun'
  | 'presentation'
  | 'reclassement'
  | 'evaluation'
  | 'comptabilisation'
  | 'information'
  | 'elimination';

export type MapRule = {
  prefix: string;
  label: string;
  cgncClass: number;
  cgncGroup: string;
  ifrsLine: string;
  ifrsGroup: IfrsGroup;
  /** Côté du solde naturel : débit (actif, charge) ou crédit (passif, CP, produit). */
  sign: 'debit' | 'credit';
  nature: NatureType;
  normCode: string;
  justification: string;
};

export const MAP_RULES: MapRule[] = [
  // ---------------------------------------------------------------- Classe 1
  {
    prefix: '111',
    label: 'Capital social',
    cgncClass: 1,
    cgncGroup: 'Capitaux propres',
    ifrsLine: 'Capital émis',
    ifrsGroup: 'CAPITAUX_PROPRES',
    sign: 'credit',
    nature: 'presentation',
    normCode: 'IAS 1',
    justification:
      "Le capital social est maintenu en capitaux propres. Aucun retraitement de valeur ; vérifier l'existence d'actions de préférence à classer en passif (IAS 32) si des données le suggèrent.",
  },
  {
    prefix: '112',
    label: "Primes d'émission, de fusion, d'apport",
    cgncClass: 1,
    cgncGroup: 'Capitaux propres',
    ifrsLine: 'Primes et réserves liées au capital',
    ifrsGroup: 'CAPITAUX_PROPRES',
    sign: 'credit',
    nature: 'presentation',
    normCode: 'IAS 1',
    justification: 'Présentation en capitaux propres, sans modification de valeur.',
  },
  {
    prefix: '113',
    label: 'Écart de réévaluation',
    cgncClass: 1,
    cgncGroup: 'Capitaux propres',
    ifrsLine: 'Réserve de réévaluation',
    ifrsGroup: 'CAPITAUX_PROPRES',
    sign: 'credit',
    nature: 'information',
    normCode: 'IAS 16',
    justification:
      "Un écart de réévaluation relève du modèle de la réévaluation (IAS 16/38) : sa composition et sa traçabilité doivent être vérifiées et rattachées aux actifs concernés. Ne pas rejouer la réévaluation sans les justificatifs.",
  },
  {
    prefix: '114',
    label: 'Réserves',
    cgncClass: 1,
    cgncGroup: 'Capitaux propres',
    ifrsLine: 'Réserves',
    ifrsGroup: 'CAPITAUX_PROPRES',
    sign: 'credit',
    nature: 'presentation',
    normCode: 'IAS 1',
    justification: 'Réserves présentées en capitaux propres ; aucune divergence de valeur.',
  },
  {
    prefix: '115',
    label: 'Report à nouveau',
    cgncClass: 1,
    cgncGroup: 'Capitaux propres',
    ifrsLine: 'Report à nouveau',
    ifrsGroup: 'CAPITAUX_PROPRES',
    sign: 'credit',
    nature: 'presentation',
    normCode: 'IAS 1',
    justification:
      "Le report à nouveau est repris en capitaux propres ; en première adoption il intègre l'effet cumulé des retraitements (IFRS 1).",
  },
  {
    prefix: '116',
    label: 'Résultats nets en instance d’affectation (report à nouveau)',
    cgncClass: 1,
    cgncGroup: 'Capitaux propres',
    ifrsLine: 'Report à nouveau',
    ifrsGroup: 'CAPITAUX_PROPRES',
    sign: 'credit',
    nature: 'presentation',
    normCode: 'IAS 1',
    justification: 'Poste de capitaux propres sans divergence de valeur.',
  },
  {
    prefix: '118',
    label: "Résultats nets en instance d'affectation",
    cgncClass: 1,
    cgncGroup: 'Capitaux propres',
    ifrsLine: 'Résultat non affecté',
    ifrsGroup: 'CAPITAUX_PROPRES',
    sign: 'credit',
    nature: 'presentation',
    normCode: 'IAS 1',
    justification:
      "À affecter selon la décision de l'assemblée. Vérifier qu'aucun élément ne doit être reclassé en passif (dividende décidé avant clôture).",
  },
  {
    prefix: '119',
    label: "Résultat net de l'exercice",
    cgncClass: 1,
    cgncGroup: 'Capitaux propres',
    ifrsLine: 'Résultat net de la période (report)',
    ifrsGroup: 'CAPITAUX_PROPRES',
    sign: 'credit',
    nature: 'presentation',
    normCode: 'IAS 1',
    justification:
      "Correspond au résultat net IFRS après retraitements. Doit être égal au résultat reconstruit à partir des produits et charges ajustés : contrôle de cohérence obligatoire.",
  },
  {
    prefix: '13',
    label: 'Dettes de financement',
    cgncClass: 1,
    cgncGroup: 'Dettes de financement',
    ifrsLine: 'Emprunts et dettes financières',
    ifrsGroup: 'PASSIF_NON_COURANT',
    sign: 'credit',
    nature: 'reclassement',
    normCode: 'IAS 1',
    justification:
      "Les dettes de financement doivent être scindées entre part non courante et part courante (échéances à moins de douze mois). Le CGNC présente globalement ; l'échéancier du contrat est indispensable.",
  },
  {
    prefix: '14',
    label: 'Dettes rattachées à des participations',
    cgncClass: 1,
    cgncGroup: 'Dettes de financement',
    ifrsLine: 'Emprunts et dettes financières',
    ifrsGroup: 'PASSIF_NON_COURANT',
    sign: 'credit',
    nature: 'reclassement',
    normCode: 'IAS 1',
    justification: 'Même traitement que le compte 13 : ventilation par échéance et vérification du caractère financier.',
  },
  {
    prefix: '15',
    label: 'Provisions durables pour risques et charges',
    cgncClass: 1,
    cgncGroup: 'Provisions durables',
    ifrsLine: 'Provisions pour risques et charges',
    ifrsGroup: 'PASSIF_NON_COURANT',
    sign: 'credit',
    nature: 'comptabilisation',
    normCode: 'IAS 37',
    justification:
      "IAS 37 exige une obligation actuelle résultant d'un événement passé, la probabilité de sortie de ressources et une estimation fiable. Le CGNC comptabilise des provisions sur des bases prudentielles, parfois sans obligation juridique. Chaque provision doit être re-testée, éventuellement actualisée.",
  },
  {
    prefix: '16',
    label: 'Dettes de financement diverses',
    cgncClass: 1,
    cgncGroup: 'Dettes de financement',
    ifrsLine: 'Autres passifs financiers',
    ifrsGroup: 'PASSIF_NON_COURANT',
    sign: 'credit',
    nature: 'reclassement',
    normCode: 'IAS 1',
    justification: 'Ventilation par échéance et évaluation au coût amorti (IFRS 9) si le passif porte intérêts.',
  },

  // ---------------------------------------------------------------- Classe 2
  {
    prefix: '21',
    label: 'Immobilisations en non-valeurs',
    cgncClass: 2,
    cgncGroup: 'Immobilisations en non-valeurs',
    ifrsLine: 'Actifs incorporels identifiables / aucune reconnaissance',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'comptabilisation',
    normCode: 'IAS 38',
    justification:
      "Les non-valeurs (frais de constitution, de prospection, de publicité) ne satisfont pas aux critères de comptabilisation en actif incorporel au sens d'IAS 38 : elles doivent être constatées en charges. Leur valeur nette comptable CGNC constitue le montant du retraitement de radiation.",
  },
  {
    prefix: '212',
    label: 'Frais de constitution',
    cgncClass: 2,
    cgncGroup: 'Immobilisations en non-valeurs',
    ifrsLine: 'Aucune reconnaissance (charges)',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'comptabilisation',
    normCode: 'IAS 38',
    justification:
      "Frais d'établissement explicitement non comptabilisables en actif selon IAS 38 : radiation de la valeur nette comptable en charges.",
  },
  {
    prefix: '213',
    label: 'Frais de prospection',
    cgncClass: 2,
    cgncGroup: 'Immobilisations en non-valeurs',
    ifrsLine: 'Aucune reconnaissance (charges)',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'comptabilisation',
    normCode: 'IAS 38',
    justification: 'Les dépenses de prospection et de publicité sont des charges de la période (IAS 38).',
  },
  {
    prefix: '214',
    label: 'Frais de publicité',
    cgncClass: 2,
    cgncGroup: 'Immobilisations en non-valeurs',
    ifrsLine: 'Aucune reconnaissance (charges)',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'comptabilisation',
    normCode: 'IAS 38',
    justification: 'Frais de publicité non comptabilisables en actif incorporel (IAS 38).',
  },
  {
    prefix: '22',
    label: 'Immobilisations incorporelles',
    cgncClass: 2,
    cgncGroup: 'Immobilisations incorporelles',
    ifrsLine: 'Immobilisations incorporelles',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 38',
    justification:
      "Vérifier pour chaque élément : identifiabilité, contrôle, avantages économiques futurs, évaluation fiable, et respect des critères de capitalisation (notamment pour les dépenses de développement). Les dépenses de recherche activées par le CGNC doivent être passées en charges.",
  },
  {
    prefix: '221',
    label: 'Frais de recherche et développement',
    cgncClass: 2,
    cgncGroup: 'Immobilisations incorporelles',
    ifrsLine: 'Immobilisations incorporelles (développement) ou charges (recherche)',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'comptabilisation',
    normCode: 'IAS 38',
    justification:
      "Les frais de recherche sont des charges. Les frais de développement ne sont activables que si les six critères d'IAS 38 sont documentés. À défaut de documentation, la valeur nette CGNC est passée en charges.",
  },
  {
    prefix: '23',
    label: 'Immobilisations corporelles',
    cgncClass: 2,
    cgncGroup: 'Immobilisations corporelles',
    ifrsLine: 'Immobilisations corporelles',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 16',
    justification:
      "Contrôler la comptabilisation (critères d'activation), la durée d'utilité économique, la valeur résiduelle, la méthode d'amortissement, la décomposition par composants et les indices de perte de valeur. La dotation CGNC est usuellement calée sur des durées fiscales.",
  },
  {
    prefix: '231',
    label: 'Terrains',
    cgncClass: 2,
    cgncGroup: 'Immobilisations corporelles',
    ifrsLine: 'Terrains',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'aucun',
    normCode: 'IAS 16',
    justification:
      "Les terrains ne sont pas amortis. Vérifier toutefois l'existence de terrains à bâtir, de carrières ou de remblais (composants amortissables) et les indices de perte de valeur.",
  },
  {
    prefix: '232',
    label: 'Constructions',
    cgncClass: 2,
    cgncGroup: 'Immobilisations corporelles',
    ifrsLine: 'Constructions',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 16',
    justification:
      "Appliquer l'approche par composants (structure, toiture, installations) et retenir des durées d'utilité économiques documentées plutôt que la durée fiscale unique.",
  },
  {
    prefix: '233',
    label: 'Installations techniques, matériel et outillage',
    cgncClass: 2,
    cgncGroup: 'Immobilisations corporelles',
    ifrsLine: 'Installations techniques et outillage',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 16',
    justification:
      "Vérifier la durée d'utilité économique (utilisation réelle, contrat de production), la valeur résiduelle et l'éventuelle obsolescence accélérée.",
  },
  {
    prefix: '234',
    label: 'Matériel et outillage',
    cgncClass: 2,
    cgncGroup: 'Immobilisations corporelles',
    ifrsLine: 'Matériel et outillage',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 16',
    justification:
      "Poste le plus souvent concerné par un écart de durée d'utilité entre la durée fiscale CGNC et la durée d'utilité économique IFRS. Le calcul exige le coût, la date de mise en service, la durée d'utilité justifiée, la valeur résiduelle et la méthode.",
  },
  {
    prefix: '235',
    label: 'Matériel de transport',
    cgncClass: 2,
    cgncGroup: 'Immobilisations corporelles',
    ifrsLine: 'Matériel de transport',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 16',
    justification:
      "Durée d'utilité à apprécier selon l'usage (kilométrage, secteur, politique de renouvellement) et valeur résiduelle explicite (valeur de reprise).",
  },
  {
    prefix: '238',
    label: 'Autres immobilisations corporelles',
    cgncClass: 2,
    cgncGroup: 'Immobilisations corporelles',
    ifrsLine: 'Autres immobilisations corporelles',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 16',
    justification: "Mêmes contrôles qu'au compte 23 : durée d'utilité, valeur résiduelle, dépréciation.",
  },
  {
    prefix: '25',
    label: 'Immobilisations financières',
    cgncClass: 2,
    cgncGroup: 'Immobilisations financières',
    ifrsLine: 'Actifs financiers non courants',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'reclassement',
    normCode: 'IAS 1',
    justification:
      "Les prêts et créances financières doivent être scindés : la part remboursable à moins de douze mois est un actif courant (IAS 1). L'échéancier détaillé est indispensable. Évaluation ultérieure au coût amorti (IFRS 9).",
  },
  {
    prefix: '251',
    label: 'Prêts',
    cgncClass: 2,
    cgncGroup: 'Immobilisations financières',
    ifrsLine: 'Prêts (part courante / non courante)',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'reclassement',
    normCode: 'IAS 1',
    justification:
      "Reclassement de la fraction exigible à moins de douze mois en actifs courants. Le caractère « non courant » CGNC ne peut être repris tel quel sans échéancier.",
  },
  {
    prefix: '28',
    label: 'Amortissements des immobilisations',
    cgncClass: 2,
    cgncGroup: 'Amortissements',
    ifrsLine: 'Amortissements cumulés (en déduction des actifs)',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 16',
    justification:
      "Compte soustractif présenté en déduction des immobilisations brutes. Les dotations IFRS se substituent aux dotations CGNC pour la présentation : l'écart de cumul constitue le montant du retraitement IAS 16.",
  },
  {
    prefix: '29',
    label: 'Provisions pour dépréciation des immobilisations',
    cgncClass: 2,
    cgncGroup: 'Provisions pour dépréciation',
    ifrsLine: 'Dépréciation cumulée (en déduction)',
    ifrsGroup: 'ACTIF_NON_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 36',
    justification:
      "Compte soustractif. IAS 36 impose de comparer la valeur comptable à la valeur recouvrable (la plus élevée de la juste valeur nette des coûts de sortie et de la valeur d'utilité). Sans flux de trésorerie ni taux d'actualisation, aucun test ne peut être quantifié.",
  },

  // ---------------------------------------------------------------- Classe 3
  {
    prefix: '31',
    label: 'Stocks',
    cgncClass: 3,
    cgncGroup: 'Stocks',
    ifrsLine: 'Stocks',
    ifrsGroup: 'ACTIF_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 2',
    justification:
      "Évaluation au plus faible du coût et de la valeur nette de réalisation ; exclusion des frais généraux anormaux et des coûts de sous-activité ; méthodes FIFO ou coût moyen pondéré (LIFO interdit).",
  },
  {
    prefix: '311',
    label: 'Marchandises',
    cgncClass: 3,
    cgncGroup: 'Stocks',
    ifrsLine: 'Marchandises',
    ifrsGroup: 'ACTIF_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 2',
    justification: 'Contrôle de la VNR et de l’absence de coûts non incorporables.',
  },
  {
    prefix: '312',
    label: 'Matières premières et fournitures',
    cgncClass: 3,
    cgncGroup: 'Stocks',
    ifrsLine: 'Matières premières',
    ifrsGroup: 'ACTIF_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 2',
    justification: 'Contrôle de la VNR, des invendus et de l’obsolescence.',
  },
  {
    prefix: '315',
    label: 'Produits en cours',
    cgncClass: 3,
    cgncGroup: 'Stocks',
    ifrsLine: 'Produits en cours',
    ifrsGroup: 'ACTIF_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 2',
    justification: 'Vérifier les coûts de transformation incorporés (sous-activité exclue).',
  },
  {
    prefix: '317',
    label: 'Produits finis',
    cgncClass: 3,
    cgncGroup: 'Stocks',
    ifrsLine: 'Produits finis',
    ifrsGroup: 'ACTIF_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 2',
    justification: 'Contrôle de la VNR à la clôture.',
  },
  {
    prefix: '34',
    label: "Créances de l'actif circulant",
    cgncClass: 3,
    cgncGroup: "Créances de l'actif circulant",
    ifrsLine: 'Créances clients et autres créances',
    ifrsGroup: 'ACTIF_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IFRS 9',
    justification:
      "Les créances sont évaluées à la juste valeur initiale puis au coût amorti, diminuées des pertes de crédit attendues. Le CGNC retient une dépréciation au cas par cas (perte encourue) : divergence de méthode.",
  },
  {
    prefix: '3421',
    label: 'Clients',
    cgncClass: 3,
    cgncGroup: "Créances de l'actif circulant",
    ifrsLine: 'Clients',
    ifrsGroup: 'ACTIF_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IFRS 9',
    justification:
      "Appliquer le modèle de pertes de crédit attendues (ECL) : matrice de provisionnement par ancienneté ou taux de perte historique ajusté. Exige l'antériorité des créances et les données de recouvrement.",
  },
  {
    prefix: '3422',
    label: 'Clients douteux',
    cgncClass: 3,
    cgncGroup: "Créances de l'actif circulant",
    ifrsLine: 'Clients (bruts) et dépréciation ECL',
    ifrsGroup: 'ACTIF_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IFRS 9',
    justification:
      "Présentation brute et dépréciation distincte ; le taux de perte attendu doit être documenté. En l'absence de matrice de provisionnement, aucune réévaluation ne peut être calculée.",
  },
  {
    prefix: '35',
    label: 'Titres et valeurs de placement',
    cgncClass: 3,
    cgncGroup: 'Titres et valeurs de placement',
    ifrsLine: 'Actifs financiers à la juste valeur',
    ifrsGroup: 'ACTIF_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IFRS 9',
    justification:
      "Classement selon le modèle économique et le test SPPI ; évaluation à la juste valeur pour les titres négociés. La juste valeur doit être justifiée par un cours ou une méthode d'évaluation.",
  },
  {
    prefix: '39',
    label: "Provisions pour dépréciation des comptes de l'actif circulant",
    cgncClass: 3,
    cgncGroup: 'Provisions pour dépréciation',
    ifrsLine: 'Dépréciations (en déduction)',
    ifrsGroup: 'ACTIF_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IFRS 9',
    justification:
      "Compte soustractif. Le montant IFRS correspond aux pertes de crédit attendues, non à la seule perte encourue retenue par le CGNC.",
  },

  // ---------------------------------------------------------------- Classe 4
  {
    prefix: '44',
    label: 'Dettes du passif circulant',
    cgncClass: 4,
    cgncGroup: 'Dettes du passif circulant',
    ifrsLine: 'Fournisseurs et autres dettes',
    ifrsGroup: 'PASSIF_COURANT',
    sign: 'credit',
    nature: 'presentation',
    normCode: 'IAS 1',
    justification:
      "Présentation en passifs courants. Vérifier le classement des concours bancaires et des dettes dont l'échéance excède douze mois.",
  },
  {
    prefix: '441',
    label: 'Fournisseurs',
    cgncClass: 4,
    cgncGroup: 'Dettes du passif circulant',
    ifrsLine: 'Fournisseurs',
    ifrsGroup: 'PASSIF_COURANT',
    sign: 'credit',
    nature: 'presentation',
    normCode: 'IAS 1',
    justification: 'Passif courant ; coût amorti si le délai de règlement est significatif (ajustement rare).',
  },
  {
    prefix: '443',
    label: 'Rémunérations dues au personnel',
    cgncClass: 4,
    cgncGroup: 'Dettes du passif circulant',
    ifrsLine: 'Dettes sociales',
    ifrsGroup: 'PASSIF_COURANT',
    sign: 'credit',
    nature: 'information',
    normCode: 'IAS 19',
    justification:
      "Vérifier l'existence d'avantages à long terme (indemnités de fin de carrière) non provisionnés, relevant d'IAS 19 et non de ce compte.",
  },
  {
    prefix: '445',
    label: 'État, impôts et taxes',
    cgncClass: 4,
    cgncGroup: 'Dettes du passif circulant',
    ifrsLine: "Dettes fiscales et sociales",
    ifrsGroup: 'PASSIF_COURANT',
    sign: 'credit',
    nature: 'information',
    normCode: 'IAS 12',
    justification:
      "Distinguer l'impôt exigible (passif d'impôt exigible) des impôts différés (IAS 12), qui font l'objet d'une rubrique distincte.",
  },
  {
    prefix: '45',
    label: 'Autres dettes du passif circulant',
    cgncClass: 4,
    cgncGroup: 'Dettes du passif circulant',
    ifrsLine: 'Autres passifs courants',
    ifrsGroup: 'PASSIF_COURANT',
    sign: 'credit',
    nature: 'presentation',
    normCode: 'IAS 1',
    justification: 'Passif courant, sous réserve de la vérification des échéances.',
  },
  {
    prefix: '47',
    label: 'Écarts de conversion - passif',
    cgncClass: 4,
    cgncGroup: 'Écarts de conversion',
    ifrsLine: 'Gains/pertes de change (résultat)',
    ifrsGroup: 'PASSIF_COURANT',
    sign: 'credit',
    nature: 'comptabilisation',
    normCode: 'IAS 21',
    justification:
      "Le CGNC autorise le report des écarts de conversion dans des comptes d'ordre du passif. IAS 21 impose la comptabilisation des écarts sur éléments monétaires en résultat de la période.",
  },

  // ---------------------------------------------------------------- Classe 5
  {
    prefix: '51',
    label: 'Trésorerie - débiteurs',
    cgncClass: 5,
    cgncGroup: 'Trésorerie',
    ifrsLine: 'Trésorerie et équivalents de trésorerie',
    ifrsGroup: 'ACTIF_COURANT',
    sign: 'debit',
    nature: 'presentation',
    normCode: 'IAS 7',
    justification:
      "Trésorerie et équivalents de trésorerie : placements à court terme très liquides, facilement convertibles et soumis à un risque négligeable de changement de valeur. Vérifier les effets escomptés non échus et les valeurs à l'encaissement.",
  },
  {
    prefix: '5111',
    label: 'Caisse',
    cgncClass: 5,
    cgncGroup: 'Trésorerie',
    ifrsLine: 'Caisse',
    ifrsGroup: 'ACTIF_COURANT',
    sign: 'debit',
    nature: 'presentation',
    normCode: 'IAS 7',
    justification: 'Trésorerie disponible.',
  },
  {
    prefix: '5141',
    label: 'Banques (solde débiteur)',
    cgncClass: 5,
    cgncGroup: 'Trésorerie',
    ifrsLine: 'Banques',
    ifrsGroup: 'ACTIF_COURANT',
    sign: 'debit',
    nature: 'presentation',
    normCode: 'IAS 7',
    justification: 'Trésorerie disponible ; non-compensation avec les soldes créditeurs.',
  },
  {
    prefix: '55',
    label: 'Trésorerie - créditeurs',
    cgncClass: 5,
    cgncGroup: 'Trésorerie',
    ifrsLine: 'Concours bancaires courants et découverts',
    ifrsGroup: 'PASSIF_COURANT',
    sign: 'credit',
    nature: 'reclassement',
    normCode: 'IAS 1',
    justification:
      "Les découverts bancaires ne sont pas des équivalents de trésorerie (IAS 7) : ils doivent être présentés en passifs courants, sauf dans le tableau des flux où leur variation nette peut figurer en trésorerie.",
  },
  {
    prefix: '59',
    label: 'Provisions pour dépréciation des comptes de trésorerie',
    cgncClass: 5,
    cgncGroup: 'Provisions pour dépréciation',
    ifrsLine: 'Dépréciation des équivalents de trésorerie',
    ifrsGroup: 'ACTIF_COURANT',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IFRS 9',
    justification: 'Dépréciation au titre des pertes de crédit attendues.',
  },

  // ---------------------------------------------------------------- Classe 6
  {
    prefix: '61',
    label: 'Achats revendus et variations de stocks',
    cgncClass: 6,
    cgncGroup: "Charges d'exploitation",
    ifrsLine: 'Coût des ventes',
    ifrsGroup: 'CHARGE',
    sign: 'debit',
    nature: 'presentation',
    normCode: 'IFRS 18',
    justification:
      "Classement en catégorie « exploitation » de l'état du résultat. Retraitement de présentation principalement (nature vs fonction).",
  },
  {
    prefix: '6122',
    label: 'Locations',
    cgncClass: 6,
    cgncGroup: "Charges d'exploitation",
    ifrsLine: 'Charges locatives (à annuler) / amortissement et intérêts',
    ifrsGroup: 'CHARGE',
    sign: 'debit',
    nature: 'comptabilisation',
    normCode: 'IFRS 16',
    justification:
      "IFRS 16 impose de décomptabiliser la charge locative et de la remplacer par l'amortissement du droit d'utilisation et la charge d'intérêt sur le passif locatif. Le calcul exige la date de début, la durée, les loyers, la périodicité, le taux d'actualisation et les options.",
  },
  {
    prefix: '62',
    label: 'Autres charges externes',
    cgncClass: 6,
    cgncGroup: "Charges d'exploitation",
    ifrsLine: 'Autres charges externes',
    ifrsGroup: 'CHARGE',
    sign: 'debit',
    nature: 'presentation',
    normCode: 'IFRS 18',
    justification:
      "Catégorie exploitation. Vérifier la présence de charges à étaler (IAS 38, primes de contrat) ou de charges locatives déguisées déclenchant IFRS 16.",
  },
  {
    prefix: '63',
    label: 'Impôts et taxes',
    cgncClass: 6,
    cgncGroup: "Charges d'exploitation",
    ifrsLine: 'Impôts et taxes autres que l’impôt sur le résultat',
    ifrsGroup: 'CHARGE',
    sign: 'debit',
    nature: 'presentation',
    normCode: 'IFRS 18',
    justification: "Impôts non assis sur le résultat : catégorie exploitation.",
  },
  {
    prefix: '64',
    label: 'Charges de personnel',
    cgncClass: 6,
    cgncGroup: "Charges d'exploitation",
    ifrsLine: 'Charges de personnel',
    ifrsGroup: 'CHARGE',
    sign: 'debit',
    nature: 'information',
    normCode: 'IAS 19',
    justification:
      "Vérifier la présence d'avantages postérieurs à l'emploi (indemnités de fin de carrière) à provisionner selon IAS 19 et l'étalement des primes et congés payés.",
  },
  {
    prefix: '65',
    label: "Autres charges d'exploitation",
    cgncClass: 6,
    cgncGroup: "Charges d'exploitation",
    ifrsLine: "Autres charges d'exploitation",
    ifrsGroup: 'CHARGE',
    sign: 'debit',
    nature: 'presentation',
    normCode: 'IFRS 18',
    justification: 'Catégorie exploitation.',
  },
  {
    prefix: '66',
    label: 'Charges financières',
    cgncClass: 6,
    cgncGroup: 'Charges financières',
    ifrsLine: "Coût de l'endettement financier",
    ifrsGroup: 'CHARGE',
    sign: 'debit',
    nature: 'reclassement',
    normCode: 'IAS 23',
    justification:
      "Catégorie « financement » (IFRS 18). Les intérêts attribuables à un actif qualifié (construction, immobilisation en cours) doivent être capitalisés (IAS 23), ce qui déplace la charge vers le coût de l'actif.",
  },
  {
    prefix: '67',
    label: 'Charges non courantes',
    cgncClass: 6,
    cgncGroup: 'Charges non courantes',
    ifrsLine: 'Autres charges (catégorie à déterminer)',
    ifrsGroup: 'CHARGE',
    sign: 'debit',
    nature: 'presentation',
    normCode: 'IFRS 18',
    justification:
      "La notion de « non courant » propre au CGNC n'existe pas dans IFRS 18 : chaque élément doit être rattaché à une catégorie (exploitation, investissement, financement).",
  },
  {
    prefix: '68',
    label: "Dotations d'exploitation aux amortissements et provisions",
    cgncClass: 6,
    cgncGroup: 'Dotations',
    ifrsLine: 'Amortissements et dépréciations',
    ifrsGroup: 'CHARGE',
    sign: 'debit',
    nature: 'evaluation',
    normCode: 'IAS 16',
    justification:
      "Les dotations IFRS se substituent aux dotations CGNC. L'écart entre cumul CGNC et cumul IFRS constitue l'ajustement, comptabilisé par une dotation complémentaire ou une reprise.",
  },
  {
    prefix: '670',
    label: 'Impôts sur le résultat (charge exigible)',
    cgncClass: 6,
    cgncGroup: 'Impôts sur le résultat',
    ifrsLine: 'Charge d’impôt exigible',
    ifrsGroup: 'IMPOT',
    sign: 'debit',
    nature: 'comptabilisation',
    normCode: 'IAS 12',
    justification:
      "La charge d'impôt IFRS comprend l'impôt exigible et l'impôt différé. L'impôt différé est calculé sur les différences temporelles issues des retraitements.",
  },

  // ---------------------------------------------------------------- Classe 7
  {
    prefix: '71',
    label: 'Ventes de marchandises',
    cgncClass: 7,
    cgncGroup: 'Produits d’exploitation',
    ifrsLine: 'Chiffre d’affaires',
    ifrsGroup: 'PRODUIT',
    sign: 'credit',
    nature: 'information',
    normCode: 'IFRS 15',
    justification:
      "Vérifier la reconnaissance du produit selon les cinq étapes d'IFRS 15 : transfert du contrôle, obligations distinctes, prix variable, droits de retour, financement du client.",
  },
  {
    prefix: '72',
    label: 'Ventes de biens et services produits',
    cgncClass: 7,
    cgncGroup: 'Produits d’exploitation',
    ifrsLine: 'Chiffre d’affaires',
    ifrsGroup: 'PRODUIT',
    sign: 'credit',
    nature: 'information',
    normCode: 'IFRS 15',
    justification:
      "Vérifier l'existence de contrats à obligations multiples ou à exécution continue (reconnaissance à l'avancement).",
  },
  {
    prefix: '73',
    label: 'Variations de stocks de produits',
    cgncClass: 7,
    cgncGroup: 'Produits d’exploitation',
    ifrsLine: 'Variation des stocks de produits finis',
    ifrsGroup: 'PRODUIT',
    sign: 'credit',
    nature: 'presentation',
    normCode: 'IAS 2',
    justification: 'Présentation en exploitation ; aucune divergence en soi.',
  },
  {
    prefix: '75',
    label: 'Produits financiers',
    cgncClass: 7,
    cgncGroup: 'Produits financiers',
    ifrsLine: 'Produits financiers',
    ifrsGroup: 'PRODUIT',
    sign: 'credit',
    nature: 'information',
    normCode: 'IFRS 9',
    justification:
      "Catégorie « investissement » ou « financement » (IFRS 18). Vérifier le calcul du produit d'intérêt selon la méthode du taux d'intérêt effectif.",
  },
  {
    prefix: '76',
    label: 'Produits non courants',
    cgncClass: 7,
    cgncGroup: 'Produits non courants',
    ifrsLine: 'Autres produits',
    ifrsGroup: 'PRODUIT',
    sign: 'credit',
    nature: 'presentation',
    normCode: 'IFRS 18',
    justification:
      "À rattacher à une catégorie IFRS 18. Vérifier notamment les cessions d'immobilisations (catégorie investissement) et les reprises de provisions (IAS 37).",
  },
  {
    prefix: '77',
    label: 'Reprises de provisions',
    cgncClass: 7,
    cgncGroup: 'Produits d’exploitation',
    ifrsLine: 'Reprises de dépréciations et provisions',
    ifrsGroup: 'PRODUIT',
    sign: 'credit',
    nature: 'evaluation',
    normCode: 'IAS 36',
    justification:
      "Une reprise n'est admise que si les conditions ayant conduit à la dépréciation ont disparu (IAS 36) ou si l'obligation provisionnée est éteinte (IAS 37).",
  },
];

/** Règles de vigilance : ce sont elles qui déclenchent l'analyse des divergences. */
export type WatchRule = {
  id: string;
  prefixes: string[];
  normCode: string;
  type: NatureType;
  severity: 'bloquant' | 'a_verifier' | 'information';
  title: string;
  message: string;
  /** Type d'analyse à exécuter par le moteur déterministe. */
  analyzer: 'ias16' | 'ifrs16' | 'ias12' | 'ias38' | 'ias37' | 'ifrs9' | 'ias2' | 'ias36' | 'ias23' | 'ias1' | 'ias21' | 'ifrs15' | 'ias19' | 'none';
  requiresInfo: string[];
};

export const WATCH_RULES: WatchRule[] = [
  {
    id: 'W-IAS38-NV',
    prefixes: ['21'],
    normCode: 'IAS 38',
    type: 'comptabilisation',
    severity: 'a_verifier',
    title: 'Immobilisations en non-valeurs — non comptabilisables en IFRS',
    message:
      "Des frais inscrits en non-valeurs (constitution, prospection, publicité) figurent à l'actif. IAS 38 interdit leur comptabilisation en actif : la valeur nette comptable doit être passée en charges.",
    analyzer: 'ias38',
    requiresInfo: [],
  },
  {
    id: 'W-IAS38-RD',
    prefixes: ['221', '22'],
    normCode: 'IAS 38',
    type: 'comptabilisation',
    severity: 'a_verifier',
    title: 'Frais de recherche et développement activés',
    message:
      "Des frais de recherche / développement sont activés. Les frais de recherche sont toujours des charges ; les frais de développement ne sont activables que si les six critères d'IAS 38 sont documentés.",
    analyzer: 'ias38',
    requiresInfo: [
      "Nature des dépenses (recherche ou développement)",
      "Faisabilité technique du projet",
      "Intention et capacité d'achever et d'utiliser l'actif",
      "Probabilité d'avantages économiques futurs",
      "Ressources techniques et financières disponibles",
      "Méthode d'évaluation fiable des coûts",
    ],
  },
  {
    id: 'W-IAS16',
    prefixes: ['23'],
    normCode: 'IAS 16',
    type: 'evaluation',
    severity: 'a_verifier',
    title: "Durées d'utilité et valeurs résiduelles des immobilisations corporelles",
    message:
      "Les durées d'amortissement CGNC sont fréquemment alignées sur la fiscalité. IAS 16 exige une durée d'utilité économique justifiée, une valeur résiduelle et, le cas échéant, une approche par composants.",
    analyzer: 'ias16',
    requiresInfo: [
      "Coût d'acquisition",
      "Date de mise en service",
      "Durée d'utilité estimée en IFRS et justification",
      "Valeur résiduelle estimée",
      "Méthode d'amortissement retenue",
      "Amortissements cumulés en CGNC",
      "Détail des composants (le cas échéant)",
    ],
  },
  {
    id: 'W-IAS36',
    prefixes: ['29', '28', '23'],
    normCode: 'IAS 36',
    type: 'evaluation',
    severity: 'information',
    title: 'Indices de perte de valeur',
    message:
      "Rechercher les indices de perte de valeur (obsolescence, baisse des marchés, détérioration). Toute quantification exige des flux de trésorerie prévisionnels et un taux d'actualisation.",
    analyzer: 'ias36',
    requiresInfo: [
      "Indices de perte de valeur identifiés",
      "Flux de trésorerie prévisionnels",
      "Taux d'actualisation",
      "Juste valeur diminuée des coûts de sortie",
    ],
  },
  {
    id: 'W-IAS37',
    prefixes: ['15'],
    normCode: 'IAS 37',
    type: 'comptabilisation',
    severity: 'a_verifier',
    title: 'Provisions durables pour risques et charges',
    message:
      "Chaque provision doit satisfaire les trois critères d'IAS 37 (obligation actuelle, sortie probable de ressources, estimation fiable). Sinon, l'élément est un passif éventuel à mentionner en annexe. Les provisions à long terme doivent être actualisées si l'effet du temps est significatif.",
    analyzer: 'ias37',
    requiresInfo: [
      "Nature de l'obligation (juridique, contractuelle, implicite)",
      "Événement passé à l'origine de l'obligation",
      "Probabilité de sortie de ressources",
      "Meilleure estimation du montant et échéance",
      "Taux d'actualisation si l'effet du temps est significatif",
    ],
  },
  {
    id: 'W-IFRS16',
    prefixes: ['6122', '612', '61'],
    normCode: 'IFRS 16',
    type: 'comptabilisation',
    severity: 'a_verifier',
    title: 'Contrats de location — droits d’utilisation et passifs locatifs',
    message:
      "Les charges locatives CGNC révèlent potentiellement des contrats relevant d'IFRS 16. Il faut identifier les contrats, vérifier les exemptions (court terme, faible valeur) puis calculer l'actif au titre du droit d'utilisation et le passif locatif.",
    analyzer: 'ifrs16',
    requiresInfo: [
      "Date de début du contrat",
      "Durée de location (et options de renouvellement raisonnablement certaines)",
      "Montant et périodicité des loyers",
      "Taux d'actualisation (taux implicite ou taux d'emprunt marginal)",
      "Exemptions applicables (court terme, faible valeur)",
      "Dépenses initiales directes et paiements d'avance",
    ],
  },
  {
    id: 'W-IFRS9',
    prefixes: ['34', '39'],
    normCode: 'IFRS 9',
    type: 'evaluation',
    severity: 'a_verifier',
    title: 'Dépréciation des créances — pertes de crédit attendues',
    message:
      "Le CGNC applique une dépréciation au cas par cas (perte encourue). IFRS 9 impose une estimation des pertes de crédit attendues (ECL) dès la comptabilisation initiale.",
    analyzer: 'ifrs9',
    requiresInfo: [
      "Balance âgée des créances",
      "Taux de perte historique par tranche d'ancienneté",
      "Informations prospectives (secteur, conjoncture)",
      "Garanties ou assurances crédit disponibles",
    ],
  },
  {
    id: 'W-IAS2',
    prefixes: ['31'],
    normCode: 'IAS 2',
    type: 'evaluation',
    severity: 'a_verifier',
    title: 'Évaluation des stocks',
    message:
      "Contrôler la méthode de valorisation (LIFO interdit), l'incorporation des frais généraux et le test de valeur nette de réalisation à la clôture.",
    analyzer: 'ias2',
    requiresInfo: [
      "Méthode de valorisation retenue",
      "Prix de vente estimés et coûts de vente",
      "Détail des frais généraux incorporés",
      "Inventaire physique détaillé et obsolescence",
    ],
  },
  {
    id: 'W-IAS23',
    prefixes: ['66'],
    normCode: 'IAS 23',
    type: 'reclassement',
    severity: 'information',
    title: "Coûts d'emprunt et actifs qualifiés",
    message:
      "Les intérêts attribuables à un actif qualifié (immobilisation en cours de construction, actif nécessitant une longue préparation) doivent être capitalisés et non passés en charges.",
    analyzer: 'ias23',
    requiresInfo: [
      "Existence d'un actif qualifié et son en-cours à la clôture",
      "Montant des dépenses cumulées sur l'actif qualifié",
      "Taux de capitalisation applicable",
      "Période de capitalisation",
    ],
  },
  {
    id: 'W-IAS1',
    prefixes: ['25', '13', '55'],
    normCode: 'IAS 1',
    type: 'reclassement',
    severity: 'a_verifier',
    title: 'Distinction courant / non courant et classement de la trésorerie',
    message:
      "Les échéances doivent être analysées pour ventiler les postes entre courants et non courants. Les soldes bancaires créditeurs sont des passifs courants, non des équivalents de trésorerie.",
    analyzer: 'ias1',
    requiresInfo: [
      "Échéancier détaillé des prêts et emprunts",
      "Part remboursable à moins de douze mois",
      "Nature des soldes créditeurs bancaires",
    ],
  },
  {
    id: 'W-IAS21',
    prefixes: ['37', '47'],
    normCode: 'IAS 21',
    type: 'comptabilisation',
    severity: 'a_verifier',
    title: 'Écarts de conversion en comptes d’ordre',
    message:
      "Les écarts de conversion reportés dans des comptes d'ordre du CGNC doivent être constatés en résultat de la période (IAS 21) pour les éléments monétaires.",
    analyzer: 'ias21',
    requiresInfo: [
      "Détail des créances et dettes en devises à la clôture",
      "Cours de clôture et cours historiques",
      "Nature monétaire ou non monétaire des éléments",
    ],
  },
  {
    id: 'W-IFRS15',
    prefixes: ['71', '72'],
    normCode: 'IFRS 15',
    type: 'information',
    severity: 'information',
    title: 'Reconnaissance du chiffre d’affaires',
    message:
      "Vérifier les contrats comportant des obligations multiples, un prix variable, des droits de retour ou une exécution continue (reconnaissance à l'avancement).",
    analyzer: 'ifrs15',
    requiresInfo: [
      "Description des principaux contrats et obligations de prestation",
      "Existence d'un prix variable, de remises ou de pénalités",
      "Durée des contrats et conditions de transfert du contrôle",
    ],
  },
  {
    id: 'W-IAS19',
    prefixes: ['64', '443'],
    normCode: 'IAS 19',
    type: 'comptabilisation',
    severity: 'a_verifier',
    title: 'Avantages du personnel à long terme',
    message:
      "Les indemnités de fin de carrière (ICD/IFD) constituent un régime à prestations définies à évaluer selon IAS 19 (méthode des unités de crédit projetées, actualisation). Le CGNC les traite en engagement hors bilan.",
    analyzer: 'ias19',
    requiresInfo: [
      "Effectif par ancienneté et salaires de référence",
      "Hypothèses actuarielles (turnover, tables de mortalité, progression salariale)",
      "Taux d'actualisation retenu",
      "Convention collective ou usage applicable",
    ],
  },
];

export function findRule(code: string): MapRule | undefined {
  let best: MapRule | undefined;
  for (const rule of MAP_RULES) {
    if (code.startsWith(rule.prefix)) {
      if (!best || rule.prefix.length > best.prefix.length) best = rule;
    }
  }
  return best;
}
