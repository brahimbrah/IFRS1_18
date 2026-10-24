/**
 * MOTEUR DE CALCUL DÉTERMINISTE
 * ---------------------------------------------------------------------------
 * Ce module ne fait AUCUN appel à un modèle de langage. Les calculs arithmétiques
 * des retraitements IFRS sont réalisés ici, de façon reproductible et traçable,
 * afin que l'IA ne puisse jamais produire un montant non vérifiable.
 *
 * Chaque fonction renvoie :
 *   - les résultats numériques,
 *   - une liste de `steps` (traces de calcul : formule, valeurs, résultat),
 *   - les écritures comptables en partie double (toujours équilibrées).
 */

export type CalcStep = {
  label: string;
  formula: string;
  inputs: Record<string, number | string>;
  result: number;
  unit?: string;
};

export type EngineEntry = {
  date: string;
  accountCode: string;
  accountLabel: string;
  label: string;
  debit: number;
  credit: number;
  journal: 'IFRS-RETRAITEMENT';
};

/**
 * Effet d'un retraitement sur une rubrique du bilan IFRS.
 * Invariant obligatoire : Σ(actif) − Σ(passif) − Σ(capitaux propres) = 0
 */
export type RubricEffect = {
  rubric: string;
  group: 'ACTIF_NON_COURANT' | 'ACTIF_COURANT' | 'CAPITAUX_PROPRES' | 'PASSIF_NON_COURANT' | 'PASSIF_COURANT';
  reclassement: number;
  ajustement: number;
};

/** Effet d'un retraitement sur l'état du résultat (montants signés : charge > 0). */
export type PlEffect = {
  rubric: string;
  group: 'CHARGE' | 'PRODUIT' | 'IMPOT';
  amount: number;
};

export type ComputeResult = {
  amount: number;
  direction: 'charge' | 'produit' | 'neutre';
  steps: CalcStep[];
  entries: EngineEntry[];
  impacts: {
    actif: number;
    passif: number;
    capitaux_propres: number;
    resultat: number;
  };
  rubricEffects: RubricEffect[];
  plEffects: PlEffect[];
  notes: string[];
};

/**
 * Contrôle d'équilibre : l'effet sur le bilan et l'effet sur le résultat doivent
 * être cohérents (résultat = variation des capitaux propres hors apports).
 */
export function assertConsistent(
  label: string,
  rubricEffects: RubricEffect[],
  plEffects: PlEffect[],
): void {
  const actif = round2(
    rubricEffects.filter((r) => r.group.startsWith('ACTIF')).reduce((s, r) => s + r.reclassement + r.ajustement, 0),
  );
  const passif = round2(
    rubricEffects.filter((r) => r.group.startsWith('PASSIF')).reduce((s, r) => s + r.reclassement + r.ajustement, 0),
  );
  const cp = round2(
    rubricEffects.filter((r) => r.group === 'CAPITAUX_PROPRES').reduce((s, r) => s + r.reclassement + r.ajustement, 0),
  );
  if (Math.abs(actif - passif - cp) > 0.02) {
    throw new Error(
      `[${label}] Incohérence bilan : actif ${actif} ≠ passif ${passif} + capitaux propres ${cp}`,
    );
  }
  const pl = round2(plEffects.reduce((s, e) => s + e.amount, 0));
  if (Math.abs(pl + cp) > 0.02) {
    throw new Error(
      `[${label}] Incohérence résultat : effet résultat ${-pl} ≠ variation des capitaux propres ${cp}`,
    );
  }
}

export const RUBRIC_RESULT = 'Résultat net de la période (report)';
export const RUBRIC_DEPRECIATION = 'Amortissements cumulés (en déduction des actifs)';
export const RUBRIC_ROU = "Droit d'utilisation (IFRS 16) — valeur brute";
export const RUBRIC_ROU_ACCUM = "Amortissements cumulés du droit d'utilisation (IFRS 16)";
export const RUBRIC_LEASE_LIABILITY = 'Passif locatif (IFRS 16)';
export const RUBRIC_DTA = 'Impôts différés — actif (IAS 12)';
export const RUBRIC_DTL = 'Impôts différés — passif (IAS 12)';
export const PL_DEPRECIATION = 'Amortissements et dépréciations';
export const PL_INTEREST = "Coût de l'endettement financier";
export const PL_RENT = 'Charges locatives (à annuler) / amortissement et intérêts';
export const PL_TAX = 'Charge d’impôt exigible';
export const PL_OTHER = 'Autres charges non comptabilisables en actif';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function yearsBetween(startISO: string, endISO: string): number {
  const a = new Date(startISO);
  const b = new Date(endISO);
  return (b.getTime() - a.getTime()) / (365.25 * 24 * 3600 * 1000);
}

/**
 * Nombre de mois entiers de service écoulés entre la mise en service et la
 * clôture, en comptant le mois de mise en service (convention de prorata
 * mensuel utilisée par le moteur pour les amortissements).
 */
export function monthsOfService(startISO: string, endISO: string): number {
  const m = monthsBetween(startISO, endISO);
  if (m < 0) return 0;
  return m + 1;
}

export function monthsBetween(startISO: string, endISO: string): number {
  const a = new Date(startISO);
  const b = new Date(endISO);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function checkBalanced(entries: EngineEntry[]) {
  const debit = round2(entries.reduce((s, e) => s + e.debit, 0));
  const credit = round2(entries.reduce((s, e) => s + e.credit, 0));
  if (Math.abs(debit - credit) > 0.01) {
    throw new Error(
      `Écriture déséquilibrée dans le moteur de calcul : débit ${debit} ≠ crédit ${credit}`,
    );
  }
}

/* ==========================================================================
 * IAS 16 — IMMOBILISATIONS CORPORELLES
 * ==========================================================================
 * Comparaison entre l'amortissement cumulé CGNC (durée fiscale) et
 * l'amortissement cumulé IFRS (durée d'utilité économique documentée).
 */
export type Ias16Input = {
  assetLabel: string;
  accountCode: string;
  cost: number;
  inServiceDate: string;
  closingDate: string;
  usefulLifeYears: number;
  residualValue: number;
  method: 'lineaire' | 'degressif';
  cgncUsefulLifeYears?: number;
  cgncAccumulated: number;
  cgncCurrentYearCharge?: number;
  components?: { label: string; cost: number; usefulLifeYears: number }[];
};

export function computeIas16(input: Ias16Input): ComputeResult {
  const steps: CalcStep[] = [];
  const notes: string[] = [];

  const elapsed = Math.max(0, monthsOfService(input.inServiceDate, input.closingDate) / 12);

  steps.push({
    label: 'Durée écoulée depuis la mise en service (mois entiers de service / 12)',
    formula: '(mois de service écoulés, mois de mise en service inclus) / 12',
    inputs: {
      date_mise_en_service: input.inServiceDate,
      date_cloture: input.closingDate,
      mois_de_service: monthsOfService(input.inServiceDate, input.closingDate),
    },
    result: Math.round(elapsed * 10000) / 10000,
    unit: 'années',
  });

  const depreciable = round2(input.cost - input.residualValue);
  steps.push({
    label: 'Montant amortissable IFRS (base)',
    formula: 'coût d’acquisition − valeur résiduelle',
    inputs: { cout: input.cost, valeur_residuelle: input.residualValue },
    result: depreciable,
    unit: 'MAD',
  });

  let annual = 0;
  if (input.method === 'degressif') {
    // Taux dégressif : 2 × taux linéaire appliqué à la valeur nette comptable d'ouverture.
    const rate = 2 / Math.max(input.usefulLifeYears, 1);
    annual = round2(depreciable * rate);
    notes.push(
      "La méthode dégressive IFRS retenue est le double du taux linéaire, appliqué à la valeur nette comptable d'ouverture de chaque période.",
    );
  } else {
    annual = round2(depreciable / Math.max(input.usefulLifeYears, 1));
  }

  steps.push({
    label: 'Dotation annuelle IFRS',
    formula:
      input.method === 'degressif'
        ? 'montant amortissable × (2 / durée d’utilité)'
        : 'montant amortissable / durée d’utilité IFRS',
    inputs: {
      montant_amortissable: depreciable,
      duree_utilite_ifrs: input.usefulLifeYears,
    },
    result: annual,
    unit: 'MAD/an',
  });

  const cappedElapsed = Math.min(elapsed, input.usefulLifeYears);
  const ifrsCumulative = round2(Math.min(depreciable, annual * cappedElapsed));
  steps.push({
    label: 'Amortissement cumulé IFRS à la clôture',
    formula: 'dotation annuelle IFRS × durée écoulée (plafonnée au montant amortissable)',
    inputs: { dotation_annuelle: annual, duree_ecoulee: Math.round(cappedElapsed * 10000) / 10000 },
    result: ifrsCumulative,
    unit: 'MAD',
  });

  const adjustment = round2(ifrsCumulative - input.cgncAccumulated);
  steps.push({
    label: 'Ajustement de retraitement IAS 16',
    formula: 'amortissement cumulé IFRS − amortissement cumulé CGNC',
    inputs: { cumul_ifrs: ifrsCumulative, cumul_cgnc: input.cgncAccumulated },
    result: adjustment,
    unit: 'MAD',
  });

  const entries: EngineEntry[] = [];
  const date = input.closingDate;

  if (Math.abs(adjustment) > 0.01) {
    if (adjustment > 0) {
      entries.push({
        date,
        accountCode: 'IFRS-6811',
        accountLabel: 'Dotation complémentaire aux amortissements (retraitement IFRS)',
        label: `Ajustement IAS 16 — ${input.assetLabel} : dotation complémentaire`,
        debit: adjustment,
        credit: 0,
        journal: 'IFRS-RETRAITEMENT',
      });
      entries.push({
        date,
        accountCode: input.accountCode,
        accountLabel: `Amortissements cumulés — ${input.assetLabel}`,
        label: `Ajustement IAS 16 — ${input.assetLabel} : cumul d'amortissement`,
        debit: 0,
        credit: adjustment,
        journal: 'IFRS-RETRAITEMENT',
      });
    } else {
      const reprise = Math.abs(adjustment);
      entries.push({
        date,
        accountCode: input.accountCode,
        accountLabel: `Amortissements cumulés — ${input.assetLabel}`,
        label: `Ajustement IAS 16 — ${input.assetLabel} : reprise d'amortissement excédentaire`,
        debit: reprise,
        credit: 0,
        journal: 'IFRS-RETRAITEMENT',
      });
      entries.push({
        date,
        accountCode: 'IFRS-7811',
        accountLabel: 'Reprise d’amortissement excédentaire (retraitement IFRS)',
        label: `Ajustement IAS 16 — ${input.assetLabel} : reprise de dotation`,
        debit: 0,
        credit: reprise,
        journal: 'IFRS-RETRAITEMENT',
      });
    }
  }

  if (input.cgncUsefulLifeYears) {
    notes.push(
      `Durée retenue en CGNC : ${input.cgncUsefulLifeYears} ans. Durée d'utilité économique retenue en IFRS : ${input.usefulLifeYears} ans, sur justification documentée.`,
    );
  }
  if (input.components?.length) {
    notes.push(
      `Approche par composants appliquée à ${input.components.length} composant(s) : l'amortissement IFRS est calculé composant par composant.`,
    );
  }

  checkBalanced(entries);

  const rubricEffects: RubricEffect[] = [
    { rubric: RUBRIC_DEPRECIATION, group: 'ACTIF_NON_COURANT', reclassement: 0, ajustement: round2(-adjustment) },
    { rubric: RUBRIC_RESULT, group: 'CAPITAUX_PROPRES', reclassement: 0, ajustement: round2(-adjustment) },
  ];
  const plEffects: PlEffect[] = [{ rubric: PL_DEPRECIATION, group: 'CHARGE', amount: adjustment }];
  assertConsistent('IAS 16', rubricEffects, plEffects);

  return {
    amount: adjustment,
    direction: adjustment > 0 ? 'charge' : adjustment < 0 ? 'produit' : 'neutre',
    steps,
    entries,
    impacts: {
      actif: -adjustment,
      passif: 0,
      capitaux_propres: -adjustment,
      resultat: -adjustment,
    },
    rubricEffects,
    plEffects,
    notes,
  };
}

/* ==========================================================================
 * IFRS 16 — CONTRATS DE LOCATION
 * ========================================================================== */
export type Ifrs16Input = {
  contractLabel: string;
  startDate: string;
  closingDate: string;
  termMonths: number;
  paymentAmount: number;
  paymentsPerYear: number;
  paymentTiming: 'debut' | 'fin';
  annualDiscountRate: number;
  exemption: 'aucune' | 'court_terme' | 'faible_valeur';
  initialDirectCosts: number;
  prepaidPayments: number;
  incentives: number;
  cgncRentExpense: number;
  cgncRentAccount: string;
};

export function computeIfrs16(input: Ifrs16Input): ComputeResult {
  const steps: CalcStep[] = [];
  const notes: string[] = [];
  const date = input.closingDate;

  if (input.exemption !== 'aucune') {
    steps.push({
      label: 'Exemption IFRS 16 appliquée',
      formula: 'choix de non-comptabilisation du droit d’utilisation',
      inputs: { exemption: input.exemption },
      result: 0,
      unit: 'MAD',
    });
    notes.push(
      input.exemption === 'court_terme'
        ? "Le preneur retient l'exemption pour les contrats de location à court terme (durée ≤ 12 mois sans option d'achat) : la charge locative est maintenue."
        : "Le preneur retient l'exemption pour les contrats portant sur des actifs de faible valeur : la charge locative est maintenue.",
    );
    return {
      amount: 0,
      direction: 'neutre',
      steps,
      entries: [],
      impacts: { actif: 0, passif: 0, capitaux_propres: 0, resultat: 0 },
      rubricEffects: [],
      plEffects: [],
      notes,
    };
  }

  const periodsPerYear = Math.max(1, Math.round(input.paymentsPerYear));
  const periodMonths = 12 / periodsPerYear;
  const n = Math.max(1, Math.round(input.termMonths / periodMonths));
  const r = input.annualDiscountRate / periodsPerYear;
  const p = input.paymentAmount;

  steps.push({
    label: 'Nombre de périodes de paiement',
    formula: 'durée du contrat (mois) / nombre de mois par période',
    inputs: { duree_mois: input.termMonths, mois_par_periode: periodMonths },
    result: n,
    unit: 'périodes',
  });
  steps.push({
    label: 'Taux d’actualisation par période',
    formula: 'taux annuel / nombre de paiements par an',
    inputs: { taux_annuel: input.annualDiscountRate, paiements_par_an: periodsPerYear },
    result: Math.round(r * 1e6) / 1e6,
    unit: 'taux',
  });

  let pv: number;
  if (r === 0) {
    pv = round2(p * n);
  } else {
    const annuity = (1 - Math.pow(1 + r, -n)) / r;
    pv = round2(input.paymentTiming === 'fin' ? p * annuity : p * annuity * (1 + r));
  }

  steps.push({
    label: 'Valeur actualisée des paiements locatifs (passif locatif à la date de début)',
    formula:
      input.paymentTiming === 'fin'
        ? 'loyer × [1 − (1+r)^−n] / r'
        : 'loyer × [1 − (1+r)^−n] / r × (1+r)',
    inputs: {
      loyer: p,
      taux_periode: Math.round(r * 1e6) / 1e6,
      nb_periodes: n,
      date_debut: input.startDate,
    },
    result: pv,
    unit: 'MAD',
  });

  const rouInitial = round2(pv + input.initialDirectCosts + input.prepaidPayments - input.incentives);
  steps.push({
    label: "Actif au titre du droit d'utilisation — valeur initiale",
    formula:
      'passif locatif initial + dépenses initiales directes + paiements d’avance − avantages incitatifs',
    inputs: {
      passif_initial: pv,
      depenses_directes: input.initialDirectCosts,
      paiements_avance: input.prepaidPayments,
      avantages_incitatifs: input.incentives,
    },
    result: rouInitial,
    unit: 'MAD',
  });

  // Échéancier du passif locatif
  let liability = pv;
  const schedule: { period: number; openingLiability: number; interest: number; payment: number; closingLiability: number }[] = [];
  const monthsElapsed = Math.min(
    input.termMonths,
    Math.max(0, monthsOfService(input.startDate, input.closingDate)),
  );

  for (let k = 1; k <= n; k++) {
    const opening = round2(liability);
    let interest: number;
    let closing: number;
    if (input.paymentTiming === 'debut') {
      const afterPayment = round2(opening - p);
      interest = round2(afterPayment * r);
      closing = round2(afterPayment + interest);
    } else {
      interest = round2(opening * r);
      closing = round2(opening + interest - p);
    }
    schedule.push({
      period: k,
      openingLiability: opening,
      interest,
      payment: k * periodMonths <= monthsElapsed ? p : 0,
      closingLiability: closing,
    });
    liability = closing;
  }

  const completePeriods = Math.min(n, Math.floor(monthsElapsed / periodMonths));
  const fraction = Math.max(0, monthsElapsed / periodMonths - completePeriods);
  const liabilityAtClosing = round2(
    Math.max(
      0,
      completePeriods === 0
        ? pv * (1 + r * fraction)
        : schedule[completePeriods - 1].closingLiability * (1 + r * fraction),
    ),
  );

  steps.push({
    label: 'Passif locatif à la clôture',
    formula:
      'solde après k périodes écoulées, majoré des intérêts courus sur la période en cours',
    inputs: {
      periodes_ecoulees: completePeriods,
      fraction_periode: Math.round(fraction * 10000) / 10000,
      taux_periode: Math.round(r * 1e6) / 1e6,
    },
    result: liabilityAtClosing,
    unit: 'MAD',
  });

  const rouAmortCumulative = round2(rouInitial * Math.min(1, monthsElapsed / input.termMonths));
  const rouNet = round2(rouInitial - rouAmortCumulative);

  const baseForPartial = completePeriods === 0 ? pv : schedule[completePeriods - 1].closingLiability;
  const completeInterest = round2(
    schedule.slice(0, completePeriods).reduce((s, x) => s + x.interest, 0),
  );
  const partialInterest = round2(baseForPartial * r * fraction);
  const currentInterest = round2(completeInterest + partialInterest);

  steps.push({
    label: 'Charge d’intérêt sur le passif locatif pour l’exercice',
    formula: 'Σ intérêts des périodes écoulées + intérêts courus de la période en cours',
    inputs: {
      periodes_ecoulees: completePeriods,
      interets_periodes_ecoulees: completeInterest,
      fraction_periode: Math.round(fraction * 10000) / 10000,
      interets_periode_en_cours: partialInterest,
    },
    result: currentInterest,
    unit: 'MAD',
  });

  steps.push({
    label: "Amortissement cumulé de l'actif au titre du droit d'utilisation",
    formula: "actif initial × (mois écoulés / durée du contrat)",
    inputs: { actif_initial: rouInitial, mois_ecoules: monthsElapsed, duree_contrat_mois: input.termMonths },
    result: rouAmortCumulative,
    unit: 'MAD',
  });
  steps.push({
    label: "Valeur nette comptable de l'actif au titre du droit d'utilisation",
    formula: 'valeur initiale − amortissement cumulé',
    inputs: { valeur_initiale: rouInitial, amortissement_cumule: rouAmortCumulative },
    result: rouNet,
    unit: 'MAD',
  });

  const totalIfrsCharge = round2(rouAmortCumulative + currentInterest);
  steps.push({
    label: 'Charge IFRS totale sur l’exercice (amortissement + intérêts)',
    formula: "amortissement de l'actif + charge d'intérêt sur le passif locatif",
    inputs: { amortissement_actif: rouAmortCumulative, charge_interet: currentInterest },
    result: totalIfrsCharge,
    unit: 'MAD',
  });

  const netImpact = round2(totalIfrsCharge - input.cgncRentExpense);
  steps.push({
    label: 'Impact net sur le résultat de l’exercice',
    formula: 'charge IFRS totale − charge locative CGNC annulée',
    inputs: { charge_ifrs: totalIfrsCharge, charge_locative_cgnc: input.cgncRentExpense },
    result: round2(-netImpact),
    unit: 'MAD',
  });

  const entries: EngineEntry[] = [];
  entries.push({
    date: input.startDate,
    accountCode: 'IFRS-2491',
    accountLabel: "Droit d'utilisation (retraitement IFRS 16)",
    label: `IFRS 16 — ${input.contractLabel} : comptabilisation initiale de l'actif au titre du droit d'utilisation`,
    debit: rouInitial,
    credit: 0,
    journal: 'IFRS-RETRAITEMENT',
  });
  entries.push({
    date: input.startDate,
    accountCode: 'IFRS-1481',
    accountLabel: 'Passif locatif (retraitement IFRS 16)',
    label: `IFRS 16 — ${input.contractLabel} : comptabilisation initiale du passif locatif`,
    debit: 0,
    credit: rouInitial,
    journal: 'IFRS-RETRAITEMENT',
  });
  if (Math.abs(input.cgncRentExpense) > 0.01) {
    entries.push({
      date,
      accountCode: 'IFRS-1481',
      accountLabel: 'Passif locatif (retraitement IFRS 16)',
      label: `IFRS 16 — ${input.contractLabel} : constatation du paiement locatif de l'exercice (réduction du passif)`,
      debit: input.cgncRentExpense,
      credit: 0,
      journal: 'IFRS-RETRAITEMENT',
    });
    entries.push({
      date,
      accountCode: input.cgncRentAccount,
      accountLabel: 'Charges locatives CGNC (annulation)',
      label: `IFRS 16 — ${input.contractLabel} : annulation de la charge locative CGNC`,
      debit: 0,
      credit: input.cgncRentExpense,
      journal: 'IFRS-RETRAITEMENT',
    });
  }
  if (currentInterest > 0.01) {
    entries.push({
      date,
      accountCode: 'IFRS-6611',
      accountLabel: 'Intérêts sur passif locatif (retraitement IFRS 16)',
      label: `IFRS 16 — ${input.contractLabel} : charge d'intérêt sur le passif locatif`,
      debit: currentInterest,
      credit: 0,
      journal: 'IFRS-RETRAITEMENT',
    });
    entries.push({
      date,
      accountCode: 'IFRS-1481',
      accountLabel: 'Passif locatif (retraitement IFRS 16)',
      label: `IFRS 16 — ${input.contractLabel} : intérêts courus sur le passif locatif`,
      debit: 0,
      credit: currentInterest,
      journal: 'IFRS-RETRAITEMENT',
    });
  }
  if (rouAmortCumulative > 0.01) {
    entries.push({
      date,
      accountCode: 'IFRS-6811',
      accountLabel: "Amortissement de l'actif au titre du droit d'utilisation",
      label: `IFRS 16 — ${input.contractLabel} : amortissement du droit d'utilisation`,
      debit: rouAmortCumulative,
      credit: 0,
      journal: 'IFRS-RETRAITEMENT',
    });
    entries.push({
      date,
      accountCode: 'IFRS-2891',
      accountLabel: "Amortissements cumulés — droit d'utilisation",
      label: `IFRS 16 — ${input.contractLabel} : amortissements cumulés du droit d'utilisation`,
      debit: 0,
      credit: rouAmortCumulative,
      journal: 'IFRS-RETRAITEMENT',
    });
  }

  notes.push(
    "Le passif locatif est évalué ultérieurement au coût amorti : les paiements réduisent le passif et les intérêts l'augmentent.",
  );
  if (input.cgncRentExpense !== p) {
    notes.push(
      `La charge locative comptabilisée en CGNC sur l'exercice (${input.cgncRentExpense.toFixed(2)} MAD) est retenue pour l'annulation ; elle doit correspondre au(x) paiement(s) de la période.`,
    );
  }

  checkBalanced(entries);

  const cpEffect = round2(rouNet - liabilityAtClosing);
  const rubricEffects: RubricEffect[] = [
    { rubric: RUBRIC_ROU, group: 'ACTIF_NON_COURANT', reclassement: 0, ajustement: rouInitial },
    {
      rubric: RUBRIC_ROU_ACCUM,
      group: 'ACTIF_NON_COURANT',
      reclassement: 0,
      ajustement: round2(-rouAmortCumulative),
    },
    { rubric: RUBRIC_LEASE_LIABILITY, group: 'PASSIF_NON_COURANT', reclassement: 0, ajustement: liabilityAtClosing },
    { rubric: RUBRIC_RESULT, group: 'CAPITAUX_PROPRES', reclassement: 0, ajustement: cpEffect },
  ];
  const plEffects: PlEffect[] = [
    { rubric: PL_DEPRECIATION, group: 'CHARGE', amount: rouAmortCumulative },
    { rubric: PL_INTEREST, group: 'CHARGE', amount: currentInterest },
    { rubric: PL_RENT, group: 'CHARGE', amount: round2(-input.cgncRentExpense) },
  ];
  assertConsistent('IFRS 16', rubricEffects, plEffects);

  return {
    amount: netImpact,
    direction: netImpact > 0 ? 'charge' : netImpact < 0 ? 'produit' : 'neutre',
    steps,
    entries,
    impacts: {
      actif: rouNet,
      passif: liabilityAtClosing,
      capitaux_propres: cpEffect,
      resultat: cpEffect,
    },
    rubricEffects,
    plEffects,
    notes,
  };
}

/* ==========================================================================
 * IAS 12 — IMPÔTS DIFFÉRÉS
 * ========================================================================== */
export type DeferredItem = {
  label: string;
  origin: string;
  taxableTemporaryDifference: number;
  deductibleTemporaryDifference: number;
};

export type Ias12Input = {
  items: DeferredItem[];
  taxRate: number;
  rateSource: string;
  closingDate: string;
};

export function computeIas12(input: Ias12Input): ComputeResult {
  const steps: CalcStep[] = [];
  const notes: string[] = [];

  let taxable = 0;
  let deductible = 0;
  for (const it of input.items) {
    taxable += it.taxableTemporaryDifference;
    deductible += it.deductibleTemporaryDifference;
  }
  taxable = round2(taxable);
  deductible = round2(deductible);

  steps.push({
    label: 'Total des différences temporelles imposables',
    formula: 'Σ (valeur comptable IFRS − base fiscale) pour les actifs',
    inputs: Object.fromEntries(input.items.map((i) => [i.origin, i.taxableTemporaryDifference])),
    result: taxable,
    unit: 'MAD',
  });
  steps.push({
    label: 'Total des différences temporelles déductibles',
    formula: 'Σ (base fiscale − valeur comptable IFRS) pour les passifs',
    inputs: Object.fromEntries(input.items.map((i) => [i.origin, i.deductibleTemporaryDifference])),
    result: deductible,
    unit: 'MAD',
  });

  const dta = round2(deductible * input.taxRate);
  const dtl = round2(taxable * input.taxRate);
  const net = round2(dta - dtl);

  steps.push({
    label: 'Actif d’impôt différé',
    formula: 'différences déductibles × taux d’impôt',
    inputs: { differences_deductibles: deductible, taux: input.taxRate, source_taux: input.rateSource },
    result: dta,
    unit: 'MAD',
  });
  steps.push({
    label: 'Passif d’impôt différé',
    formula: 'différences imposables × taux d’impôt',
    inputs: { differences_imposables: taxable, taux: input.taxRate, source_taux: input.rateSource },
    result: dtl,
    unit: 'MAD',
  });
  steps.push({
    label: 'Effet net sur la charge d’impôt',
    formula: 'actif d’impôt différé − passif d’impôt différé',
    inputs: { actif_differe: dta, passif_differe: dtl },
    result: net,
    unit: 'MAD',
  });

  const entries: EngineEntry[] = [];
  const date = input.closingDate;
  if (dta > 0.01) {
    entries.push({
      date,
      accountCode: 'IFRS-1540',
      accountLabel: 'Impôts différés — actif (retraitement IAS 12)',
      label: 'IAS 12 — comptabilisation de l’actif d’impôt différé',
      debit: dta,
      credit: 0,
      journal: 'IFRS-RETRAITEMENT',
    });
  }
  if (dtl > 0.01) {
    entries.push({
      date,
      accountCode: 'IFRS-1545',
      accountLabel: 'Impôts différés — passif (retraitement IAS 12)',
      label: 'IAS 12 — comptabilisation du passif d’impôt différé',
      debit: 0,
      credit: dtl,
      journal: 'IFRS-RETRAITEMENT',
    });
  }
  if (Math.abs(net) > 0.01) {
    if (net > 0) {
      entries.push({
        date,
        accountCode: 'IFRS-8611',
        accountLabel: 'Charge d’impôt différé (produit) — retraitement IAS 12',
        label: 'IAS 12 — produit d’impôt différé reconnu en résultat',
        debit: 0,
        credit: net,
        journal: 'IFRS-RETRAITEMENT',
      });
    } else {
      entries.push({
        date,
        accountCode: 'IFRS-8611',
        accountLabel: 'Charge d’impôt différé (charge) — retraitement IAS 12',
        label: 'IAS 12 — charge d’impôt différé reconnue en résultat',
        debit: Math.abs(net),
        credit: 0,
        journal: 'IFRS-RETRAITEMENT',
      });
    }
  }

  notes.push(
    `Taux d'impôt retenu : ${(input.taxRate * 100).toFixed(2)} % — source : ${input.rateSource}. Les impôts différés ne sont pas actualisés (IAS 12).`,
  );
  notes.push(
    "Un actif d'impôt différé n'est comptabilisé que s'il est probable qu'un bénéfice imposable futur sera disponible. La probabilité doit être documentée par l'utilisateur.",
  );
  notes.push(
    "Conformément à IAS 12, les actifs et passifs d'impôt différé relevant de la même autorité fiscale et de la même entité imposable peuvent être compensés. La présentation brute est retenue ici à des fins de transparence.",
  );

  checkBalanced(entries);

  const rubricEffects: RubricEffect[] = [
    { rubric: RUBRIC_DTA, group: 'ACTIF_NON_COURANT', reclassement: 0, ajustement: dta },
    { rubric: RUBRIC_DTL, group: 'PASSIF_NON_COURANT', reclassement: 0, ajustement: dtl },
    { rubric: RUBRIC_RESULT, group: 'CAPITAUX_PROPRES', reclassement: 0, ajustement: net },
  ];
  const plEffects: PlEffect[] = [{ rubric: PL_TAX, group: 'IMPOT', amount: round2(-net) }];
  assertConsistent('IAS 12', rubricEffects, plEffects);

  return {
    amount: net,
    direction: net > 0 ? 'produit' : net < 0 ? 'charge' : 'neutre',
    steps,
    entries,
    impacts: {
      actif: dta,
      passif: dtl,
      capitaux_propres: net,
      resultat: net,
    },
    rubricEffects,
    plEffects,
    notes,
  };
}

/* ==========================================================================
 * IAS 38 — RADIATION DES DÉPENSES NON COMPTABILISABLES
 * ========================================================================== */
export type Ias38Input = {
  label: string;
  grossAccount: string;
  accumulatedAccount: string;
  grossCarryingAmount: number;
  accumulatedAmortization: number;
  closingDate: string;
  reason: 'non_valeurs' | 'recherche' | 'criteres_non_satisfaits';
  chargeAccount?: string;
  /** Rubrique IFRS de l'actif radié (doit correspondre à la rubrique CGNC d'origine). */
  rubric?: string;
  /** Rubrique IFRS des amortissements cumulés rattachés. */
  accumulatedRubric?: string;
};

export function computeIas38WriteOff(input: Ias38Input): ComputeResult {
  const steps: CalcStep[] = [];
  const notes: string[] = [];

  const net = round2(input.grossCarryingAmount - input.accumulatedAmortization);
  steps.push({
    label: 'Valeur nette comptable CGNC à radier',
    formula: 'montant brut − amortissements cumulés',
    inputs: { montant_brut: input.grossCarryingAmount, cumul_amortissements: input.accumulatedAmortization },
    result: net,
    unit: 'MAD',
  });

  const reasonText =
    input.reason === 'non_valeurs'
      ? "Frais d'établissement / non-valeurs : IAS 38 interdit leur comptabilisation en actif incorporel."
      : input.reason === 'recherche'
        ? 'Dépenses de recherche : les frais de recherche sont toujours comptabilisés en charges (IAS 38).'
        : "Critères de capitalisation du développement non documentés : l'activation n'est pas justifiée au regard d'IAS 38.";

  notes.push(reasonText);
  notes.push(
    "Aucun actif d'impôt différé n'est reconnu lorsque l'élément constitue une différence permanente avec la base fiscale. Ce point doit être confirmé avec le traitement fiscal effectif de l'entreprise.",
  );

  const entries: EngineEntry[] = [];
  const charge = input.chargeAccount || 'IFRS-6591';
  if (input.accumulatedAmortization > 0.01) {
    entries.push({
      date: input.closingDate,
      accountCode: input.accumulatedAccount,
      accountLabel: `Amortissements cumulés — ${input.label}`,
      label: `IAS 38 — ${input.label} : sortie des amortissements cumulés`,
      debit: input.accumulatedAmortization,
      credit: 0,
      journal: 'IFRS-RETRAITEMENT',
    });
  }
  if (net > 0.01) {
    entries.push({
      date: input.closingDate,
      accountCode: charge,
      accountLabel: 'Charges non comptabilisables en actif (radiation IAS 38)',
      label: `IAS 38 — ${input.label} : constatation en charges de la valeur nette comptable`,
      debit: net,
      credit: 0,
      journal: 'IFRS-RETRAITEMENT',
    });
  }
  entries.push({
    date: input.closingDate,
    accountCode: input.grossAccount,
    accountLabel: input.label,
    label: `IAS 38 — ${input.label} : sortie du poste d'actif`,
    debit: 0,
    credit: round2(input.grossCarryingAmount),
    journal: 'IFRS-RETRAITEMENT',
  });

  checkBalanced(entries);

  const rubricEffects: RubricEffect[] = [
    {
      rubric: input.rubric || input.label,
      group: 'ACTIF_NON_COURANT',
      reclassement: 0,
      ajustement: round2(-input.grossCarryingAmount),
    },
    {
      rubric: input.accumulatedRubric || RUBRIC_DEPRECIATION,
      group: 'ACTIF_NON_COURANT',
      reclassement: 0,
      ajustement: round2(input.accumulatedAmortization),
    },
    { rubric: RUBRIC_RESULT, group: 'CAPITAUX_PROPRES', reclassement: 0, ajustement: round2(-net) },
  ];
  const plEffects: PlEffect[] = [{ rubric: PL_OTHER, group: 'CHARGE', amount: net }];
  assertConsistent('IAS 38', rubricEffects, plEffects);

  return {
    amount: net,
    direction: 'charge',
    steps,
    entries,
    impacts: { actif: -net, passif: 0, capitaux_propres: -net, resultat: -net },
    rubricEffects,
    plEffects,
    notes,
  };
}

/* ==========================================================================
 * RECLASSEMENT SANS IMPACT SUR LES CAPITAUX PROPRES (IAS 1)
 * ========================================================================== */
export type ReclassInput = {
  label: string;
  accountCode: string;
  amount: number;
  closingDate: string;
  fromRubric: string;
  toRubric: string;
  fromGroup: 'ACTIF_NON_COURANT' | 'ACTIF_COURANT' | 'PASSIF_NON_COURANT' | 'PASSIF_COURANT';
  toGroup: 'ACTIF_NON_COURANT' | 'ACTIF_COURANT' | 'PASSIF_NON_COURANT' | 'PASSIF_COURANT';
  justification: string;
};

export function computeReclassification(input: ReclassInput): ComputeResult {
  const steps: CalcStep[] = [
    {
      label: 'Montant reclassé (sans impact sur les capitaux propres)',
      formula: 'montant du poste CGNC à ventiler selon son échéance économique',
      inputs: { poste: input.label, montant: input.amount },
      result: input.amount,
      unit: 'MAD',
    },
  ];

  const entries: EngineEntry[] = [
    {
      date: input.closingDate,
      accountCode: `IFRS-RE-${input.accountCode}`,
      accountLabel: `Reclassement — ${input.toRubric}`,
      label: `IAS 1 — reclassement de ${input.label} (${input.fromRubric} → ${input.toRubric})`,
      debit: input.amount,
      credit: 0,
      journal: 'IFRS-RETRAITEMENT',
    },
    {
      date: input.closingDate,
      accountCode: `IFRS-RE-${input.accountCode}-C`,
      accountLabel: `Reclassement — ${input.fromRubric}`,
      label: `IAS 1 — reclassement de ${input.label} (contrepartie)`,
      debit: 0,
      credit: input.amount,
      journal: 'IFRS-RETRAITEMENT',
    },
  ];

  checkBalanced(entries);

  const rubricEffects: RubricEffect[] = [
    { rubric: input.fromRubric, group: input.fromGroup, reclassement: round2(-input.amount), ajustement: 0 },
    { rubric: input.toRubric, group: input.toGroup, reclassement: round2(input.amount), ajustement: 0 },
  ];
  assertConsistent('IAS 1 (reclassement)', rubricEffects, []);

  return {
    amount: 0,
    direction: 'neutre',
    steps,
    entries,
    impacts: { actif: 0, passif: 0, capitaux_propres: 0, resultat: 0 },
    rubricEffects,
    plEffects: [],
    notes: [
      `Reclassement de présentation : ${input.fromRubric} → ${input.toRubric}. Aucun impact sur les capitaux propres ni sur le résultat.`,
      input.justification,
    ],
  };
}
