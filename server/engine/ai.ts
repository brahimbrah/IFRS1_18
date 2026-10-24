/**
 * COUCHE IA (OPTIONNELLE) + ASSISTANT DÉTERMINISTE
 * ---------------------------------------------------------------------------
 * - La clé API n'est JAMAIS transmise au navigateur : elle reste en base côté
 *   serveur et n'est utilisée que par ce module.
 * - Aucune donnée n'est envoyée à un modèle externe sans que l'utilisateur l'ait
 *   explicitement autorisé (paramètre `allow_external_ai`).
 * - Le modèle intervient comme analyste : il ne produit jamais de montant
 *   définitif (les calculs sont faits par le moteur déterministe) et il lui est
 *   interdit d'inventer des références de paragraphes.
 * - Sans configuration IA, l'assistant répond à partir des données réelles du
 *   dossier et des extraits normatifs indexés (mode déterministe).
 */
import { all, get } from '../db.ts';
import { normRefs } from './analysis.ts';

export type AiConfig = {
  enabled: boolean;
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  temperature: number;
  allowExternalAi: boolean;
};

export function getAiConfig(userId: string): AiConfig {
  const s = get('SELECT * FROM settings WHERE user_id = ?', [userId]);
  if (!s) {
    return {
      enabled: false,
      provider: 'openai',
      model: '',
      baseUrl: '',
      apiKey: '',
      temperature: 0.1,
      allowExternalAi: false,
    };
  }
  return {
    enabled: Number(s.ai_enabled) === 1,
    provider: String(s.ai_provider || 'openai'),
    model: String(s.ai_model || ''),
    baseUrl: String(s.ai_base_url || ''),
    apiKey: String(s.ai_api_key || ''),
    temperature: Number(s.ai_temperature ?? 0.1),
    allowExternalAi: Number(s.allow_external_ai) === 1,
  };
}

export function aiStatus(cfg: AiConfig) {
  if (!cfg.enabled) return { ready: false, reason: "L'analyse par IA est désactivée dans les paramètres." };
  if (!cfg.apiKey) return { ready: false, reason: 'Aucune clé API enregistrée (Paramètres → Configuration de l’IA).' };
  if (!cfg.model) return { ready: false, reason: 'Aucun modèle sélectionné.' };
  if (!cfg.allowExternalAi)
    return {
      ready: false,
      reason:
        "L'envoi de données à un modèle externe n'a pas été autorisé explicitement. Activez « Autoriser l’envoi de données au modèle externe ».",
    };
  return { ready: true, reason: 'IA configurée et autorisée.' };
}

const SYSTEM_PROMPT = `Tu es un expert-comptable et auditeur spécialisé dans la conversion des comptes sociaux marocains (CGNC) vers les normes IAS/IFRS, et dans l'enseignement de ces normes.

RÈGLES ABSOLUES, SANS EXCEPTION :
1. Ne considère JAMAIS qu'un poste CGNC doit être retraité par défaut. Un retraitement doit être justifié par un examen des conditions de la norme.
2. N'applique JAMAIS une norme IFRS sans avoir vérifié explicitement que ses conditions sont réunies au vu des données fournies.
3. N'invente JAMAIS de durée d'amortissement, de taux d'actualisation, de valeur de marché ou de valeur résiduelle absents des documents fournis.
4. N'invente JAMAIS de numéro de paragraphe IAS/IFRS. Si tu n'as pas la source, écris exactement « Référence à vérifier ».
5. Si une information est indispensable et absente, demande-la explicitement et indique le statut « Informations complémentaires requises ». Ne produis aucun montant dans ce cas.
6. Distingue toujours trois catégories : (a) FAITS fournis dans les documents, (b) HYPOTHÈSES validées par l'utilisateur, (c) CONCLUSIONS d'analyse.
7. Ne produis JAMAIS de calcul arithmétique définitif : les montants définitifs sont calculés par un moteur déterministe. Tu peux expliquer la formule et la vérifier, mais tu ne remplaces pas le moteur.
8. Ne présente jamais un simple retraitement CGNC→IFRS comme une consolidation de groupe (IFRS 10).
9. Réponds en français, de façon structurée, pédagogique, précise et vérifiable.
10. Réponds uniquement avec un objet JSON valide, sans texte autour, lorsque le format JSON est demandé.`;

export type AiResult = {
  ok: boolean;
  configured: boolean;
  provider?: string;
  model?: string;
  error?: string;
  data?: any;
  raw?: string;
};

export async function callLlm(
  cfg: AiConfig,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  jsonMode = false,
): Promise<AiResult> {
  const status = aiStatus(cfg);
  if (!status.ready) {
    return { ok: false, configured: false, error: status.reason };
  }
  const provider = cfg.provider.toLowerCase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    if (provider === 'anthropic') {
      const base = cfg.baseUrl || 'https://api.anthropic.com';
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
      const rest = messages.filter((m) => m.role !== 'system');
      const res = await fetch(`${base.replace(/\/$/, '')}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 4000,
          temperature: cfg.temperature,
          system,
          messages: rest.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        return { ok: false, configured: true, error: `Erreur du fournisseur (${res.status}) : ${truncate(await res.text())}` };
      }
      const json: any = await res.json();
      const text = json?.content?.[0]?.text ?? '';
      return { ok: true, configured: true, provider: 'anthropic', model: cfg.model, raw: text, data: jsonMode ? parseJson(text) : undefined };
    }

    // Fournisseurs compatibles OpenAI (OpenAI, Azure OpenAI, Mistral, Groq, Ollama…)
    const base = cfg.baseUrl || 'https://api.openai.com/v1';
    const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: cfg.temperature,
        messages,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, configured: true, error: `Erreur du fournisseur (${res.status}) : ${truncate(await res.text())}` };
    }
    const json: any = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? '';
    return { ok: true, configured: true, provider: cfg.provider, model: cfg.model, raw: text, data: jsonMode ? parseJson(text) : undefined };
  } catch (e: any) {
    return {
      ok: false,
      configured: true,
      error: `Appel au modèle impossible : ${e?.name === 'AbortError' ? 'délai dépassé' : e?.message || e}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson(text: string): any {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return { parse_error: true, raw: text };
      }
    }
    return { parse_error: true, raw: text };
  }
}

function truncate(s: string, n = 400) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/* -------------------------------------------------- Contexte du dossier */

export type DossierContext = {
  dossier: any;
  adjustments: any[];
  findings: any[];
  totals: { produits: number; charges: number; resultat: number };
};

export function buildContext(dossierId: string): DossierContext {
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [dossierId]);
  const adjustments = all('SELECT * FROM adjustments WHERE dossier_id = ? ORDER BY ref', [dossierId]).map((a) => ({
    ref: a.ref,
    title: a.title,
    poste_cgnc: a.poste_cgnc,
    norm: a.norm_code,
    type: a.type,
    montant: a.amount,
    statut: a.status,
    justification: a.rationale,
    details: safeJson(a.details_json),
    calculs: safeJson(a.computations_json),
    refs: safeJson(a.refs_json),
    manquant: safeJson(a.missing_json),
  }));
  return {
    dossier,
    adjustments,
    findings: [],
    totals: { produits: 0, charges: 0, resultat: 0 },
  };
}

function safeJson(s: any) {
  try {
    return JSON.parse(s || 'null');
  } catch {
    return null;
  }
}

export function serializeContext(ctx: DossierContext, maxAdjustments = 12) {
  const d = ctx.dossier;
  const lines: string[] = [];
  lines.push(`Dossier : ${d?.name} — entreprise ${d?.company_name}`);
  lines.push(`Exercice : ${d?.exercice} — date de clôture : ${d?.closing_date} — devise : ${d?.currency}`);
  lines.push(`Nature : ${d?.conversion_type} — référentiel de présentation : ${d?.framework}`);
  lines.push('');
  lines.push('RETRAITEMENTS IDENTIFIÉS PAR LE MOTEUR DÉTERMINISTE :');
  for (const a of ctx.adjustments.slice(0, maxAdjustments)) {
    lines.push(
      `- ${a.ref} | ${a.norm} | ${a.title} | poste CGNC : ${a.poste_cgnc} | montant : ${a.montant} | statut : ${a.statut}`,
    );
    if (a.justification) lines.push(`  justification : ${truncate(String(a.justification), 500)}`);
    if (Array.isArray(a.manquant) && a.manquant.length) {
      lines.push(`  informations manquantes : ${a.manquant.map((m: any) => m.label).join(' ; ')}`);
    }
    if (Array.isArray(a.calculs) && a.calculs.length) {
      lines.push('  traces de calcul :');
      for (const st of a.calculs.slice(0, 8)) {
        lines.push(`    · ${st.label} = ${st.result} (${st.formula})`);
      }
    }
    if (Array.isArray(a.refs) && a.refs.length) {
      lines.push(
        `  références indexées : ${a.refs
          .map((r: any) => `${r.norm} ${r.number}${r.verified ? ' (vérifiée)' : ' (référence à vérifier)'}`)
          .join(' ; ')}`,
      );
    }
  }
  return lines.join('\n');
}

/* ------------------------------------------------- Analyse assistée par IA */

export async function analyzeDossierWithAi(userId: string, dossierId: string) {
  const cfg = getAiConfig(userId);
  const ctx = buildContext(dossierId);
  const status = aiStatus(cfg);
  if (!status.ready) {
    return { ok: false, configured: false, error: status.reason, data: null };
  }
  const norms = all('SELECT code, title, applicable_from, applicable_note FROM norms').map(
    (n) => `${n.code} — ${n.title} (applicable à partir de : ${n.applicable_from || 'n/a'})`,
  );
  const prompt = `Voici les données d'un dossier de conversion CGNC → IFRS.

${serializeContext(ctx)}

NORMES DISPONIBLES DANS LA BIBLIOTHÈQUE (utilise EXCLUSIVEMENT ces codes) :
${norms.join('\n')}

TÂCHE : pour chaque retraitement identifié ci-dessus, produis une analyse d'expert.
Réponds STRICTEMENT au format JSON suivant :
{
  "synthese": "synthèse en 3 à 6 phrases",
  "analyses": [
    {
      "ref": "R001",
      "norme": "IAS 16",
      "conditions_verifiees": ["condition 1", "condition 2"],
      "faits_fournis": ["..."],
      "hypotheses_validees": ["..."],
      "conclusions": ["..."],
      "divergence_cgnc_ifrs": "...",
      "explication_pedagogique": "...",
      "references": [{"norme": "IAS 16", "paragraphe": "Référence à vérifier", "principe": "..."}],
      "informations_manquantes": ["..."],
      "risques": ["..."]
    }
  ],
  "points_de_vigilance": ["..."],
  "informations_manquantes_globales": ["..."]
}
Rappel : n'invente aucun numéro de paragraphe. Si tu n'as pas la source, écris exactement « Référence à vérifier ».`;

  const res = await callLlm(
    cfg,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    true,
  );
  if (!res.ok) return { ok: false, configured: true, error: res.error, data: null };
  return { ok: true, configured: true, provider: res.provider, model: res.model, data: res.data, raw: res.raw };
}

/* ------------------------------------------------------ Assistant IFRS (chat) */

export async function askAssistant(userId: string, dossierId: string, question: string) {
  const cfg = getAiConfig(userId);
  const ctx = buildContext(dossierId);
  const status = aiStatus(cfg);
  const grounded = deterministicAnswer(dossierId, question);

  if (!status.ready) {
    return {
      ok: true,
      mode: 'deterministe',
      configured: false,
      reason: status.reason,
      answer: grounded.answer,
      refs: grounded.refs,
      usedData: grounded.usedData,
    };
  }

  const prompt = `DONNÉES RÉELLES DU DOSSIER ACTIF (source de vérité) :
${serializeContext(ctx)}

QUESTION DE L'UTILISATEUR :
${question}

CONSIGNE : réponds de façon pédagogique et structurée (titres courts, listes). Appuie-toi uniquement sur les données du dossier ci-dessus et sur les normes citées. Distingue les faits, les hypothèses validées et tes conclusions. Si une information manque, demande-la. Termine par un bloc « Sources » listant les normes et paragraphes utilisés, ou « Référence à vérifier » si tu n'as pas la source.`;

  const res = await callLlm(cfg, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]);
  if (!res.ok) {
    return {
      ok: true,
      mode: 'deterministe',
      configured: true,
      reason: `Le modèle n'a pas pu être interrogé (${res.error}). Réponse produite par le moteur déterministe.`,
      answer: grounded.answer,
      refs: grounded.refs,
      usedData: grounded.usedData,
    };
  }
  return {
    ok: true,
    mode: 'ia',
    configured: true,
    provider: res.provider,
    model: res.model,
    answer: res.raw,
    refs: grounded.refs,
    usedData: grounded.usedData,
  };
}

/**
 * Réponse déterministe : construite uniquement à partir des données du dossier
 * et des extraits normatifs indexés. Ne fabrique aucune référence.
 */
export function deterministicAnswer(dossierId: string, question: string) {
  const ctx = buildContext(dossierId);
  const q = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const usedData: string[] = [];
  const refs: any[] = [];

  const score = (a: any) => {
    let s = 0;
    const hay = `${a.ref} ${a.title} ${a.poste_cgnc} ${a.norm} ${a.justification}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    for (const token of q.split(/[^a-z0-9]+/).filter((t) => t.length > 3)) {
      if (hay.includes(token)) s += 1;
    }
    return s;
  };

  const ranked = [...ctx.adjustments]
    .map((a) => ({ a, s: score(a) }))
    .sort((x, y) => y.s - x.s);
  const best = ranked[0];

  if (!best || best.s === 0) {
    const lines: string[] = [];
    lines.push("**Assistant IFRS — réponse fondée sur le dossier actif**");
    lines.push('');
    lines.push(
      `Je n'ai pas identifié de retraitement directement lié à votre question dans le dossier « ${ctx.dossier?.name ?? ''} ».`,
    );
    lines.push('');
    lines.push('Retraitements actuellement présents dans le dossier :');
    if (ctx.adjustments.length === 0) {
      lines.push('- Aucun retraitement généré. Lancez l’analyse intelligente puis la génération des retraitements.');
    } else {
      for (const a of ctx.adjustments) {
        lines.push(`- **${a.ref}** — ${a.norm} — ${a.title} (montant : ${a.montant} ${ctx.dossier?.currency ?? 'MAD'}, statut : ${a.statut})`);
      }
    }
    lines.push('');
    lines.push(
      "Reformulez votre question en citant un poste, une référence de retraitement (ex. R001) ou une norme (ex. IAS 16, IFRS 16, IAS 12).",
    );
    return { answer: lines.join('\n'), refs, usedData };
  }

  const a = best.a;
  usedData.push(`Retraitement ${a.ref} (${a.norm}) — montant ${a.montant}`);
  const lines: string[] = [];
  lines.push(`### ${a.ref} — ${a.title}`);
  lines.push('');
  lines.push(`**Norme mobilisée :** ${a.norm} · **Type :** ${a.type} · **Statut :** ${a.statut}`);
  lines.push('');
  lines.push('**A. Situation initiale en CGNC**');
  lines.push(`- Poste : ${a.poste_cgnc}`);
  if (a.details && typeof a.details === 'object') {
    for (const [k, v] of Object.entries(a.details)) {
      if (['impacts', 'notes', 'rubric_effects', 'pl_effects'].includes(k)) continue;
      if (v === null || v === undefined || v === '') continue;
      lines.push(`- ${k} : ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    }
  }
  lines.push('');
  lines.push('**B. Analyse normative**');
  lines.push(a.justification ? `- ${a.justification}` : '- Justification non renseignée.');
  lines.push('');
  if (Array.isArray(a.calculs) && a.calculs.length) {
    lines.push('**C. Calcul du retraitement (moteur déterministe)**');
    for (const st of a.calculs) {
      lines.push(`- ${st.label} = **${st.result}** ${st.unit ?? ''} — *${st.formula}*`);
    }
    lines.push('');
  }
  const entries = all('SELECT * FROM entries WHERE adjustment_id = ?', [
    get('SELECT id FROM adjustments WHERE dossier_id = ? AND ref = ?', [dossierId, a.ref])?.id,
  ]);
  if (entries.length) {
    lines.push('**D. Écriture comptable proposée**');
    lines.push('| Compte / rubrique | Libellé | Débit | Crédit |');
    lines.push('|---|---|---:|---:|');
    for (const e of entries) {
      lines.push(`| ${e.account_code} | ${e.account_label} | ${Number(e.debit).toFixed(2)} | ${Number(e.credit).toFixed(2)} |`);
    }
    const td = entries.reduce((s, e) => s + Number(e.debit), 0);
    const tc = entries.reduce((s, e) => s + Number(e.credit), 0);
    lines.push(`| **Total** |  | **${td.toFixed(2)}** | **${tc.toFixed(2)}** |`);
    lines.push('');
    lines.push(`Contrôle d'équilibre : ${Math.abs(td - tc) < 0.01 ? '✔ équilibrée' : '✘ déséquilibrée'}`);
    lines.push('');
  }
  if (Array.isArray(a.manquant) && a.manquant.length) {
    lines.push('**Informations complémentaires requises**');
    for (const m of a.manquant) lines.push(`- ${m.label}`);
    lines.push('');
    lines.push(
      "Tant que ces informations ne sont pas fournies, aucun montant ne peut être calculé pour ce poste : le retraitement reste au statut « Informations complémentaires requises ».",
    );
    lines.push('');
  }
  lines.push('**Sources**');
  const normRefList = normRefs(a.norm, 3);
  for (const r of normRefList) {
    refs.push(r);
    lines.push(
      `- ${r.norm} — ${r.title} — § ${r.number} : ${r.text} *(source : ${r.source || 'non renseignée'}${r.verified ? '' : ' — référence à vérifier'})*`,
    );
  }
  return { answer: lines.join('\n'), refs, usedData };
}
