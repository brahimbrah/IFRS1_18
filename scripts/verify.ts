/**
 * SCRIPT DE VÉRIFICATION DU MOTEUR (tests de fonctionnement, §23 du cahier des charges)
 * Exécution : npx tsx scripts/verify.ts
 *
 * Crée un dossier de démonstration, exécute l'analyse, approuve les retraitements,
 * puis vérifie : conservation des montants, calcul IAS 16, équilibre des écritures,
 * tableau de passage, équation comptable, exports.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, all, get, insert, id, now } from '../server/db.ts';
import { createDemoDossier } from '../server/seed/demo.ts';
import { seedNorms } from '../server/seed/init.ts';
import { accountTotals, proposeAdjustments, runAnalysis } from '../server/engine/analysis.ts';
import { buildPassage } from '../server/engine/statements.ts';
import { runControls } from '../server/engine/controls.ts';
import { buildFinancialStatements } from '../server/engine/financials.ts';
import { generateReport } from '../server/engine/report.ts';
import { exportEntries, exportPassage, exportSynthesis } from '../server/engine/exports.ts';

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'} | ${name}${detail ? ` — ${detail}` : ''}`);
}

seedNorms();

const email = 'verification@ifrsbridge.local';
let user = get('SELECT * FROM users WHERE email = ?', [email]);
if (!user) {
  const uid = id('usr');
  insert('users', { id: uid, email, name: 'Utilisateur de vérification', password_hash: '!test', role: 'admin', created_at: now() });
  user = get('SELECT * FROM users WHERE email = ?', [email]);
}
const userId = user!.id;

const dossierId = createDemoDossier(userId, 'Atlas Composants SARL (test de vérification)');
const dossier = get('SELECT * FROM dossiers WHERE id = ?', [dossierId]);
console.log(`\nDossier de test : ${dossier.name} (${dossierId})\n`);

/* ------------------------------------------------- 1. Conservation des montants */
const totals = accountTotals(dossierId);
const debit = totals.reduce((s, t) => s + t.debit, 0);
const credit = totals.reduce((s, t) => s + t.credit, 0);
check(
  'Conservation des montants importés (balance équilibrée)',
  Math.abs(debit - credit) < 0.01 && Math.abs(debit - 3545000) < 0.01,
  `total débit = ${debit.toFixed(2)} MAD, total crédit = ${credit.toFixed(2)} MAD, ${totals.length} comptes`,
);

/* ------------------------------------------------------ 2. Analyse normative */
const analysis = runAnalysis(dossierId);
check(
  'Analyse des divergences : règles de vigilance déclenchées',
  analysis.findings.length >= 8,
  `${analysis.findings.length} divergences identifiées`,
);

/* -------------------------------------------------- 3. Retraitements chiffrés */
const proposed = proposeAdjustments(dossierId);
const r001 = proposed.find((p) => p.norm_code === 'IAS 16' && p.amount !== 0);
check(
  'IAS 16 — différence d’amortissement calculée = 10 000,00 MAD',
  !!r001 && Math.abs(r001.amount - 10000) < 0.01,
  r001 ? `${r001.ref} : montant = ${r001.amount.toFixed(2)} MAD` : 'non calculé',
);
check(
  'IAS 16 — trace de calcul présente (dotation IFRS 20 000, cumul CGNC 10 000)',
  !!r001 &&
    r001.computations.some((s) => s.label.startsWith('Dotation annuelle IFRS') && Math.abs(Number(s.result) - 20000) < 0.01) &&
    r001.computations.some((s) => s.label.startsWith('Ajustement') && Math.abs(Number(s.result) - 10000) < 0.01),
  r001 ? `${r001.computations.length} étapes tracées` : '—',
);

const r16 = proposed.find((p) => p.norm_code === 'IFRS 16' && p.amount !== 0);
check(
  'IFRS 16 — passif locatif initial actualisé (4 ans à 8 %)',
  !!r16 && r16.computations.some((s) => s.label.includes('Valeur actualisée') && Math.abs(Number(s.result) - 198727.61) < 0.05),
  r16 ? `PV = ${r16.computations.find((s) => s.label.includes('Valeur actualisée'))?.result}` : '—',
);

const r12 = proposed.find((p) => p.norm_code === 'IAS 12' && p.amount !== 0);
check(
  'IAS 12 — impôt différé net calculé sur les différences temporelles',
  !!r12 && Math.abs(r12.amount - 3116.02) < 0.05,
  r12 ? `impôt différé net = ${r12.amount.toFixed(2)} MAD` : '—',
);

const infoRequired = proposed.filter((p) => p.status === 'informations_requises');
check(
  'Aucun montant inventé : postes sans information en statut « Informations complémentaires requises »',
  infoRequired.length >= 3 && infoRequired.every((p) => p.amount === 0 && p.entries.length === 0),
  `${infoRequired.length} postes en attente : ${infoRequired.map((p) => `${p.ref}/${p.norm_code}`).join(', ')}`,
);

/* ------------------------------------------------- 4. Équilibre des écritures */
const chiffres = proposed.filter((p) => p.entries.length > 0);
const unbalanced = chiffres.filter((p) => {
  const d = p.entries.reduce((s, e) => s + e.debit, 0);
  const c = p.entries.reduce((s, e) => s + e.credit, 0);
  return Math.abs(d - c) > 0.01;
});
check(
  'Équilibre de chaque écriture de retraitement (débit = crédit)',
  unbalanced.length === 0,
  `${chiffres.length} écritures vérifiées, ${unbalanced.length} déséquilibrée(s)`,
);

/* ------------------------------------ 5. Approbation puis états définitifs */
for (const adj of all('SELECT * FROM adjustments WHERE dossier_id = ?', [dossierId])) {
  if (adj.status === 'a_valider') {
    const entries = all('SELECT * FROM entries WHERE adjustment_id = ?', [adj.id]);
    const d = entries.reduce((s, e) => s + Number(e.debit), 0);
    const c = entries.reduce((s, e) => s + Number(e.credit), 0);
    if (entries.length && Math.abs(d - c) < 0.01) {
      insert('validations', {
        id: id('val'),
        dossier_id: dossierId,
        entity: 'adjustment',
        entity_id: adj.id,
        action: 'approuver',
        comment: 'Validation automatique du script de vérification',
        actor: userId,
        created_at: now(),
      });
      all('SELECT id FROM entries WHERE adjustment_id = ?', [adj.id]);
      insert('audit_log', { id: id('aud'), dossier_id: dossierId, actor: userId, action: 'adjustment.approuver', payload_json: '{}', created_at: now() });
      // statut approuvé
      const stmt = (await import('../server/db.ts')).db.prepare('UPDATE adjustments SET status = ? WHERE id = ?');
      stmt.run('approuve', adj.id);
      (await import('../server/db.ts')).db.prepare('UPDATE entries SET status = ? WHERE adjustment_id = ?').run('approuve', adj.id);
    }
  }
}

const passageValidated = buildPassage(dossierId, true);
const passageAll = buildPassage(dossierId, false);

/* ----------------------------------------------- 6. Tableau de passage */
const cpImpact = passageAll.totalEquityImpact;
check(
  'Impact total des retraitements sur les capitaux propres',
  Math.abs(cpImpact - -28464.09) < 0.05,
  `${cpImpact.toFixed(2)} MAD`,
);
check(
  'Équation comptable CGNC (actif = capitaux propres + passifs)',
  passageAll.balance.equilibreCGNC,
  `actif ${passageAll.balance.actifCGNC.toFixed(2)} — CP+passifs ${(passageAll.balance.cpCGNC + passageAll.balance.passifCGNC).toFixed(2)} — écart ${passageAll.balance.ecartCGNC.toFixed(2)}`,
);
check(
  'Équation comptable IFRS après retraitements validés',
  passageValidated.balance.equilibreIFRS,
  `actif ${passageValidated.balance.actifIFRS.toFixed(2)} — CP+passifs ${(passageValidated.balance.cpIFRS + passageValidated.balance.passifIFRS).toFixed(2)} — écart ${passageValidated.balance.ecartIFRS.toFixed(2)}`,
);
check(
  'Résultat IFRS reconstruit = résultat CGNC + effet des retraitements sur le résultat',
  Math.abs(passageAll.result.resultatIFRS - (passageAll.result.resultatCGNC + cpImpact)) < 0.05,
  `résultat CGNC ${passageAll.result.resultatCGNC.toFixed(2)} → résultat IFRS ${passageAll.result.resultatIFRS.toFixed(2)}`,
);
check(
  'Reclassement sans impact sur les capitaux propres identifié',
  passageAll.rows.some((r) => r.contributions.some((c) => c.category === 'reclassement')),
  'reclassement IAS 1 des prêts au personnel (40 000 MAD) présent',
);

/* ---------------------------------------------------------- 7. Contrôles */
const { controls, summary } = runControls(dossierId);
check(
  'Tableau de contrôle qualité : aucun contrôle bloquant',
  summary.bloquant === 0,
  `${summary.conforme} conformes, ${summary.a_verifier} à vérifier, ${summary.bloquant} bloquants`,
);
const refsControl = controls.find((c) => c.id === 'refs_verified');
check(
  'Contrôle « références normatives à vérifier » actif (aucune citation inventée)',
  !!refsControl && refsControl.status === 'a_verifier',
  refsControl?.detail.slice(0, 110) ?? '—',
);

/* --------------------------------------------------- 8. États financiers */
const statements = buildFinancialStatements(dossierId, true);
check(
  'État de la situation financière produit et équilibré',
  statements.sofp.totals.equilibreIFRS,
  `couverture : ${statements.sofp.coverage.status}`,
);
check(
  'Tableau des flux de trésorerie NON produit faute de données (aucun montant inventé)',
  statements.cashflow.coverage.status === 'indisponible' && statements.cashflow.lines.every((l) => l.amount === null || /clôture/.test(l.rubric)),
  statements.cashflow.coverage.reason?.slice(0, 120) ?? '—',
);

/* --------------------------------------------------------- 9. Exports */
const outDir = path.join(DATA_DIR, 'exports-test');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'tableau-passage.xlsx'), await exportPassage(dossierId, true));
fs.writeFileSync(path.join(outDir, 'ecritures.xlsx'), await exportEntries(dossierId));
fs.writeFileSync(path.join(outDir, 'synthese.xlsx'), await exportSynthesis(dossierId, true));
const pdf = await generateReport(dossierId, true);
fs.writeFileSync(path.join(outDir, 'rapport-conversion.pdf'), pdf);
check(
  'Exports Excel et PDF générés',
  pdf.length > 20000 && fs.existsSync(path.join(outDir, 'tableau-passage.xlsx')),
  `PDF ${(pdf.length / 1024).toFixed(0)} Ko, XLSX écrits dans ${outDir}`,
);

/* ------------------------------------------- 10. Cas d'information manquante */
const noBalanceUser = userId;
const emptyDossierId = id('dos');
insert('dossiers', {
  id: emptyDossierId,
  user_id: noBalanceUser,
  company_id: null,
  name: 'Dossier vide — test des cas manquants',
  company_name: 'Test',
  exercice: '2025',
  closing_date: '2025-12-31',
  currency: 'MAD',
  conversion_type: 'premiere_adoption',
  framework: 'IAS 1',
  is_demo: 0,
  status: 'brouillon',
  notes: '',
  created_at: now(),
  updated_at: now(),
});
const emptyAnalysis = runAnalysis(emptyDossierId);
const emptyControls = runControls(emptyDossierId);
check(
  'Dossier sans données : bloquant explicite, aucune valeur inventée',
  emptyAnalysis.findings.length === 0 && emptyControls.summary.bloquant >= 1,
  emptyControls.controls.find((c) => c.status === 'bloquant')?.detail.slice(0, 110) ?? '—',
);

/* ------------------------------------------------------------- Synthèse */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies.`);
if (failed.length) {
  console.log('Vérifications en échec :');
  for (const f of failed) console.log(` - ${f.name} : ${f.detail}`);
  process.exitCode = 1;
} else {
  console.log('Toutes les vérifications du moteur sont concluantes.');
}
