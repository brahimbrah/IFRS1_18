/**
 * Bibliothèque normative (référentiel CGNC + IAS/IFRS).
 *
 * IMPORTANT — provenance et honnêteté documentaire :
 *  - Les résumés sont des *reformulations personnelles* des principes des normes,
 *    ils ne reproduisent aucun texte officiel.
 *  - Les numéros de paragraphe sont fournis comme repères indicatifs et sont
 *    marqués `verified = 0` (« Référence à vérifier ») jusqu'à validation par
 *    l'administrateur à partir du texte officiel qu'il est autorisé à utiliser.
 *  - L'application ne fabrique jamais de citation et n'invente aucun paragraphe.
 */

export type SeedNorm = {
  code: string;
  title: string;
  kind: 'IFRS' | 'CGNC';
  category: string;
  status: 'en_vigueur' | 'a_venir' | 'remplacee' | 'extension';
  publication_date: string;
  applicable_from: string;
  applicable_note: string;
  summary: string;
  source: string;
  source_url: string;
  paragraphs: {
    number: string;
    title: string;
    text: string;
    keywords: string;
  }[];
};

export const NORM_SEED: SeedNorm[] = [
  {
    code: 'CGNC',
    title: 'Code Général de Normalisation Comptable (Maroc)',
    kind: 'CGNC',
    category: 'Référentiel national',
    status: 'en_vigueur',
    publication_date: '1992-12-25',
    applicable_from: '1993-01-01',
    applicable_note:
      "Référentiel comptable marocain applicable aux comptes sociaux des entreprises. Conçu dans une logique de coût historique, de prudence et de conformité fiscale.",
    summary:
      "Le CGNC impose une présentation normalisée du bilan, du compte de produits et charges, de l'état des soldes de gestion et du tableau de financement. Il privilégie la valeur historique, le principe de prudence et l'articulation avec la fiscalité marocaine. Postes typiques : immobilisations en non-valeurs, écarts de conversion, provisions durables pour risques et charges, comptes d'ordre.",
    source: 'Bulletin Officiel du Royaume du Maroc — loi n° 9-88 relative aux obligations comptables des commerçants',
    source_url: 'https://www.finances.gov.ma/',
    paragraphs: [
      {
        number: 'Art. 1',
        title: 'Obligation de tenir une comptabilité normalisée',
        text: "Toute personne physique ou morale soumise aux obligations comptables des commerçants doit tenir une comptabilité conforme au CGNC et présenter des états de synthèse : bilan, compte de produits et charges, état des soldes de gestion, tableau de financement et états annexés.",
        keywords: 'bilan, CPC, ESG, états de synthèse, obligation',
      },
      {
        number: 'Principe',
        title: 'Coût historique et prudence',
        text: "Le CGNC repose sur les conventions de coût historique, de continuité d'exploitation, de permanence des méthodes, de spécialisation des exercices, de prudence (prise en compte des pertes latentes) et de non-compensation. Ces conventions créent des divergences structurelles avec les IFRS (juste valeur, valeur recouvrable, non-prudence du référentiel IFRS).",
        keywords: 'coût historique, prudence, conventions, divergences',
      },
      {
        number: 'Comptes 21',
        title: 'Immobilisations en non-valeurs',
        text: "Le CGNC autorise l'inscription de certains frais en non-valeurs (frais de constitution, de prospection, de publicité) à l'actif immobilisé, amortis sur une durée conventionnelle. Les IFRS n'autorisent pas cette pratique pour les frais de constitution (IAS 38).",
        keywords: 'non-valeurs, frais de constitution, actif, IAS 38',
      },
      {
        number: 'Comptes 15',
        title: 'Provisions durables pour risques et charges',
        text: "Le CGNC regroupe au sein des financements permanents (compte 15) des provisions pour risques et charges, sans distinguer systématiquement les obligations présentes des passifs éventuels. IAS 37 impose des critères stricts de comptabilisation.",
        keywords: 'provisions, IAS 37, passifs éventuels',
      },
      {
        number: 'Compte 61',
        title: 'Charges locatives',
        text: "Les redevances de location sont comptabilisées en charges (comptes 61). Aucune distinction n'est faite entre location simple et location-financement, à l'exception de la notion de crédit-bail immobilier. IFRS 16 impose la comptabilisation d'un droit d'utilisation et d'un passif locatif pour le preneur.",
        keywords: 'location, crédit-bail, IFRS 16, droit d’utilisation',
      },
    ],
  },
  {
    code: 'IAS 1',
    title: 'Présentation des états financiers',
    kind: 'IFRS',
    category: 'Présentation',
    status: 'en_vigueur',
    publication_date: '1975-01-01',
    applicable_from: '1975-01-01',
    applicable_note:
      "Applicable aux exercices ouverts avant le 1er janvier 2027. IFRS 18 remplace IAS 1 pour les exercices ouverts à compter du 1er janvier 2027 (application anticipée permise).",
    summary:
      "IAS 1 fixe les bases de présentation des états financiers : image fidèle, continuité d'exploitation, comptabilité d'engagement, importance relative, prééminence du fond sur la forme, continuité de présentation et présentation regroupée. Elle impose la distinction courant / non courant (ou la présentation par ordre de liquidité) et encadre les informations à fournir.",
    source: 'IFRS Foundation — textes officiels (traduction française)',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-1-presentation-of-financial-statements/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Distinction courant / non courant',
        text: "Une entité présente ses actifs et passifs en distinguant les éléments courants des éléments non courants, sauf lorsque la présentation par ordre de liquidité fournit une information plus pertinente (secteur bancaire notamment). Un actif est courant s'il est destiné à être réalisé, consommé ou vendu dans le cycle normal d'exploitation ou dans les douze mois.",
        keywords: 'courant, non courant, 12 mois, cycle d’exploitation',
      },
      {
        number: 'Ref. 2',
        title: 'Équilibre et agrégats normalisés',
        text: "Les états financiers comportent au minimum : un état de la situation financière, un état du résultat et des autres éléments du résultat global, un état des variations des capitaux propres, un tableau des flux de trésorerie et des notes. La compensation entre actifs et passifs n'est admise que lorsqu'une norme l'exige ou l'autorise.",
        keywords: 'jeu complet, OCI, variations des capitaux propres, non-compensation',
      },
    ],
  },
  {
    code: 'IFRS 18',
    title: "Présentation et informations à fournir dans les états financiers",
    kind: 'IFRS',
    category: 'Présentation',
    status: 'a_venir',
    publication_date: '2024-04-09',
    applicable_from: '2027-01-01',
    applicable_note:
      "Applicable aux exercices ouverts à compter du 1er janvier 2027. Application anticipée permise. IFRS 18 remplace IAS 1 et introduit des catégories obligatoires dans l'état du résultat (résultat d'exploitation, résultat d'investissement, résultat de financement) ainsi que des agrégats et des informations sur les mesures de performance de la direction.",
    summary:
      "IFRS 18 remplacera IAS 1. Principales nouveautés : trois catégories obligatoires dans l'état du résultat (exploitation, investissement, financement) plus impôt et activités abandonnées ; agrégats nouvellement définis (résultat d'exploitation, résultat avant financement et impôt) ; obligations de regroupement et de désagrégation ; informations sur les mesures de performance de la direction (MPM) ; modifications corrélatives du tableau des flux de trésorerie et de la présentation des charges de personnel.",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-18-presentation-and-disclosure-in-financial-statements/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Catégories de l’état du résultat',
        text: "Les produits et charges sont classés dans trois catégories : exploitation, investissement et financement. Les éléments qui ne relèvent d'aucune de ces catégories (impôt sur le résultat, activités abandonnées) sont présentés séparément. L'objectif est d'améliorer la comparabilité des performances des entités.",
        keywords: 'exploitation, investissement, financement, résultat net',
      },
      {
        number: 'Ref. 2',
        title: 'Agrégats obligatoires',
        text: "Trois agrégats sont définis et doivent être présentés : le résultat d'exploitation, le résultat avant financement et impôt, et le résultat net. Ces agrégats remplacent la pratique de sous-totaux libres d'IAS 1.",
        keywords: 'résultat d’exploitation, agrégats, sous-totaux',
      },
    ],
  },
  {
    code: 'IAS 16',
    title: 'Immobilisations corporelles',
    kind: 'IFRS',
    category: 'Actifs non courants',
    status: 'en_vigueur',
    publication_date: '1982-03-01',
    applicable_from: '1983-01-01',
    applicable_note: 'Applicable à tous les exercices. Aucune dérogation anticipée requise.',
    summary:
      "IAS 16 définit la comptabilisation des immobilisations corporelles : reconnaissance au coût lorsqu'il est probable que des avantages économiques futurs bénéficieront à l'entité et que le coût peut être évalué de manière fiable. L'amortissement est calculé sur la base du coût diminué de la valeur résiduelle, réparti sur la durée d'utilité, selon une méthode traduisant le rythme de consommation des avantages économiques. La valeur résiduelle, la durée d'utilité et la méthode sont revues au moins à chaque date de clôture. Deux modèles d'évaluation sont autorisés après comptabilisation initiale : le modèle du coût et le modèle de la réévaluation. Les composants significatifs d'un actif ayant des durées d'utilité différentes doivent être comptabilisés séparément (approche par composants).",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-16-property-plant-and-equipment/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Amortissement sur la durée d’utilité',
        text: "Le montant amortissable d'un actif (coût moins valeur résiduelle) est réparti de manière systématique sur sa durée d'utilité. La durée d'utilité est appréciée selon l'utilisation prévue par l'entité, les conditions techniques et commerciales, et non selon une durée fiscale ou une pratique sectorielle.",
        keywords: 'durée d’utilité, montant amortissable, valeur résiduelle, dotation',
      },
      {
        number: 'Ref. 2',
        title: 'Révision des estimations à chaque clôture',
        text: "La valeur résiduelle et la durée d'utilité d'un actif sont revues au moins à chaque date de clôture. Toute modification est traitée comme un changement d'estimation comptable, appliqué prospectivement.",
        keywords: 'changement d’estimation, révision, prospectif, clôture',
      },
      {
        number: 'Ref. 3',
        title: 'Modèles d’évaluation ultérieure',
        text: "Après comptabilisation initiale, l'entité applique soit le modèle du coût (coût moins amortissements et pertes de valeur cumulés), soit le modèle de la réévaluation (juste valeur à la date de réévaluation, l'écart étant comptabilisé en OCI pour les actifs non financiers).",
        keywords: 'modèle du coût, réévaluation, juste valeur, OCI',
      },
      {
        number: 'Ref. 4',
        title: 'Approche par composants',
        text: "Chaque partie d'une immobilisation corporelle dont le coût est significatif par rapport au coût total est amortie séparément, en fonction de sa propre durée d'utilité (ex. toiture, installations, moteur, structure).",
        keywords: 'composants, durée d’utilité distincte, toiture, structure',
      },
    ],
  },
  {
    code: 'IAS 38',
    title: 'Immobilisations incorporelles',
    kind: 'IFRS',
    category: 'Actifs non courants',
    status: 'en_vigueur',
    publication_date: '1978-07-01',
    applicable_from: '1979-01-01',
    applicable_note: 'Applicable à tous les exercices.',
    summary:
      "IAS 38 traite des actifs incorporels identifiables non monétaires sans substance physique. Un actif incorporel est comptabilisé au coût si l'entité en tirera des avantages économiques futurs et si le coût peut être évalué de manière fiable. Sont notamment interdites à l'actif : les frais de constitution, les dépenses de formation, de publicité ou de prospection, les frais de recherche. Les dépenses de développement sont comptabilisées à l'actif uniquement si l'ensemble des critères de capitalisation est satisfait (faisabilité technique, intention, capacité, probabilité d'avantages économiques, disponibilité de ressources, capacité à évaluer les coûts de manière fiable). Aucun actif incorporel ne peut être comptabilisé en cas de reprise d'une entreprise non identifiable, ni pour les marques créées en interne, les listes de clients ou les frais d'établissement.",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-38-intangible-assets/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Recherche : toujours en charge',
        text: "Aucune dépense de recherche ne peut être comptabilisée à l'actif : les dépenses de recherche sont constatées en charges lorsqu'elles sont encourues. Le CGNC autorise au contraire l'activation de certains frais en non-valeurs ou en immobilisations incorporelles.",
        keywords: 'recherche, charge, activation, non-valeurs',
      },
      {
        number: 'Ref. 2',
        title: 'Développement : critères de capitalisation',
        text: "Une dépense de développement est comptabilisée à l'actif seulement si l'entité démontre : la faisabilité technique, son intention d'achever et d'utiliser ou vendre l'actif, sa capacité à l'utiliser ou le vendre, la probabilité d'avantages économiques futurs, la disponibilité de ressources techniques et financières suffisantes, et la fiabilité de l'évaluation des coûts. Faute de preuve documentée, la dépense reste en charges.",
        keywords: 'développement, faisabilité, critères, capitalisation',
      },
      {
        number: 'Ref. 3',
        title: 'Éléments non comptabilisables',
        text: "Les frais d'établissement et de constitution, les dépenses de formation, de publicité et de prospection, ainsi que les frais de démarrage, ne satisfont pas aux critères de comptabilisation en actif incorporel et sont comptabilisés en charges.",
        keywords: 'frais de constitution, publicité, formation, démarrage, charges',
      },
    ],
  },
  {
    code: 'IFRS 16',
    title: 'Contrats de location',
    kind: 'IFRS',
    category: 'Actifs et passifs',
    status: 'en_vigueur',
    publication_date: '2016-01-13',
    applicable_from: '2019-01-01',
    applicable_note:
      "Applicable aux exercices ouverts à compter du 1er janvier 2019. Exemptions : contrats de location à court terme (≤ 12 mois) et actifs de faible valeur.",
    summary:
      "IFRS 16 supprime la distinction comptable entre location simple et location-financement pour le preneur. À la date de mise en application, le preneur comptabilise un actif au titre du droit d'utilisation et un passif locatif correspondant à la valeur actualisée des paiements locatifs. Le passif est ultérieurement évalué au coût amorti selon la méthode du taux d'intérêt effectif ; l'actif est amorti sur la durée de location (ou la durée d'utilité si le transfert de propriété est probable). Des exemptions facultatives existent pour les locations à court terme et les actifs de faible valeur. Le traitement fiscal peut différer, générant des différences temporaires relevant d'IAS 12.",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-16-leases/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Comptabilisation initiale par le preneur',
        text: "À la date de mise en application, le preneur comptabilise un actif au titre du droit d'utilisation et un passif locatif. Le passif est évalué à la valeur actualisée des paiements locatifs non encore payés, actualisés au taux d'emprunt marginal du preneur lorsque le taux implicite du contrat n'est pas aisément déterminable.",
        keywords: 'droit d’utilisation, passif locatif, taux d’emprunt marginal, actualisation',
      },
      {
        number: 'Ref. 2',
        title: 'Évaluation ultérieure du passif',
        text: "Le passif locatif est évalué au coût amorti : chaque paiement réduit le passif et le montant des intérêts accroît le passif. Les intérêts sont calculés en appliquant le taux d'actualisation au solde du passif. L'actif au titre du droit d'utilisation est amorti selon IAS 16 (ou IAS 38) en principe sur la durée de location.",
        keywords: 'coût amorti, intérêts, amortissement du droit d’utilisation, échéancier',
      },
      {
        number: 'Ref. 3',
        title: 'Exemptions facultatives',
        text: "Le preneur peut choisir de ne pas appliquer la comptabilisation du droit d'utilisation aux contrats de location à court terme (durée ≤ 12 mois sans option d'achat) et aux contrats portant sur des actifs de faible valeur. Le choix doit être appliqué par catégorie d'actifs sous-jacents et mentionné en annexe.",
        keywords: 'court terme, faible valeur, exemption, choix de méthode',
      },
      {
        number: 'Ref. 4',
        title: 'Définition du contrat de location et options',
        text: "Un contrat est un contrat de location s'il confère le droit de contrôler l'utilisation d'un actif identifié pour une période donnée en échange d'une contrepartie. Les options de renouvellement ou d'achat raisonnablement certaines d'être exercées doivent être intégrées à la durée et aux paiements locatifs.",
        keywords: 'actif identifié, contrôle, option de renouvellement, période',
      },
    ],
  },
  {
    code: 'IAS 12',
    title: 'Impôts sur le résultat',
    kind: 'IFRS',
    category: 'Fiscalité',
    status: 'en_vigueur',
    publication_date: '1979-07-01',
    applicable_from: '1981-01-01',
    applicable_note: 'Applicable à tous les exercices.',
    summary:
      "IAS 12 impose la comptabilisation d'impôts différés sur les différences temporelles entre la valeur comptable d'un actif ou passif et sa base fiscale, ainsi que sur les reports en avant de pertes fiscales. Les actifs et passifs d'impôt différé sont évalués aux taux d'impôt attendus pour la période de règlement, sur la base des taux adoptés ou quasi adoptés à la date de clôture. Un actif d'impôt différé n'est comptabilisé que s'il est probable qu'un bénéfice imposable futur sera disponible. Les actifs et passifs d'impôt différé sont compensés au sein d'une même entité fiscale.",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-12-income-taxes/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Différences temporelles',
        text: "Une différence temporelle existe lorsque la valeur comptable d'un actif ou d'un passif diffère de sa base fiscale. Elle génère un passif d'impôt différé si elle est imposable (base fiscale < valeur comptable de l'actif) et un actif d'impôt différé si elle est déductible, sous condition de probabilité de bénéfice imposable futur.",
        keywords: 'différence temporelle, base fiscale, actif d’impôt différé, passif d’impôt différé',
      },
      {
        number: 'Ref. 2',
        title: 'Taux d’impôt et non-actualisation',
        text: "Les impôts différés sont évalués aux taux d'impôt dont l'application est attendue pour l'exercice au cours duquel l'actif sera réalisé ou le passif réglé, sur la base des taux adoptés ou quasi adoptés à la date de clôture. Les impôts différés ne sont pas actualisés.",
        keywords: 'taux d’impôt, taux adopté, non-actualisation, clôture',
      },
      {
        number: 'Ref. 3',
        title: 'Compensation',
        text: "Une entité ne compense les actifs et passifs d'impôt différé que si elle a un droit juridiquement exécutoire de compenser les actifs et passifs d'impôt exigible et si ceux-ci relèvent de la même autorité fiscale et de la même entité imposable.",
        keywords: 'compensation, même autorité fiscale, entité imposable',
      },
    ],
  },
  {
    code: 'IAS 2',
    title: 'Stocks',
    kind: 'IFRS',
    category: 'Actifs courants',
    status: 'en_vigueur',
    publication_date: '1975-10-01',
    applicable_from: '1976-01-01',
    applicable_note: 'Applicable à tous les exercices.',
    summary:
      "Les stocks sont évalués au plus faible du coût et de la valeur nette de réalisation. Le coût comprend les coûts d'acquisition, de transformation et les autres coûts supportés pour amener les stocks à l'endroit et dans l'état voulus ; les frais généraux anormaux, les pertes de stockage et les coûts de sous-activité sont exclus. Les méthodes de valorisation admises sont le coût unitaire, le FIFO et le coût moyen pondéré ; le LIFO est interdit.",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Évaluation au plus faible du coût et de la VNR',
        text: "Les stocks sont évalués au plus faible du coût et de la valeur nette de réalisation. La valeur nette de réalisation est le prix de vente estimé diminué des coûts d'achèvement et de vente estimés. Toute dépréciation constatée ne peut être reprise ultérieurement que par une diminution de la dépréciation déjà comptabilisée.",
        keywords: 'coût, valeur nette de réalisation, dépréciation, reprise',
      },
      {
        number: 'Ref. 2',
        title: 'Méthodes de valorisation',
        text: "Le coût des stocks est déterminé selon la méthode du coût unitaire, du premier entré premier sorti (FIFO) ou du coût moyen pondéré. La méthode du dernier entré premier sorti (LIFO) n'est pas autorisée par les IFRS, alors qu'elle est tolérée fiscalement dans certains référentiels nationaux.",
        keywords: 'FIFO, coût moyen pondéré, LIFO interdit, méthode',
      },
    ],
  },
  {
    code: 'IAS 36',
    title: "Dépréciation d'actifs",
    kind: 'IFRS',
    category: 'Actifs',
    status: 'en_vigueur',
    publication_date: '1998-06-01',
    applicable_from: '1999-07-01',
    applicable_note: 'Applicable à tous les exercices.',
    summary:
      "Un actif ne doit pas être comptabilisé pour une valeur supérieure à sa valeur recouvrable. La valeur recouvrable est le plus élevé de la juste valeur diminuée des coûts de sortie et de la valeur d'utilité. La valeur d'utilité repose sur des projections de flux de trésorerie actualisés. Les tests sont réalisés dès l'apparition d'un indice de perte de valeur (et au moins annuellement pour les actifs à durée d'utilité indéfinie ou non encore en service).",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-36-impairment-of-assets/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Indice de perte de valeur',
        text: "À chaque date de clôture, l'entité recherche tout indice montrant qu'un actif a pu perdre de la valeur (obsolescence, détérioration, marchés, taux d'intérêt, évolution réglementaire). En présence d'un indice, la valeur recouvrable est estimée et une perte de valeur est comptabilisée si la valeur comptable excède la valeur recouvrable.",
        keywords: 'indice, valeur recouvrable, perte de valeur, obsolescence',
      },
      {
        number: 'Ref. 2',
        title: 'Données nécessaires',
        text: "La détermination de la valeur d'utilité exige un taux d'actualisation, un horizon de projections et des flux de trésorerie futurs. En l'absence de ces données fournies ou validées, aucune perte de valeur ne peut être quantifiée : l'application doit alors demander les informations manquantes.",
        keywords: 'taux d’actualisation, flux de trésorerie, projections, informations manquantes',
      },
    ],
  },
  {
    code: 'IAS 37',
    title: 'Provisions, passifs éventuels et actifs éventuels',
    kind: 'IFRS',
    category: 'Passifs',
    status: 'en_vigueur',
    publication_date: '1998-07-01',
    applicable_from: '1999-07-01',
    applicable_note: 'Applicable à tous les exercices.',
    summary:
      "Une provision est comptabilisée lorsque trois conditions sont réunies simultanément : existence d'une obligation actuelle (juridique ou implicite) résultant d'un événement passé, probabilité de sortie de ressources représentatives d'avantages économiques, et estimation fiable du montant. À défaut, il s'agit d'un passif éventuel, mentionné en annexe. Les provisions sont actualisées lorsque l'effet du temps est significatif et revues à chaque clôture.",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-37-provisions-contingent-liabilities-and-contingent-assets/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Critères de comptabilisation',
        text: "Une provision n'est comptabilisée que si l'entité a une obligation actuelle résultant d'un événement passé, s'il est probable qu'une sortie de ressources sera nécessaire pour éteindre l'obligation, et si le montant peut être estimé de façon fiable. Le caractère « probable » s'apprécie en général comme une probabilité supérieure à 50 %.",
        keywords: 'obligation actuelle, probable, estimation fiable, provision',
      },
      {
        number: 'Ref. 2',
        title: 'Passif éventuel',
        text: "Lorsque la probabilité de sortie de ressources est faible ou que le montant ne peut être estimé de façon fiable, aucune provision n'est comptabilisée : l'élément est présenté comme passif éventuel en annexe, sauf si la sortie de ressources est peu probable.",
        keywords: 'passif éventuel, annexe, non comptabilisé',
      },
    ],
  },
  {
    code: 'IFRS 15',
    title: "Produits des activités ordinaires tirés de contrats conclus avec des clients",
    kind: 'IFRS',
    category: 'Produits',
    status: 'en_vigueur',
    publication_date: '2014-05-28',
    applicable_from: '2018-01-01',
    applicable_note: 'Applicable aux exercices ouverts à compter du 1er janvier 2018.',
    summary:
      "IFRS 15 retient un modèle en cinq étapes : identification du contrat, identification des obligations de prestation, détermination du prix de la transaction, allocation du prix aux obligations de prestation, comptabilisation du produit lorsque l'obligation est satisfaite (à un moment donné ou au fil du temps). Le produit est comptabilisé pour un montant reflétant la contrepartie à laquelle l'entité s'attend en échange du transfert de biens ou services.",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Modèle en cinq étapes',
        text: "La comptabilisation du produit suit cinq étapes successives depuis l'identification du contrat jusqu'à la comptabilisation lors de la satisfaction de chaque obligation de prestation. Le CGNC reste fondé sur la notion de livraison/facturation, ce qui peut créer des décalages de reconnaissance.",
        keywords: 'cinq étapes, obligation de prestation, prix de la transaction',
      },
      {
        number: 'Ref. 2',
        title: 'Obligations satisfaites au fil du temps',
        text: "Si le contrôle d'un actif ou d'un service est transféré progressivement, le produit est comptabilisé selon l'avancement des travaux, en utilisant une méthode de mesure fiable du degré d'avancement.",
        keywords: 'avancement, au fil du temps, contrôle transféré, mé thode',
      },
    ],
  },
  {
    code: 'IFRS 9',
    title: 'Instruments financiers',
    kind: 'IFRS',
    category: 'Instruments financiers',
    status: 'en_vigueur',
    publication_date: '2014-07-24',
    applicable_from: '2018-01-01',
    applicable_note: 'Applicable aux exercices ouverts à compter du 1er janvier 2018.',
    summary:
      "IFRS 9 classe les actifs financiers selon le modèle économique de gestion et les caractéristiques des flux contractuels : coût amorti, juste valeur par OCI, ou juste valeur par résultat. Elle introduit un modèle de dépréciation fondé sur les pertes de crédit attendues (ECL) sur trois niveaux selon la dégradation du risque de crédit, remplaçant la logique de perte encourue.",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-9-financial-instruments/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Classement et évaluation',
        text: "Le classement des actifs financiers dépend du modèle économique et des caractéristiques contractuelles des flux (test SPPI). Les instruments de dette peuvent être évalués au coût amorti, à la juste valeur par OCI ou à la juste valeur par résultat.",
        keywords: 'classement, SPPI, coût amorti, juste valeur',
      },
      {
        number: 'Ref. 2',
        title: 'Pertes de crédit attendues',
        text: "La dépréciation est fondée sur les pertes de crédit attendues, estimées sur 12 mois (niveau 1) ou sur la durée de vie de l'instrument lorsque le risque de crédit s'est dégradé significativement (niveaux 2 et 3). Les provisions pour créances douteuses du CGNC constituent un point de divergence majeur.",
        keywords: 'ECL, pertes de crédit attendues, créances douteuses, dépréciation',
      },
    ],
  },
  {
    code: 'IAS 23',
    title: "Coûts d'emprunt",
    kind: 'IFRS',
    category: 'Charges',
    status: 'en_vigueur',
    publication_date: '1984-03-01',
    applicable_from: '1986-01-01',
    applicable_note:
      "Depuis l'exercice 2009, la capitalisation des coûts d'emprunt directement attribuables à un actif qualifié est obligatoire.",
    summary:
      "Les coûts d'emprunt directement attribuables à l'acquisition, la construction ou la production d'un actif qualifié sont incorporés au coût de cet actif. Les autres coûts d'emprunt sont comptabilisés en charges. La capitalisation cesse lorsque l'actif est prêt pour son utilisation prévue.",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-23-borrowing-costs/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Actif qualifié',
        text: "Un actif qualifié est un actif qui exige une longue période de préparation avant d'être utilisable ou vendable. Les coûts d'emprunt directement attribuables sont capitalisés comme partie du coût de l'actif ; les coûts d'emprunt généraux sont répartis au moyen d'un taux de capitalisation.",
        keywords: 'actif qualifié, taux de capitalisation, incorporation au coût',
      },
    ],
  },
  {
    code: 'IFRS 1',
    title: "Première adoption des normes d'information financière internationales",
    kind: 'IFRS',
    category: 'Transition',
    status: 'en_vigueur',
    publication_date: '2003-06-19',
    applicable_from: '2004-01-01',
    applicable_note:
      "Applicable lors de la première application des IFRS, sur les exercices ouverts avant le 1er janvier 2027. Le projet IASB « IFRS 19 / modifications d'IFRS 1 » peut affecter les filiales éligibles à l'information réduite.",
    summary:
      "IFRS 1 organise la transition : établissement d'un bilan d'ouverture IFRS à la date de transition, retraitements rétroactifs, application cohérente des méthodes comptables, exemptions facultatives (regroupements d'entreprises, coût présumé, avantages du personnel, écarts de conversion) et exceptions obligatoires (décomptabilisation, estimations, couverture). Elle exige des rapprochements chiffrés entre le référentiel antérieur (CGNC) et les IFRS sur les capitaux propres et le résultat.",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-1-first-time-adoption-of-international-financial-reporting-standards/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Bilan d’ouverture IFRS',
        text: "Une entité établit un bilan d'ouverture IFRS à la date de transition en appliquant rétrospectivement les IFRS, sous réserve des exemptions facultatives et exceptions obligatoires prévues par IFRS 1.",
        keywords: 'bilan d’ouverture, date de transition, rétroactif, exemptions',
      },
      {
        number: 'Ref. 2',
        title: 'Rapprochements obligatoires',
        text: "Les états financiers de première adoption comprennent des rapprochements chiffrés des capitaux propres et du résultat entre le référentiel antérieur et les IFRS, explicitant les retraitements opérés.",
        keywords: 'rapprochement, capitaux propres, résultat, retraitements',
      },
    ],
  },
  {
    code: 'IAS 7',
    title: 'Tableau des flux de trésorerie',
    kind: 'IFRS',
    category: 'Présentation',
    status: 'en_vigueur',
    publication_date: '1977-10-01',
    applicable_from: '1979-01-01',
    applicable_note: 'Applicable à tous les exercices.',
    summary:
      "Le tableau des flux de trésorerie analyse les variations de trésorerie et équivalents de trésorerie en trois catégories : activités d'exploitation, d'investissement et de financement. La méthode indirecte part du résultat net et retraite les éléments non monétaires et les variations du besoin en fonds de roulement. Sa construction exige les mouvements de trésorerie de la période.",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-7-statement-of-cash-flows/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Trois catégories',
        text: "Les flux sont classés en activités d'exploitation, d'investissement et de financement. La méthode indirecte consiste à ajuster le résultat net des éléments non monétaires et des variations du fonds de roulement. Les intérêts payés et les dividendes peuvent être classés selon une méthode retenue et appliquée de manière permanente.",
        keywords: 'exploitation, investissement, financement, méthode indirecte',
      },
    ],
  },
  {
    code: 'IAS 21',
    title: 'Effets des variations des cours des monnaies étrangères',
    kind: 'IFRS',
    category: 'Conversion',
    status: 'en_vigueur',
    publication_date: '1983-07-01',
    applicable_from: '1985-01-01',
    applicable_note: 'Applicable à tous les exercices.',
    summary:
      "Les transactions en monnaie étrangère sont enregistrées au cours du jour de la transaction. À la clôture, les éléments monétaires sont convertis au cours de clôture, les écarts de change étant comptabilisés en résultat (sauf cas de couverture ou d'écart de conversion du CGNC relevant du compte 37 / 15).",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-21-the-effects-of-changes-in-foreign-exchange-rates/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Éléments monétaires en devise',
        text: "Les éléments monétaires en monnaie étrangère sont convertis au cours de clôture et les écarts de conversion sont comptabilisés en résultat de la période. Le CGNC autorise le report des écarts de conversion en « comptes d'ordre », pratique non conforme aux IFRS.",
        keywords: 'écarts de conversion, cours de clôture, compte d’ordre, résultat',
      },
    ],
  },
  {
    code: 'IAS 19',
    title: 'Avantages du personnel',
    kind: 'IFRS',
    category: 'Passifs sociaux',
    status: 'en_vigueur',
    publication_date: '1983-01-01',
    applicable_from: '1985-01-01',
    applicable_note: 'Applicable à tous les exercices.',
    summary:
      "IAS 19 traite des avantages à court terme, des avantages postérieurs à l'emploi (notamment les régimes à prestations définies), des autres avantages à long terme et des indemnités de fin de contrat. Pour les régimes à prestations définies, la méthode des unités de crédit projetées est utilisée ; l'obligation est actualisée à un taux correspondant à celui des obligations d'entreprises de haute qualité.",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-19-employee-benefits/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Indemnités de fin de carrière (ICD/IFD)',
        text: "Les indemnités de fin de carrière constituent en pratique, au Maroc, un régime à prestations définies. IAS 19 impose d'en estimer la valeur actuarielle par la méthode des unités de crédit projetées et de la comptabiliser comme passif social, alors que le CGNC fonctionne généralement en engagement hors bilan.",
        keywords: 'prestations définies, ICD, actuariat, unités de crédit projetées',
      },
    ],
  },
  {
    code: 'IFRS 3',
    title: "Regroupements d'entreprises",
    kind: 'IFRS',
    category: 'Extension',
    status: 'extension',
    publication_date: '2008-01-10',
    applicable_from: '2009-07-01',
    applicable_note:
      "Fonctionnalité d'extension : nécessite des données de regroupement (juste valeur des actifs et passifs acquis, date d'acquisition, contrepartie transférée). Non intégrée au MVP.",
    summary:
      "IFRS 3 impose la méthode de l'acquisition : identification de l'acquéreur, détermination de la date d'acquisition, comptabilisation des actifs et passifs identifiables à la juste valeur, comptabilisation du goodwill ou du gain d'acquisition. Extensions prévues : IFRS 3 et IFRS 10 nécessitent des données de périmètre et de contrôle qui ne relèvent pas d'une simple conversion des comptes sociaux.",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-3-business-combinations/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Méthode de l’acquisition',
        text: "L'acquéreur comptabilise les actifs et passifs identifiables de l'acquise à leur juste valeur à la date d'acquisition et constate le goodwill comme excédent de la contrepartie transférée. Cette norme suppose la disponibilité d'informations non présentes dans une balance sociale.",
        keywords: 'acquisition, juste valeur, goodwill, périmètre',
      },
    ],
  },
  {
    code: 'IFRS 10',
    title: 'États financiers consolidés',
    kind: 'IFRS',
    category: 'Extension',
    status: 'extension',
    publication_date: '2011-05-12',
    applicable_from: '2013-01-01',
    applicable_note:
      "Fonctionnalité d'extension : la consolidation exige des données sur les entités, le contrôle et le périmètre. Une conversion CGNC→IFRS des comptes sociaux n'est pas une consolidation.",
    summary:
      "IFRS 10 définit le contrôle (pouvoir, exposition aux rendements variables, capacité d'utiliser le pouvoir pour influer sur les rendements) et impose la consolidation des entités contrôlées, avec élimination des opérations intragroupe et unification des méthodes comptables. À ne pas confondre avec une simple conversion de comptes sociaux.",
    source: 'IFRS Foundation — textes officiels',
    source_url: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-10-consolidated-financial-statements/',
    paragraphs: [
      {
        number: 'Ref. 1',
        title: 'Définition du contrôle',
        text: "Un investisseur contrôle une entité lorsqu'il est exposé ou a droit à des rendements variables du fait de son implication et qu'il a la capacité d'influer sur ces rendements par le pouvoir qu'il détient sur l'entité. La consolidation requiert la connaissance du périmètre et des pourcentages de détention.",
        keywords: 'contrôle, périmètre, consolidation, rendements variables',
      },
    ],
  },
];
