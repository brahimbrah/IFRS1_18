/**
 * CONTRÔLES QUALITÉ OBLIGATOIRES
 * Statuts : « Conforme » | « À vérifier » | « Bloquant »
 */
import { all, get } from '../db.ts';
import { accountTotals, referenceKinds } from './analysis.ts';
import { buildPassage } from './statements.ts';
import { round2 } from './compute.ts';

export type ControlStatus = 'conforme' | 'a_verifier' | 'bloquant';

export type Control = {
  id: string;
  label: string;
  status: ControlStatus;
  detail: string;
  value?: string;
};

export function runControls(dossierId: string): { controls: Control[]; summary: Record<ControlStatus, number> } {
  const controls: Control[] = [];
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [dossierId]);
  const totals = accountTotals(dossierId);
  const kinds = referenceKinds(dossierId);
  const passageValidated = buildPassage(dossierId, true);
  const passageAll = buildPassage(dossierId, false);
  const adjustments = all('SELECT * FROM adjustments WHERE dossier_id = ?', [dossierId]);
  const entries = all('SELECT * FROM entries WHERE dossier_id = ?', [dossierId]);
  const mappings = all("SELECT * FROM mappings WHERE dossier_id = ? AND origin = 'auto'", [dossierId]);

  /* 1. Équilibre comptable des données d'origine */
  const srcDebit = round2(totals.reduce((s, t) => s + t.debit, 0));
  const srcCredit = round2(totals.reduce((s, t) => s + t.credit, 0));
  const balanceCgnc = passageAll.balance.equilibreCGNC;
  if (totals.length === 0) {
    controls.push({
      id: 'src_balance',
      label: "Équilibre comptable des données d'origine",
      status: 'bloquant',
      detail: "Aucune donnée comptable n'a été importée ou saisie : le contrôle ne peut pas être effectué.",
    });
  } else if (balanceCgnc) {
    controls.push({
      id: 'src_balance',
      label: "Équilibre comptable des données d'origine",
      status: 'conforme',
      detail: `Total actif CGNC = ${passageAll.balance.actifCGNC.toFixed(2)} MAD ; capitaux propres + passifs = ${round2(passageAll.balance.cpCGNC + passageAll.balance.passifCGNC).toFixed(2)} MAD.`,
      value: `${passageAll.balance.ecartCGNC.toFixed(2)} MAD`,
    });
  } else {
    controls.push({
      id: 'src_balance',
      label: "Équilibre comptable des données d'origine",
      status: 'bloquant',
      detail: `Écart de ${passageAll.balance.ecartCGNC.toFixed(2)} MAD entre l'actif et les capitaux propres + passifs. Vérifier la balance importée (lignes manquantes ou doublons).`,
      value: `${passageAll.balance.ecartCGNC.toFixed(2)} MAD`,
    });
  }

  /* 2. Cohérence débit / crédit de la source */
  const ecartDC = round2(srcDebit - srcCredit);
  controls.push({
    id: 'src_dc',
    label: 'Cohérence des totaux débit / crédit de la source',
    status: Math.abs(ecartDC) < 0.05 ? 'conforme' : 'a_verifier',
    detail:
      Math.abs(ecartDC) < 0.05
        ? `Total débit = total crédit = ${srcDebit.toFixed(2)} MAD sur la source de référence (${kinds.join(', ') || 'aucune'}).`
        : `Écart débit/crédit de ${ecartDC.toFixed(2)} MAD. Une balance équilibrée présente normalement des totaux égaux ; en l'absence de balance générale, cet écart peut être normal.`,
    value: `${ecartDC.toFixed(2)} MAD`,
  });

  /* 3. Exhaustivité : comptes non affectés */
  const unmapped = mappings.filter((m) => !m.ifrs_group || m.ifrs_group === '');
  controls.push({
    id: 'mapping_complete',
    label: 'Exhaustivité de la correspondance CGNC → IFRS',
    status: unmapped.length === 0 ? 'conforme' : 'a_verifier',
    detail:
      unmapped.length === 0
        ? `Toutes les lignes de la source (${totals.length} comptes) sont affectées à une rubrique IFRS.`
        : `${unmapped.length} compte(s) sans rubrique IFRS : ${unmapped
            .slice(0, 8)
            .map((m) => m.account_code)
            .join(', ')}${unmapped.length > 8 ? '…' : ''}. Une affectation manuelle est requise.`,
    value: `${unmapped.length}`,
  });

  /* 4. Risque de double comptabilisation */
  const kindsPresent = all('SELECT DISTINCT kind FROM documents WHERE dossier_id = ? AND rows > 0', [dossierId]).map(
    (r) => r.kind as string,
  );
  const overlap =
    kindsPresent.includes('balance') && (kindsPresent.includes('bilan') || kindsPresent.includes('cpc'));
  controls.push({
    id: 'no_double_count',
    label: 'Absence de double comptabilisation des sources',
    status: overlap ? 'a_verifier' : 'conforme',
    detail: overlap
      ? "Une balance générale et un bilan/CPC coexistent. Seule la source de référence (priorité : balance > saisie > bilan/CPC > journal) est utilisée pour le tableau de passage : les autres documents ne servent qu'au contrôle."
      : `Source de référence retenue : ${kinds.join(', ') || 'aucune'}. Aucun cumul de documents redondants détecté.`,
    value: kinds.join(', ') || '—',
  });

  /* 5. Cohérence des signes */
  const signIssues = totals.filter((t) => {
    const rule = mappings.find((m) => m.account_code === t.code);
    if (!rule) return false;
    const natural = rule.side as 'debit' | 'credit';
    const actual = t.balance >= 0 ? 'debit' : 'credit';
    return natural !== actual && Math.abs(t.balance) > 0.01;
  });
  controls.push({
    id: 'signs',
    label: 'Cohérence des signes et des montants',
    status: signIssues.length === 0 ? 'conforme' : 'a_verifier',
    detail:
      signIssues.length === 0
        ? 'Tous les soldes sont du côté attendu (débit pour les actifs et charges, crédit pour les passifs, capitaux propres et produits).'
        : `${signIssues.length} compte(s) présentent un solde du côté opposé au solde naturel : ${signIssues
            .slice(0, 8)
            .map((t) => t.code)
            .join(', ')}. Vérifier les comptes débiteurs/créditeurs et les virements de solde.`,
    value: `${signIssues.length}`,
  });

  /* 6. Équilibre de chaque écriture de retraitement */
  const byAdj = new Map<string, { debit: number; credit: number; ref: string }>();
  for (const e of entries) {
    const key = e.adjustment_id || e.ref;
    const cur = byAdj.get(key) ?? { debit: 0, credit: 0, ref: e.ref };
    cur.debit = round2(cur.debit + Number(e.debit || 0));
    cur.credit = round2(cur.credit + Number(e.credit || 0));
    byAdj.set(key, cur);
  }
  const unbalanced = [...byAdj.values()].filter((v) => Math.abs(v.debit - v.credit) > 0.01);
  controls.push({
    id: 'entries_balanced',
    label: 'Équilibre de chaque écriture de retraitement',
    status: byAdj.size === 0 ? 'a_verifier' : unbalanced.length === 0 ? 'conforme' : 'bloquant',
    detail:
      byAdj.size === 0
        ? "Aucune écriture de retraitement générée pour l'instant."
        : unbalanced.length === 0
          ? `Les ${byAdj.size} écriture(s) de retraitement respectent l'égalité total débit = total crédit.`
          : `${unbalanced.length} écriture(s) déséquilibrée(s) : ${unbalanced.map((u) => u.ref).join(', ')}. La validation est bloquée pour ces écritures.`,
    value: `${byAdj.size - unbalanced.length}/${byAdj.size}`,
  });

  /* 7. Disponibilité des informations requises */
  const missingCount = adjustments.filter(
    (a) => a.status === 'informations_requises' || (a.missing_json && a.missing_json !== '[]'),
  ).length;
  controls.push({
    id: 'required_info',
    label: 'Disponibilité des informations requises pour les calculs',
    status: missingCount === 0 ? 'conforme' : 'a_verifier',
    detail:
      missingCount === 0
        ? "Toutes les informations nécessaires aux retraitements identifiés sont disponibles."
        : `${missingCount} retraitement(s) sont en attente d'informations complémentaires : aucun montant n'est calculé pour ces postes.`,
    value: `${missingCount}`,
  });

  /* 8. Existence des sources documentaires */
  const refsWithoutSource = all(
    "SELECT ref, refs_json FROM adjustments WHERE dossier_id = ? AND status <> 'rejete'",
    [dossierId],
  ).filter((a) => {
    try {
      const refs = JSON.parse(a.refs_json || '[]');
      return !Array.isArray(refs) || refs.length === 0 || refs.every((r: any) => !r.source);
    } catch {
      return true;
    }
  });
  controls.push({
    id: 'sources',
    label: 'Existence des sources documentaires des justifications',
    status: refsWithoutSource.length === 0 ? 'conforme' : 'a_verifier',
    detail:
      refsWithoutSource.length === 0
        ? 'Chaque retraitement est rattaché à au moins une source documentaire identifiée.'
        : `${refsWithoutSource.length} retraitement(s) sans source documentaire exploitable (${refsWithoutSource
            .map((r) => r.ref)
            .join(', ')}). Ajouter le texte de référence dans « Référentiel normatif ».`,
    value: `${refsWithoutSource.length}`,
  });

  /* 9. Vérification des paragraphes normatifs */
  const unverified = all(
    "SELECT ref, refs_json FROM adjustments WHERE dossier_id = ? AND status <> 'rejete'",
    [dossierId],
  ).filter((a) => {
    try {
      const refs = JSON.parse(a.refs_json || '[]');
      return Array.isArray(refs) && refs.some((r: any) => r.verified !== true);
    } catch {
      return false;
    }
  });
  controls.push({
    id: 'refs_verified',
    label: 'Vérification des références normatives (numéros de paragraphe)',
    status: unverified.length === 0 ? 'conforme' : 'a_verifier',
    detail:
      unverified.length === 0
        ? 'Les numéros de paragraphe utilisés ont été validés par l’administrateur.'
        : `${unverified.length} retraitement(s) s'appuient sur des références marquées « Référence à vérifier » : valider les paragraphes dans « Référentiel normatif » à partir du texte officiel.`,
    value: `${unverified.length}`,
  });

  /* 10. Période de validité des normes */
  const closing = dossier?.closing_date || '';
  const year = Number(String(closing).slice(0, 4)) || 0;
  const ifrs18Applies = year >= 2027;
  const normsUsed = [...new Set(adjustments.map((a) => a.norm_code as string))];
  const ias1Used = normsUsed.includes('IAS 1');
  let normStatus: ControlStatus = 'conforme';
  let normDetail = `Exercice clos le ${closing}. Normes appliquées : ${normsUsed.join(', ') || 'aucune'}.`;
  if (ifrs18Applies && ias1Used) {
    normStatus = 'a_verifier';
    normDetail = `L'exercice ${year} est ouvert après le 1er janvier 2027 : IFRS 18 se substitue à IAS 1 pour la présentation. Les retraitements fondés sur IAS 1 doivent être revus.`;
  } else if (!ifrs18Applies && ias1Used) {
    normDetail += " IAS 1 est applicable à cet exercice ; IFRS 18 s'appliquera aux exercices ouverts à compter du 1er janvier 2027 (application anticipée permise).";
  }
  controls.push({
    id: 'norm_period',
    label: 'Période de validité des normes retenues',
    status: normStatus,
    detail: normDetail,
  });

  /* 11. Seules les écritures approuvées sont reprises */
  const pending = adjustments.filter((a) => a.status === 'a_valider' || a.status === 'modifie').length;
  controls.push({
    id: 'only_approved',
    label: 'Prise en compte des seules écritures approuvées',
    status: pending === 0 ? 'conforme' : 'a_verifier',
    detail:
      pending === 0
        ? 'Toutes les écritures de retraitement sont validées : les états financiers définitifs reprennent l’intégralité des retraitements.'
        : `${pending} retraitement(s) restent « À valider » : ils sont exclus des états financiers définitifs (contrôle « provisoire » disponible en parallèle).`,
    value: `${pending}`,
  });

  /* 12. Cohérence du bilan IFRS (retraitements validés) */
  const eqIFRS = passageValidated.balance.equilibreIFRS;
  controls.push({
    id: 'ifrs_balance',
    label: 'Cohérence du bilan IFRS (total actif = capitaux propres + passifs)',
    status: eqIFRS ? 'conforme' : 'bloquant',
    detail: eqIFRS
      ? `Total actif IFRS = ${passageValidated.balance.actifIFRS.toFixed(2)} MAD ; capitaux propres + passifs = ${round2(passageValidated.balance.cpIFRS + passageValidated.balance.passifIFRS).toFixed(2)} MAD.`
      : `Écart de ${passageValidated.balance.ecartIFRS.toFixed(2)} MAD après retraitements validés. Vérifier les retraitements non équilibrés.`,
    value: `${passageValidated.balance.ecartIFRS.toFixed(2)} MAD`,
  });

  /* 13. Cohérence résultat / capitaux propres */
  const cp119 = totals.filter((t) => t.code.startsWith('119')).reduce((s, t) => s + (t.credit - t.debit), 0);
  const plNet = round2(passageAll.result.resultatCGNC);
  const hasPl = passageAll.result.detail.length > 0;
  const cpDelta = round2(passageAll.totalEquityImpact - passageAll.result.resultatIFRS + passageAll.result.resultatCGNC);
  controls.push({
    id: 'result_consistency',
    label: 'Cohérence du résultat avec les capitaux propres',
    status: !hasPl ? 'a_verifier' : Math.abs(cpDelta) < 0.05 ? 'conforme' : 'bloquant',
    detail: !hasPl
      ? 'Aucun produit ou charge (classes 6 et 7) n’est présent dans la source : le rapprochement du résultat ne peut pas être contrôlé.'
      : `Résultat CGNC issu du compte de produits et charges : ${plNet.toFixed(2)} MAD ; résultat net de l'exercice porté au bilan : ${round2(cp119).toFixed(2)} MAD. Effet des retraitements sur les capitaux propres : ${passageAll.totalEquityImpact.toFixed(2)} MAD (effet sur le résultat : ${round2(passageAll.result.resultatIFRS - passageAll.result.resultatCGNC).toFixed(2)} MAD).`,
    value: `${Math.abs(cp119 - plNet).toFixed(2)} MAD`,
  });

  const summary: Record<ControlStatus, number> = { conforme: 0, a_verifier: 0, bloquant: 0 };
  for (const c of controls) summary[c.status]++;

  return { controls, summary };
}
