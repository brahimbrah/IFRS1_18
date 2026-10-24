import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROOT,
  UPLOAD_DIR,
  all,
  audit,
  db,
  get,
  id,
  insert,
  now,
  run,
  update,
} from './db.ts';
import { seedNorms } from './seed/init.ts';
import { createDemoDossier, resetDemoDossier } from './seed/demo.ts';
import {
  accountTotals,
  proposeAdjustments,
  proposeMappings,
  runAnalysis,
  saveAdjustments,
  saveMappings,
} from './engine/analysis.ts';
import { buildPassage } from './engine/statements.ts';
import { runControls } from './engine/controls.ts';
import { buildFinancialStatements } from './engine/financials.ts';
import {
  buildExtraction,
  detectFormat,
  extractPdfText,
  matrixFromDelimited,
  matrixFromPdfText,
  parseDelimited,
  readWorkbook,
} from './engine/extract.ts';
import { exportBalance, exportEntries, exportPassage, exportSynthesis } from './engine/exports.ts';
import { generateReport } from './engine/report.ts';
import { analyzeDossierWithAi, askAssistant, aiStatus, getAiConfig } from './engine/ai.ts';
import { round2 } from './engine/compute.ts';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });

app.use(express.json({ limit: '12mb' }));
app.use(cookieParser());

seedNorms();

/* ------------------------------------------------------------------ Auth */

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const derived = crypto.scryptSync(password, parts[1], 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(parts[2], 'hex'));
}

type AuthedRequest = express.Request & { user?: any };

function loadUser(req: AuthedRequest, _res: express.Response, next: express.NextFunction) {
  const token = req.cookies?.ifrs_session;
  if (token) {
    const session = get('SELECT * FROM sessions WHERE token = ?', [token]);
    if (session && new Date(session.expires_at) > new Date()) {
      const user = get('SELECT id, email, name, role FROM users WHERE id = ?', [session.user_id]);
      if (user) req.user = user;
    }
  }
  next();
}
app.use(loadUser);

function requireUser(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentification requise.' });
  next();
}

function guardDossier(req: AuthedRequest, res: express.Response): any | null {
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [req.params.id]);
  if (!dossier) {
    res.status(404).json({ error: 'Dossier introuvable.' });
    return null;
  }
  if (dossier.user_id !== req.user.id) {
    res.status(403).json({ error: "Accès refusé : ce dossier appartient à un autre utilisateur." });
    return null;
  }
  return dossier;
}

const COOKIE = 'ifrs_session';

app.post('/api/auth/register', (req, res) => {
  const { email, name, password } = req.body ?? {};
  if (!email || !name || !password) return res.status(400).json({ error: 'Email, nom et mot de passe requis.' });
  if (String(password).length < 8)
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  if (get('SELECT id FROM users WHERE email = ?', [email]))
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  const userId = id('usr');
  insert('users', {
    id: userId,
    email: String(email).toLowerCase().trim(),
    name,
    password_hash: hashPassword(String(password)),
    role: all('SELECT id FROM users').length === 0 ? 'admin' : 'user',
    created_at: now(),
  });
  insert('settings', {
    user_id: userId,
    ai_enabled: 0,
    ai_provider: 'openai',
    ai_model: '',
    ai_base_url: '',
    ai_api_key: '',
    ai_temperature: 0.1,
    allow_external_ai: 0,
    default_currency: 'MAD',
    default_exercise: String(new Date().getFullYear()),
    updated_at: now(),
  });
  const token = crypto.randomUUID();
  insert('sessions', {
    token,
    user_id: userId,
    created_at: now(),
    expires_at: new Date(Date.now() + 1000 * 3600 * 24 * 30).toISOString(),
  });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax' });
  const user = get('SELECT id, email, name, role FROM users WHERE id = ?', [userId]);
  audit(null, userId, 'register', { email });
  res.json({ user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const user = get('SELECT * FROM users WHERE email = ?', [String(email || '').toLowerCase().trim()]);
  if (!user || !verifyPassword(String(password || ''), String(user.password_hash)))
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  const token = crypto.randomUUID();
  insert('sessions', {
    token,
    user_id: user.id,
    created_at: now(),
    expires_at: new Date(Date.now() + 1000 * 3600 * 24 * 30).toISOString(),
  });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax' });
  audit(null, user.id, 'login', {});
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (token) run('DELETE FROM sessions WHERE token = ?', [token]);
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req: AuthedRequest, res) => {
  res.json({ user: req.user ?? null });
});

/* -------------------------------------------------------------- Settings */

app.get('/api/settings', requireUser, (req: AuthedRequest, res) => {
  const s = get('SELECT * FROM settings WHERE user_id = ?', [req.user.id]);
  const cfg = getAiConfig(req.user.id);
  res.json({
    settings: {
      ai_enabled: Number(s?.ai_enabled ?? 0) === 1,
      ai_provider: s?.ai_provider ?? 'openai',
      ai_model: s?.ai_model ?? '',
      ai_base_url: s?.ai_base_url ?? '',
      ai_api_key_set: !!(s?.ai_api_key),
      ai_api_key_hint: s?.ai_api_key ? `${String(s.ai_api_key).slice(0, 4)}…${String(s.ai_api_key).slice(-4)}` : '',
      ai_temperature: Number(s?.ai_temperature ?? 0.1),
      allow_external_ai: Number(s?.allow_external_ai ?? 0) === 1,
      default_currency: s?.default_currency ?? 'MAD',
      default_exercise: s?.default_exercise ?? '',
    },
    aiStatus: aiStatus(cfg),
    referential: {
      norms: all('SELECT COUNT(*) AS n FROM norms')[0]?.n ?? 0,
      paragraphs: all('SELECT COUNT(*) AS n FROM norm_paragraphs')[0]?.n ?? 0,
    },
  });
});

app.put('/api/settings', requireUser, (req: AuthedRequest, res) => {
  const b = req.body ?? {};
  const existing = get('SELECT * FROM settings WHERE user_id = ?', [req.user.id]);
  const payload: Record<string, any> = {
    ai_enabled: b.ai_enabled ? 1 : 0,
    ai_provider: b.ai_provider ?? existing?.ai_provider ?? 'openai',
    ai_model: b.ai_model ?? existing?.ai_model ?? '',
    ai_base_url: b.ai_base_url ?? existing?.ai_base_url ?? '',
    ai_temperature: typeof b.ai_temperature === 'number' ? b.ai_temperature : Number(existing?.ai_temperature ?? 0.1),
    allow_external_ai: b.allow_external_ai ? 1 : 0,
    default_currency: b.default_currency ?? existing?.default_currency ?? 'MAD',
    default_exercise: b.default_exercise ?? existing?.default_exercise ?? '',
    updated_at: now(),
  };
  // La clé API n'est jamais renvoyée au navigateur ; une chaîne vide la conserve.
  if (typeof b.ai_api_key === 'string' && b.ai_api_key.trim() !== '') payload.ai_api_key = b.ai_api_key.trim();
  if (b.clear_api_key) payload.ai_api_key = '';
  if (existing) update('settings', req.user.id, payload);
  else
    insert('settings', {
      user_id: req.user.id,
      ai_api_key: '',
      ai_model: '',
      ai_base_url: '',
      ai_provider: 'openai',
      ai_enabled: 0,
      ai_temperature: 0.1,
      allow_external_ai: 0,
      default_currency: 'MAD',
      default_exercise: '',
      ...payload,
    });
  audit(null, req.user.id, 'settings.update', { ai_enabled: payload.ai_enabled, allow_external_ai: payload.allow_external_ai });
  res.json({ ok: true });
});

/* -------------------------------------------------------------- Dossiers */

app.get('/api/dossiers', requireUser, (req: AuthedRequest, res) => {
  const rows = all('SELECT * FROM dossiers WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  const enriched = rows.map((d) => {
    const adjustments = all('SELECT status FROM adjustments WHERE dossier_id = ?', [d.id]);
    const docs = all('SELECT COUNT(*) AS n FROM documents WHERE dossier_id = ?', [d.id])[0]?.n ?? 0;
    const lines = all('SELECT COUNT(*) AS n FROM gl_lines WHERE dossier_id = ?', [d.id])[0]?.n ?? 0;
    return {
      ...d,
      documents: docs,
      lines,
      adjustments: adjustments.length,
      approved: adjustments.filter((a) => a.status === 'approuve').length,
      pending: adjustments.filter((a) => a.status === 'a_valider' || a.status === 'modifie').length,
      needsInfo: adjustments.filter((a) => a.status === 'informations_requises').length,
    };
  });
  res.json({ dossiers: enriched });
});

app.post('/api/dossiers', requireUser, (req: AuthedRequest, res) => {
  const b = req.body ?? {};
  if (!b.name || !b.company_name || !b.closing_date)
    return res.status(400).json({ error: 'Nom du dossier, entreprise et date de clôture sont obligatoires.' });
  const dossierId = id('dos');
  const ts = now();
  insert('dossiers', {
    id: dossierId,
    user_id: req.user.id,
    company_id: null,
    name: b.name,
    company_name: b.company_name,
    exercice: b.exercice || String(b.closing_date).slice(0, 4),
    closing_date: b.closing_date,
    currency: b.currency || 'MAD',
    conversion_type: b.conversion_type || 'premiere_adoption',
    framework: b.framework || 'IAS 1',
    is_demo: 0,
    status: 'brouillon',
    notes: b.notes || '',
    created_at: ts,
    updated_at: ts,
  });
  audit(dossierId, req.user.id, 'dossier.create', { name: b.name });
  res.json({ dossier: get('SELECT * FROM dossiers WHERE id = ?', [dossierId]) });
});

app.get('/api/dossiers/:id', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const company = dossier.company_id ? get('SELECT * FROM companies WHERE id = ?', [dossier.company_id]) : null;
  res.json({ dossier, company });
});

app.patch('/api/dossiers/:id', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const allowed = ['name', 'company_name', 'exercice', 'closing_date', 'currency', 'conversion_type', 'framework', 'status', 'notes'];
  const payload: Record<string, any> = { updated_at: now() };
  for (const k of allowed) if (k in (req.body ?? {})) payload[k] = req.body[k];
  update('dossiers', dossier.id, payload);
  audit(dossier.id, req.user.id, 'dossier.update', payload);
  res.json({ dossier: get('SELECT * FROM dossiers WHERE id = ?', [dossier.id]) });
});

app.delete('/api/dossiers/:id', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  for (const t of ['entries', 'adjustments', 'mappings', 'assumptions', 'gl_lines', 'documents', 'statements', 'chat_messages', 'validations']) {
    run(`DELETE FROM ${t} WHERE dossier_id = ?`, [dossier.id]);
  }
  run('DELETE FROM dossiers WHERE id = ?', [dossier.id]);
  const dir = path.join(UPLOAD_DIR, dossier.id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  audit(null, req.user.id, 'dossier.delete', { id: dossier.id, name: dossier.name });
  res.json({ ok: true });
});

app.get('/api/dossiers/:id/audit', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  res.json({ audit: all('SELECT * FROM audit_log WHERE dossier_id = ? ORDER BY created_at DESC LIMIT 200', [dossier.id]) });
});

/* ------------------------------------------------------------ Dashboard */

app.get('/api/dossiers/:id/dashboard', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const adjustments = all('SELECT * FROM adjustments WHERE dossier_id = ?', [dossier.id]);
  const controls = runControls(dossier.id);
  const passage = buildPassage(dossier.id, false);
  const byNorm = new Map<string, { norm: string; impact: number; count: number }>();
  for (const a of adjustments) {
    if (a.status === 'rejete') continue;
    const cur = byNorm.get(a.norm_code) ?? { norm: a.norm_code, impact: 0, count: 0 };
    cur.impact = round2(cur.impact + Number(a.amount || 0));
    cur.count += 1;
    byNorm.set(a.norm_code, cur);
  }
  const missing = adjustments.reduce((s, a) => {
    try {
      return s + (JSON.parse(a.missing_json || '[]') as any[]).length;
    } catch {
      return s;
    }
  }, 0);
  res.json({
    cards: {
      dossiers: all('SELECT COUNT(*) AS n FROM dossiers WHERE user_id = ?', [dossier.user_id])[0]?.n ?? 0,
      documents: all('SELECT COUNT(*) AS n FROM documents WHERE dossier_id = ?', [dossier.id])[0]?.n ?? 0,
      lines: all('SELECT COUNT(*) AS n FROM gl_lines WHERE dossier_id = ?', [dossier.id])[0]?.n ?? 0,
      adjustments: adjustments.length,
      approved: adjustments.filter((a) => a.status === 'approuve').length,
      pending: adjustments.filter((a) => a.status === 'a_valider' || a.status === 'modifie').length,
      needsInfo: adjustments.filter((a) => a.status === 'informations_requises').length,
      missingInfoItems: missing,
      equityImpact: passage.totalEquityImpact,
      normsUsed: byNorm.size,
      controls: controls.summary,
    },
    byNorm: [...byNorm.values()].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
    recentAdjustments: adjustments.slice(0, 8),
  });
});

/* ------------------------------------------------------------ Documents */

app.get('/api/dossiers/:id/documents', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const docs = all('SELECT * FROM documents WHERE dossier_id = ? ORDER BY uploaded_at', [dossier.id]);
  res.json({
    documents: docs.map((d) => ({ ...d, parsed: safeJson(d.parsed_json), columns: safeJson(d.columns_json) })),
    referenceKinds: referenceKindsFor(dossier.id),
  });
});

function safeJson(s: any) {
  try {
    return JSON.parse(s || 'null');
  } catch {
    return null;
  }
}

function referenceKindsFor(dossierId: string): string[] {
  const kinds = new Set(all('SELECT DISTINCT kind FROM documents WHERE dossier_id = ? AND rows > 0', [dossierId]).map((r) => r.kind as string));
  for (const group of [['balance'], ['saisie'], ['bilan', 'cpc'], ['journal']]) {
    if (group.some((k) => kinds.has(k))) return group;
  }
  return [];
}

app.post('/api/dossiers/:id/documents/preview', requireUser, upload.single('file'), async (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'Aucun fichier reçu.' });
  const format = detectFormat(file.originalname, file.mimetype);
  if (format === 'inconnu')
    return res.status(400).json({
      error:
        "Format non pris en charge. Formats acceptés : Excel (.xlsx), CSV (.csv) et PDF texte. Les fichiers Word (.docx) ne sont pas pris en charge dans cette version.",
    });
  if (format === 'docx')
    return res.status(400).json({
      error:
        "L'extraction des fichiers Word n'est pas implémentée dans cette version (fonctionnalité à développer). Fournissez un fichier Excel ou CSV.",
    });

  try {
    let extraction;
    if (format === 'xlsx') {
      const { sheets, matrices } = await readWorkbook(file.buffer);
      if (sheets.length === 0) throw new Error('Classeur sans feuille exploitable.');
      let best: any = null;
      for (const name of sheets) {
        const e = buildExtraction(matrices[name], { format: 'xlsx', sheet: name });
        if (!best || e.meta.coded > best.meta.coded || (e.meta.coded === best.meta.coded && e.rows.length > best.rows.length)) {
          best = e;
        }
      }
      extraction = { ...best, sheets };
    } else if (format === 'csv') {
      const matrix = matrixFromDelimited(parseDelimited(file.buffer.toString('utf8')));
      extraction = buildExtraction(matrix, { format: 'csv' });
    } else {
      const { text, isScanned } = extractPdfText(file.buffer);
      if (isScanned) {
        return res.status(422).json({
          error:
            "Le PDF ne contient pas de texte exploitable (document scanné ou image). L'OCR n'est pas intégré à cette version : la fonctionnalité d'OCR est à développer. Merci de fournir un fichier Excel ou CSV, ou d'utiliser la saisie manuelle.",
        });
      }
      const matrix = matrixFromPdfText(text);
      extraction = buildExtraction(matrix, { format: 'pdf' });
      extraction.warnings.unshift(
        "PDF texte détecté : l'extraction est réalisée à partir du contenu textuel. La mise en page d'origine n'est pas restituée ; vérifiez attentivement la prévisualisation.",
      );
    }

    const token = crypto.randomUUID();
    const tmpDir = path.join(UPLOAD_DIR, '.tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, token), file.buffer);

    audit(dossier.id, req.user.id, 'document.preview', { filename: file.originalname, format, rows: extraction.meta.rows });
    res.json({ token, filename: file.originalname, format, extraction });
  } catch (e: any) {
    res.status(500).json({ error: `Lecture du fichier impossible : ${e?.message || e}` });
  }
});

app.post('/api/dossiers/:id/documents/commit', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const b = req.body ?? {};
  const kind = String(b.kind || '');
  const allowed = ['balance', 'bilan', 'cpc', 'journal', 'immobilisations', 'contrat', 'annexe', 'autre'];
  if (!allowed.includes(kind))
    return res.status(400).json({ error: `Type de document invalide. Valeurs acceptées : ${allowed.join(', ')}.` });
  const rows: any[] = Array.isArray(b.rows) ? b.rows : [];
  if (rows.length === 0) return res.status(400).json({ error: 'Aucune ligne à enregistrer.' });

  const docId = id('doc');
  let storedName = '';
  if (b.token && /^[a-f0-9-]{36}$/i.test(String(b.token))) {
    const tmpPath = path.join(UPLOAD_DIR, '.tmp', String(b.token));
    if (fs.existsSync(tmpPath)) {
      const dir = path.join(UPLOAD_DIR, dossier.id);
      fs.mkdirSync(dir, { recursive: true });
      const ext = path.extname(String(b.filename || '')).slice(0, 10);
      storedName = `${docId}${ext}`;
      fs.renameSync(tmpPath, path.join(dir, storedName));
    }
  }

  const warnings: string[] = Array.isArray(b.warnings) ? b.warnings : [];
  insert('documents', {
    id: docId,
    dossier_id: dossier.id,
    kind,
    filename: String(b.filename || 'document'),
    mime: String(b.mime || ''),
    size: Number(b.size || 0),
    stored_name: storedName,
    status: warnings.length ? 'extrait_avec_reserves' : 'extrait',
    message: warnings.join(' | ').slice(0, 900),
    rows: rows.length,
    columns_json: JSON.stringify(b.columns ?? []),
    parsed_json: JSON.stringify(b.parsed ?? {}),
    uploaded_at: now(),
  });
  rows.forEach((r, i) => {
    insert('gl_lines', {
      id: id('gl'),
      dossier_id: dossier.id,
      document_id: docId,
      account_code: String(r.account_code || '').trim(),
      account_label: String(r.account_label || '').trim(),
      debit: round2(Number(r.debit || 0)),
      credit: round2(Number(r.credit || 0)),
      balance: round2(Number(r.debit || 0) - Number(r.credit || 0)),
      aux: '',
      source: kind,
      raw_json: JSON.stringify({ raw: r.raw ?? [] }),
      sort_order: i,
      created_at: now(),
    });
  });
  run('UPDATE dossiers SET status = ?, updated_at = ? WHERE id = ?', ['donnees_importees', now(), dossier.id]);
  audit(dossier.id, req.user.id, 'document.commit', { kind, filename: b.filename, rows: rows.length, warnings: warnings.length });
  res.json({ document: get('SELECT * FROM documents WHERE id = ?', [docId]) });
});

app.post('/api/dossiers/:id/documents/manual', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const b = req.body ?? {};
  const rows: any[] = Array.isArray(b.rows) ? b.rows : [];
  const cleaned = rows
    .filter((r) => String(r.account_code || '').trim() !== '' || String(r.account_label || '').trim() !== '')
    .map((r) => ({
      account_code: String(r.account_code || '').trim(),
      account_label: String(r.account_label || '').trim(),
      debit: round2(Number(r.debit || 0)),
      credit: round2(Number(r.credit || 0)),
      raw: [],
    }));
  if (cleaned.length === 0) return res.status(400).json({ error: 'Aucune ligne saisie.' });
  const docId = id('doc');
  const totalDebit = round2(cleaned.reduce((s, r) => s + r.debit, 0));
  const totalCredit = round2(cleaned.reduce((s, r) => s + r.credit, 0));
  const warnings: string[] = [];
  if (Math.abs(totalDebit - totalCredit) > 0.05)
    warnings.push(`Saisie déséquilibrée : total débit ${totalDebit.toFixed(2)} ≠ total crédit ${totalCredit.toFixed(2)} (écart ${round2(totalDebit - totalCredit).toFixed(2)} MAD).`);
  const uncoded = cleaned.filter((r) => !r.account_code).length;
  if (uncoded) warnings.push(`${uncoded} ligne(s) sans code de compte : elles ne pourront pas être traitées automatiquement.`);
  insert('documents', {
    id: docId,
    dossier_id: dossier.id,
    kind: 'saisie',
    filename: b.filename || 'Saisie manuelle',
    mime: 'application/x-saisie-manuelle',
    size: 0,
    stored_name: '',
    status: warnings.length ? 'extrait_avec_reserves' : 'extrait',
    message: warnings.join(' | ') || `Saisie manuelle équilibrée : ${totalDebit.toFixed(2)} MAD au débit et au crédit.`,
    rows: cleaned.length,
    columns_json: JSON.stringify(['Compte', 'Libellé', 'Débit', 'Crédit']),
    parsed_json: JSON.stringify({ type: 'saisie', totalDebit, totalCredit }),
    uploaded_at: now(),
  });
  cleaned.forEach((r, i) => {
    insert('gl_lines', {
      id: id('gl'),
      dossier_id: dossier.id,
      document_id: docId,
      account_code: r.account_code,
      account_label: r.account_label,
      debit: r.debit,
      credit: r.credit,
      balance: round2(r.debit - r.credit),
      aux: '',
      source: 'saisie',
      raw_json: '',
      sort_order: i,
      created_at: now(),
    });
  });
  run('UPDATE dossiers SET status = ?, updated_at = ? WHERE id = ?', ['donnees_importees', now(), dossier.id]);
  audit(dossier.id, req.user.id, 'document.manual', { rows: cleaned.length, warnings });
  res.json({ document: get('SELECT * FROM documents WHERE id = ?', [docId]) });
});

app.delete('/api/documents/:docId', requireUser, (req: AuthedRequest, res) => {
  const doc = get('SELECT * FROM documents WHERE id = ?', [req.params.docId]);
  if (!doc) return res.status(404).json({ error: 'Document introuvable.' });
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [doc.dossier_id]);
  if (!dossier || dossier.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  run('DELETE FROM gl_lines WHERE document_id = ?', [doc.id]);
  run('DELETE FROM documents WHERE id = ?', [doc.id]);
  if (doc.stored_name) {
    const p = path.join(UPLOAD_DIR, dossier.id, String(doc.stored_name));
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }
  audit(dossier.id, req.user.id, 'document.delete', { id: doc.id, filename: doc.filename });
  res.json({ ok: true });
});

app.get('/api/documents/:docId/file', requireUser, (req: AuthedRequest, res) => {
  const doc = get('SELECT * FROM documents WHERE id = ?', [req.params.docId]);
  if (!doc) return res.status(404).json({ error: 'Document introuvable.' });
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [doc.dossier_id]);
  if (!dossier || dossier.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  if (!doc.stored_name) return res.status(404).json({ error: 'Aucun fichier stocké pour ce document (document de démonstration ou saisie manuelle).' });
  const p = path.join(UPLOAD_DIR, dossier.id, String(doc.stored_name));
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Fichier absent du stockage.' });
  res.setHeader('Content-Type', doc.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(String(doc.filename))}"`);
  fs.createReadStream(p).pipe(res);
});

/* --------------------------------------------------------- Lignes comptables */

app.get('/api/dossiers/:id/accounts', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const lines = all('SELECT * FROM gl_lines WHERE dossier_id = ? ORDER BY account_code, sort_order', [dossier.id]);
  res.json({
    lines,
    totals: accountTotals(dossier.id),
    referenceKinds: referenceKindsFor(dossier.id),
    documents: all('SELECT id, kind, filename FROM documents WHERE dossier_id = ?', [dossier.id]),
  });
});

app.patch('/api/lines/:lineId', requireUser, (req: AuthedRequest, res) => {
  const line = get('SELECT * FROM gl_lines WHERE id = ?', [req.params.lineId]);
  if (!line) return res.status(404).json({ error: 'Ligne introuvable.' });
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [line.dossier_id]);
  if (!dossier || dossier.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  const b = req.body ?? {};
  const payload: Record<string, any> = {};
  if ('account_code' in b) payload.account_code = String(b.account_code || '').trim();
  if ('account_label' in b) payload.account_label = String(b.account_label || '').trim();
  if ('debit' in b) payload.debit = round2(Number(b.debit || 0));
  if ('credit' in b) payload.credit = round2(Number(b.credit || 0));
  if ('debit' in b || 'credit' in b) {
    payload.balance = round2(Number(payload.debit ?? line.debit) - Number(payload.credit ?? line.credit));
  }
  update('gl_lines', line.id, payload);
  audit(dossier.id, req.user.id, 'line.update', { id: line.id, ...payload });
  res.json({ line: get('SELECT * FROM gl_lines WHERE id = ?', [line.id]) });
});

app.post('/api/dossiers/:id/lines', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const b = req.body ?? {};
  const lineId = id('gl');
  insert('gl_lines', {
    id: lineId,
    dossier_id: dossier.id,
    document_id: b.document_id || null,
    account_code: String(b.account_code || '').trim(),
    account_label: String(b.account_label || '').trim(),
    debit: round2(Number(b.debit || 0)),
    credit: round2(Number(b.credit || 0)),
    balance: round2(Number(b.debit || 0) - Number(b.credit || 0)),
    aux: '',
    source: b.source || 'saisie',
    raw_json: '',
    sort_order: 999,
    created_at: now(),
  });
  audit(dossier.id, req.user.id, 'line.create', { account_code: b.account_code });
  res.json({ line: get('SELECT * FROM gl_lines WHERE id = ?', [lineId]) });
});

app.delete('/api/lines/:lineId', requireUser, (req: AuthedRequest, res) => {
  const line = get('SELECT * FROM gl_lines WHERE id = ?', [req.params.lineId]);
  if (!line) return res.status(404).json({ error: 'Ligne introuvable.' });
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [line.dossier_id]);
  if (!dossier || dossier.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  run('DELETE FROM gl_lines WHERE id = ?', [line.id]);
  audit(dossier.id, req.user.id, 'line.delete', { id: line.id });
  res.json({ ok: true });
});

/* ------------------------------------------------------------- Mappings */

app.get('/api/dossiers/:id/mappings', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const mappings = all('SELECT * FROM mappings WHERE dossier_id = ? ORDER BY account_code', [dossier.id]);
  res.json({ mappings });
});

app.post('/api/dossiers/:id/mappings/refresh', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const proposed = proposeMappings(dossier.id);
  saveMappings(dossier.id, proposed, req.user.id);
  audit(dossier.id, req.user.id, 'mappings.refresh', { count: proposed.length });
  res.json({ mappings: all('SELECT * FROM mappings WHERE dossier_id = ? ORDER BY account_code', [dossier.id]) });
});

app.patch('/api/mappings/:mapId', requireUser, (req: AuthedRequest, res) => {
  const map = get('SELECT * FROM mappings WHERE id = ?', [req.params.mapId]);
  if (!map) return res.status(404).json({ error: 'Correspondance introuvable.' });
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [map.dossier_id]);
  if (!dossier || dossier.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  const b = req.body ?? {};
  const payload: Record<string, any> = { origin: 'manuel', updated_at: now() };
  for (const k of ['ifrs_line', 'ifrs_group', 'nature', 'justification', 'norm_code', 'status']) {
    if (k in b) payload[k] = b[k];
  }
  if (b.justification_manual) payload.justification = String(b.justification_manual);
  update('mappings', map.id, payload);
  audit(dossier.id, req.user.id, 'mapping.update', { id: map.id, ...payload });
  res.json({ mapping: get('SELECT * FROM mappings WHERE id = ?', [map.id]) });
});

/* -------------------------------------------------------------- Analysis */

app.get('/api/dossiers/:id/analysis', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const analysis = runAnalysis(dossier.id);
  const saved = all('SELECT * FROM mappings WHERE dossier_id = ? ORDER BY account_code', [dossier.id]);
  const cfg = getAiConfig(req.user.id);
  res.json({
    findings: analysis.findings,
    proposedMappings: analysis.mappings,
    mappings: saved,
    totals: analysis.totals,
    ai: { status: aiStatus(cfg), lastAnalysis: get("SELECT * FROM audit_log WHERE dossier_id = ? AND action = 'analysis.ai' ORDER BY created_at DESC LIMIT 1", [dossier.id])?.payload_json ?? null },
    referenceKinds: referenceKindsFor(dossier.id),
  });
});

app.post('/api/dossiers/:id/analysis/run', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const analysis = runAnalysis(dossier.id);
  saveMappings(dossier.id, analysis.mappings, req.user.id);
  const proposed = proposeAdjustments(dossier.id);
  const saved = saveAdjustments(dossier.id, proposed);
  run('UPDATE dossiers SET status = ?, updated_at = ? WHERE id = ?', ['analyse', now(), dossier.id]);
  audit(dossier.id, req.user.id, 'analysis.run', { findings: analysis.findings.length, ...saved });
  res.json({
    findings: analysis.findings,
    adjustments: all('SELECT * FROM adjustments WHERE dossier_id = ? ORDER BY ref', [dossier.id]),
    saved,
  });
});

app.post('/api/dossiers/:id/analysis/ai', requireUser, async (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const result = await analyzeDossierWithAi(req.user.id, dossier.id);
  if (result.ok && result.data) {
    // L'analyse IA est stockée séparément : elle ne modifie jamais les montants
    // calculés par le moteur déterministe.
    const analyses = Array.isArray(result.data.analyses) ? result.data.analyses : [];
    for (const a of analyses) {
      const adj = get('SELECT * FROM adjustments WHERE dossier_id = ? AND ref = ?', [dossier.id, a.ref]);
      if (adj) update('adjustments', adj.id, { ai_rationale: JSON.stringify(a), updated_at: now() });
    }
  }
  audit(dossier.id, req.user.id, 'analysis.ai', {
    ok: result.ok,
    configured: result.configured,
    provider: result.provider ?? null,
    model: result.model ?? null,
    error: result.error ?? null,
  });
  res.json(result);
});

/* ---------------------------------------------------------- Assumptions */

app.get('/api/dossiers/:id/assumptions', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  res.json({
    assumptions: all('SELECT * FROM assumptions WHERE dossier_id = ? ORDER BY norm_code, scope, key', [dossier.id]),
    required: requiredFields(),
  });
});

function requiredFields() {
  return {
    'IAS 16': [
      'Date de mise en service',
      "Durée d'utilité estimée en IFRS et justification",
      'Valeur résiduelle estimée',
      "Méthode d'amortissement",
      'Amortissements CGNC déjà enregistrés',
      'Détail des composants (le cas échéant)',
    ],
    'IFRS 16': [
      'Date de début du contrat',
      'Durée de location',
      'Montant et périodicité des loyers',
      "Taux d'actualisation approprié",
      'Options de renouvellement pertinentes',
      'Exemptions éventuelles',
    ],
    'IAS 12': ["Taux d'impôt applicable", 'Source du taux'],
    'IAS 37': [
      "Nature de l'obligation",
      'Probabilité de sortie de ressources',
      'Meilleure estimation du montant',
      "Taux d'actualisation si l'effet du temps est significatif",
    ],
    'IAS 38': ['Nature des dépenses', 'Critères de capitalisation documentés', 'Compte des amortissements cumulés'],
    'IAS 36': ['Indices de perte de valeur', 'Flux de trésorerie prévisionnels', "Taux d'actualisation"],
    'IAS 2': ['Méthode de valorisation', 'Valeur nette de réalisation'],
    'IFRS 9': ['Balance âgée des créances', 'Taux de perte historique'],
    'IAS 1': ['Échéancier des prêts et emprunts', 'Part remboursable à moins de douze mois'],
    'IAS 23': ['Existence d’un actif qualifié', 'Taux de capitalisation'],
    'IAS 19': ['Effectif par ancienneté et salaires', 'Hypothèses actuarielles', "Taux d'actualisation"],
  };
}

app.post('/api/dossiers/:id/assumptions', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const b = req.body ?? {};
  if (!b.norm_code || !b.key) return res.status(400).json({ error: 'Norme et clé sont obligatoires.' });
  const scope = String(b.scope || '');
  const existing = get('SELECT * FROM assumptions WHERE dossier_id = ? AND norm_code = ? AND scope = ? AND key = ?', [
    dossier.id,
    b.norm_code,
    scope,
    b.key,
  ]);
  const payload = {
    dossier_id: dossier.id,
    norm_code: String(b.norm_code),
    scope,
    key: String(b.key),
    label: String(b.label || b.key),
    value: b.value === undefined || b.value === null ? '' : String(b.value),
    unit: String(b.unit || ''),
    kind: String(b.kind || 'hypothese'),
    source: String(b.source || ''),
    validated: b.validated ? 1 : 0,
    required: 1,
    note: String(b.note || ''),
    created_at: now(),
  };
  if (existing) {
    update('assumptions', existing.id, { ...payload, created_at: existing.created_at });
    audit(dossier.id, req.user.id, 'assumption.update', { key: b.key, value: payload.value });
    res.json({ assumption: get('SELECT * FROM assumptions WHERE id = ?', [existing.id]) });
  } else {
    const newId = id('asm');
    insert('assumptions', { id: newId, ...payload });
    audit(dossier.id, req.user.id, 'assumption.create', { key: b.key, value: payload.value });
    res.json({ assumption: get('SELECT * FROM assumptions WHERE id = ?', [newId]) });
  }
});

app.patch('/api/assumptions/:asmId', requireUser, (req: AuthedRequest, res) => {
  const a = get('SELECT * FROM assumptions WHERE id = ?', [req.params.asmId]);
  if (!a) return res.status(404).json({ error: 'Hypothèse introuvable.' });
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [a.dossier_id]);
  if (!dossier || dossier.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  const b = req.body ?? {};
  const payload: Record<string, any> = {};
  for (const k of ['label', 'unit', 'kind', 'source', 'note']) if (k in b) payload[k] = String(b[k]);
  if ('value' in b) payload.value = String(b.value);
  if ('validated' in b) payload.validated = b.validated ? 1 : 0;
  update('assumptions', a.id, payload);
  audit(dossier.id, req.user.id, 'assumption.update', { id: a.id, ...payload });
  res.json({ assumption: get('SELECT * FROM assumptions WHERE id = ?', [a.id]) });
});

app.delete('/api/assumptions/:asmId', requireUser, (req: AuthedRequest, res) => {
  const a = get('SELECT * FROM assumptions WHERE id = ?', [req.params.asmId]);
  if (!a) return res.status(404).json({ error: 'Hypothèse introuvable.' });
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [a.dossier_id]);
  if (!dossier || dossier.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  run('DELETE FROM assumptions WHERE id = ?', [a.id]);
  audit(dossier.id, req.user.id, 'assumption.delete', { id: a.id });
  res.json({ ok: true });
});

/* --------------------------------------------------------- Adjustments */

function hydrateAdjustment(a: any) {
  const entries = all('SELECT * FROM entries WHERE adjustment_id = ? ORDER BY rowid', [a.id]);
  const debit = round2(entries.reduce((s, e) => s + Number(e.debit), 0));
  const credit = round2(entries.reduce((s, e) => s + Number(e.credit), 0));
  return {
    ...a,
    details: safeJson(a.details_json),
    computations: safeJson(a.computations_json),
    refs: safeJson(a.refs_json),
    missing: safeJson(a.missing_json),
    ai: safeJson(a.ai_rationale),
    entries,
    entryBalance: { debit, credit, balanced: Math.abs(debit - credit) < 0.01 },
  };
}

app.get('/api/dossiers/:id/adjustments', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const rows = all('SELECT * FROM adjustments WHERE dossier_id = ? ORDER BY ref', [dossier.id]);
  res.json({ adjustments: rows.map(hydrateAdjustment) });
});

app.post('/api/dossiers/:id/adjustments/generate', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const proposed = proposeAdjustments(dossier.id);
  const saved = saveAdjustments(dossier.id, proposed);
  audit(dossier.id, req.user.id, 'adjustments.generate', saved);
  res.json({
    saved,
    adjustments: all('SELECT * FROM adjustments WHERE dossier_id = ? ORDER BY ref', [dossier.id]).map(hydrateAdjustment),
  });
});

app.patch('/api/adjustments/:adjId', requireUser, (req: AuthedRequest, res) => {
  const adj = get('SELECT * FROM adjustments WHERE id = ?', [req.params.adjId]);
  if (!adj) return res.status(404).json({ error: 'Retraitement introuvable.' });
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [adj.dossier_id]);
  if (!dossier || dossier.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  const b = req.body ?? {};
  const action = String(b.action || '');
  const comment = String(b.comment || '');
  let status = adj.status;
  if (action === 'approuver') {
    const entries = all('SELECT * FROM entries WHERE adjustment_id = ?', [adj.id]);
    if (entries.length === 0) {
      return res.status(409).json({
        error:
          "Impossible d'approuver : ce retraitement ne comporte aucune écriture. Il est en attente d'informations complémentaires.",
      });
    }
    const debit = round2(entries.reduce((s, e) => s + Number(e.debit), 0));
    const credit = round2(entries.reduce((s, e) => s + Number(e.credit), 0));
    if (Math.abs(debit - credit) > 0.01) {
      return res.status(409).json({
        error: `Écriture déséquilibrée (débit ${debit} ≠ crédit ${credit}) : la validation est bloquée.`,
      });
    }
    status = 'approuve';
    run('UPDATE entries SET status = ? WHERE adjustment_id = ?', ['approuve', adj.id]);
  } else if (action === 'rejeter') {
    status = 'rejete';
    run('UPDATE entries SET status = ? WHERE adjustment_id = ?', ['rejete', adj.id]);
  } else if (action === 'modifier') {
    status = 'modifie';
  } else if (action === 'demander_justification') {
    status = 'justification_demandee';
  }
  const payload: Record<string, any> = { status, updated_at: now() };
  if (b.amount !== undefined) payload.amount = round2(Number(b.amount));
  if (b.title !== undefined) payload.title = String(b.title);
  if (b.rationale !== undefined) payload.rationale = String(b.rationale);
  if (b.norm_code !== undefined) payload.norm_code = String(b.norm_code);
  update('adjustments', adj.id, payload);

  insert('validations', {
    id: id('val'),
    dossier_id: dossier.id,
    entity: 'adjustment',
    entity_id: adj.id,
    action: action || 'mise_a_jour',
    comment,
    actor: req.user.id,
    created_at: now(),
  });
  audit(dossier.id, req.user.id, `adjustment.${action || 'update'}`, { ref: adj.ref, comment });
  res.json({ adjustment: hydrateAdjustment(get('SELECT * FROM adjustments WHERE id = ?', [adj.id])) });
});

app.get('/api/adjustments/:adjId/validations', requireUser, (req: AuthedRequest, res) => {
  const adj = get('SELECT * FROM adjustments WHERE id = ?', [req.params.adjId]);
  if (!adj) return res.status(404).json({ error: 'Retraitement introuvable.' });
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [adj.dossier_id]);
  if (!dossier || dossier.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  res.json({ validations: all('SELECT * FROM validations WHERE entity_id = ? ORDER BY created_at DESC', [adj.id]) });
});

/* ------------------------------------------------------------- Entries */

app.get('/api/dossiers/:id/entries', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const entries = all(
    `SELECT e.*, a.status AS adjustment_status, a.title AS adjustment_title
     FROM entries e LEFT JOIN adjustments a ON a.id = e.adjustment_id
     WHERE e.dossier_id = ? ORDER BY e.ref, e.rowid`,
    [dossier.id],
  );
  const groups = new Map<string, { ref: string; norm: string; status: string; title: string; debit: number; credit: number; entries: any[] }>();
  for (const e of entries) {
    const g = groups.get(e.ref) ?? {
      ref: e.ref,
      norm: e.norm_code,
      status: e.adjustment_status || e.status,
      title: e.adjustment_title || '',
      debit: 0,
      credit: 0,
      entries: [] as any[],
    };
    g.debit = round2(g.debit + Number(e.debit));
    g.credit = round2(g.credit + Number(e.credit));
    g.entries.push(e);
    groups.set(e.ref, g);
  }
  res.json({
    entries,
    groups: [...groups.values()].map((g) => ({ ...g, balanced: Math.abs(g.debit - g.credit) < 0.01 })),
    totals: {
      debit: round2(entries.reduce((s, e) => s + Number(e.debit), 0)),
      credit: round2(entries.reduce((s, e) => s + Number(e.credit), 0)),
    },
  });
});

app.patch('/api/entries/:entryId', requireUser, (req: AuthedRequest, res) => {
  const entry = get('SELECT * FROM entries WHERE id = ?', [req.params.entryId]);
  if (!entry) return res.status(404).json({ error: 'Écriture introuvable.' });
  const dossier = get('SELECT * FROM dossiers WHERE id = ?', [entry.dossier_id]);
  if (!dossier || dossier.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  const adj = entry.adjustment_id ? get('SELECT * FROM adjustments WHERE id = ?', [entry.adjustment_id]) : null;
  if (adj && adj.status === 'approuve')
    return res.status(409).json({
      error:
        "Cette écriture est validée : elle ne peut pas être modifiée sans action explicite. Rejetez d'abord le retraitement pour la modifier.",
    });
  const b = req.body ?? {};
  const payload: Record<string, any> = {};
  for (const k of ['account_code', 'account_label', 'label', 'norm_code', 'doc_ref', 'date']) if (k in b) payload[k] = String(b[k]);
  if ('debit' in b) payload.debit = round2(Number(b.debit || 0));
  if ('credit' in b) payload.credit = round2(Number(b.credit || 0));
  update('entries', entry.id, payload);
  if (adj) {
    const entries = all('SELECT * FROM entries WHERE adjustment_id = ?', [adj.id]);
    const debit = round2(entries.reduce((s, e) => s + Number(e.debit), 0));
    const credit = round2(entries.reduce((s, e) => s + Number(e.credit), 0));
    update('adjustments', adj.id, {
      status: 'modifie',
      amount: adj.amount,
      details_json: JSON.stringify({
        ...(safeJson(adj.details_json) || {}),
        entryBalance: { debit, credit, balanced: Math.abs(debit - credit) < 0.01 },
      }),
      updated_at: now(),
    });
  }
  audit(dossier.id, req.user.id, 'entry.update', { id: entry.id, ...payload });
  res.json({ entry: get('SELECT * FROM entries WHERE id = ?', [entry.id]) });
});

/* ------------------------------------------------- Statements & passage */

app.get('/api/dossiers/:id/passage', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const onlyApproved = String(req.query.scope || 'valides') !== 'tous';
  res.json({ passage: buildPassage(dossier.id, onlyApproved), scope: onlyApproved ? 'valides' : 'tous' });
});

app.get('/api/dossiers/:id/statements', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const onlyApproved = String(req.query.scope || 'valides') !== 'tous';
  const statements = buildFinancialStatements(dossier.id, onlyApproved);
  res.json({ statements });
});

app.post('/api/dossiers/:id/statements/generate', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const onlyApproved = req.body?.scope !== 'tous';
  const statements = buildFinancialStatements(dossier.id, onlyApproved);
  run('DELETE FROM statements WHERE dossier_id = ? AND kind = ?', [dossier.id, 'ifrs_set']);
  insert('statements', {
    id: id('stm'),
    dossier_id: dossier.id,
    kind: 'ifrs_set',
    generated_at: now(),
    payload_json: JSON.stringify(statements),
  });
  run('UPDATE dossiers SET status = ?, updated_at = ? WHERE id = ?', ['etats_generes', now(), dossier.id]);
  audit(dossier.id, req.user.id, 'statements.generate', { scope: onlyApproved ? 'valides' : 'tous' });
  res.json({ statements });
});

app.get('/api/dossiers/:id/statements/history', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  res.json({
    history: all('SELECT id, kind, generated_at FROM statements WHERE dossier_id = ? ORDER BY generated_at DESC', [dossier.id]),
  });
});

app.get('/api/dossiers/:id/controls', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  res.json(runControls(dossier.id));
});

/* ---------------------------------------------------------------- Norms */

app.get('/api/norms', requireUser, (_req, res) => {
  const norms = all('SELECT * FROM norms ORDER BY kind DESC, code');
  res.json({
    norms: norms.map((n) => ({
      ...n,
      paragraphCount: all('SELECT COUNT(*) AS n FROM norm_paragraphs WHERE norm_id = ?', [n.id])[0]?.n ?? 0,
      verifiedCount: all('SELECT COUNT(*) AS n FROM norm_paragraphs WHERE norm_id = ? AND verified = 1', [n.id])[0]?.n ?? 0,
    })),
  });
});

app.get('/api/norms/search', requireUser, (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  const like = `%${q}%`;
  const results = all(
    `SELECT p.*, n.code AS norm_code, n.title AS norm_title, n.source_url AS source_url, n.applicable_note
     FROM norm_paragraphs p JOIN norms n ON n.id = p.norm_id
     WHERE p.text LIKE ? OR p.title LIKE ? OR p.keywords LIKE ? OR p.number LIKE ? OR n.code LIKE ? OR n.title LIKE ?
     ORDER BY n.code LIMIT 60`,
    [like, like, like, like, like, like],
  );
  // Recherche sémantique légère : complément par recouvrement de termes.
  const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  const extra = all(
    `SELECT p.*, n.code AS norm_code, n.title AS norm_title, n.source_url AS source_url, n.applicable_note
     FROM norm_paragraphs p JOIN norms n ON n.id = p.norm_id`,
  ).filter((p) => {
    const hay = `${p.text} ${p.title} ${p.keywords}`.toLowerCase();
    return terms.length > 0 && terms.every((t) => hay.includes(t));
  });
  const merged = new Map<string, any>();
  for (const r of [...results, ...extra]) merged.set(r.id, r);
  res.json({ results: [...merged.values()].slice(0, 60) });
});

app.get('/api/norms/:code', requireUser, (req, res) => {
  const norm = get('SELECT * FROM norms WHERE code = ? OR id = ?', [req.params.code, req.params.code]);
  if (!norm) return res.status(404).json({ error: 'Norme introuvable.' });
  res.json({
    norm,
    paragraphs: all('SELECT * FROM norm_paragraphs WHERE norm_id = ? ORDER BY rowid', [norm.id]),
  });
});

app.post('/api/norms', requireUser, (req: AuthedRequest, res) => {
  const b = req.body ?? {};
  if (!b.code || !b.title) return res.status(400).json({ error: 'Code et intitulé de la norme obligatoires.' });
  const normId = id('nrm');
  insert('norms', {
    id: normId,
    code: String(b.code),
    title: String(b.title),
    kind: String(b.kind || 'IFRS'),
    category: String(b.category || ''),
    status: String(b.status || 'en_vigueur'),
    publication_date: String(b.publication_date || ''),
    applicable_from: String(b.applicable_from || ''),
    applicable_note: String(b.applicable_note || ''),
    summary: String(b.summary || ''),
    source: String(b.source || ''),
    source_url: String(b.source_url || ''),
    created_at: now(),
  });
  audit(null, req.user.id, 'norm.create', { code: b.code });
  res.json({ norm: get('SELECT * FROM norms WHERE id = ?', [normId]) });
});

app.patch('/api/norms/:normId', requireUser, (req: AuthedRequest, res) => {
  const norm = get('SELECT * FROM norms WHERE id = ?', [req.params.normId]);
  if (!norm) return res.status(404).json({ error: 'Norme introuvable.' });
  const b = req.body ?? {};
  const payload: Record<string, any> = {};
  for (const k of ['code', 'title', 'kind', 'category', 'status', 'publication_date', 'applicable_from', 'applicable_note', 'summary', 'source', 'source_url']) {
    if (k in b) payload[k] = String(b[k]);
  }
  update('norms', norm.id, payload);
  audit(null, req.user.id, 'norm.update', { id: norm.id, ...payload });
  res.json({ norm: get('SELECT * FROM norms WHERE id = ?', [norm.id]) });
});

app.post('/api/norms/:normId/paragraphs', requireUser, (req: AuthedRequest, res) => {
  const norm = get('SELECT * FROM norms WHERE id = ?', [req.params.normId]);
  if (!norm) return res.status(404).json({ error: 'Norme introuvable.' });
  const b = req.body ?? {};
  if (!b.text) return res.status(400).json({ error: 'Le texte du paragraphe (reformulation) est obligatoire.' });
  const paraId = id('par');
  insert('norm_paragraphs', {
    id: paraId,
    norm_id: norm.id,
    number: String(b.number || '—'),
    title: String(b.title || ''),
    text: String(b.text),
    source: String(b.source || norm.source || ''),
    keywords: String(b.keywords || ''),
    verified: b.verified ? 1 : 0,
    note: String(b.note || 'Référence à vérifier dans le texte officiel'),
    created_at: now(),
  });
  audit(null, req.user.id, 'paragraph.create', { norm: norm.code, number: b.number });
  res.json({ paragraph: get('SELECT * FROM norm_paragraphs WHERE id = ?', [paraId]) });
});

app.patch('/api/paragraphs/:paraId', requireUser, (req: AuthedRequest, res) => {
  const p = get('SELECT * FROM norm_paragraphs WHERE id = ?', [req.params.paraId]);
  if (!p) return res.status(404).json({ error: 'Paragraphe introuvable.' });
  const b = req.body ?? {};
  const payload: Record<string, any> = {};
  for (const k of ['number', 'title', 'text', 'source', 'keywords', 'note']) if (k in b) payload[k] = String(b[k]);
  if ('verified' in b) payload.verified = b.verified ? 1 : 0;
  update('norm_paragraphs', p.id, payload);
  audit(null, req.user.id, 'paragraph.update', { id: p.id, verified: payload.verified });
  res.json({ paragraph: get('SELECT * FROM norm_paragraphs WHERE id = ?', [p.id]) });
});

app.delete('/api/paragraphs/:paraId', requireUser, (req: AuthedRequest, res) => {
  const p = get('SELECT * FROM norm_paragraphs WHERE id = ?', [req.params.paraId]);
  if (!p) return res.status(404).json({ error: 'Paragraphe introuvable.' });
  run('DELETE FROM norm_paragraphs WHERE id = ?', [p.id]);
  audit(null, req.user.id, 'paragraph.delete', { id: p.id });
  res.json({ ok: true });
});

/* --------------------------------------------------------------- Exports */

async function sendXlsx(res: express.Response, filename: string, buffer: Buffer) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

app.get('/api/dossiers/:id/export/passage.xlsx', requireUser, async (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const scope = String(req.query.scope || 'valides') !== 'tous';
  await sendXlsx(res, `tableau-passage-${dossier.exercice}.xlsx`, await exportPassage(dossier.id, scope));
});

app.get('/api/dossiers/:id/export/entries.xlsx', requireUser, async (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  await sendXlsx(res, `ecritures-retraitement-${dossier.exercice}.xlsx`, await exportEntries(dossier.id));
});

app.get('/api/dossiers/:id/export/synthesis.xlsx', requireUser, async (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const scope = String(req.query.scope || 'valides') !== 'tous';
  await sendXlsx(res, `synthese-retraitements-${dossier.exercice}.xlsx`, await exportSynthesis(dossier.id, scope));
});

app.get('/api/dossiers/:id/export/balance.xlsx', requireUser, async (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  await sendXlsx(res, `balance-cgnc-${dossier.exercice}.xlsx`, await exportBalance(dossier.id));
});

app.get('/api/dossiers/:id/export/report.pdf', requireUser, async (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const scope = String(req.query.scope || 'valides') !== 'tous';
  const buffer = await generateReport(dossier.id, scope);
  audit(dossier.id, req.user.id, 'export.report', { scope: scope ? 'valides' : 'tous' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="rapport-conversion-ifrs-${dossier.exercice}.pdf"`);
  res.send(buffer);
});

/* ------------------------------------------------------------------ Chat */

app.get('/api/dossiers/:id/chat', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const cfg = getAiConfig(req.user.id);
  res.json({
    messages: all('SELECT * FROM chat_messages WHERE dossier_id = ? ORDER BY created_at', [dossier.id]),
    ai: aiStatus(cfg),
  });
});

app.post('/api/dossiers/:id/chat', requireUser, async (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  const question = String(req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'Question vide.' });
  insert('chat_messages', {
    id: id('msg'),
    dossier_id: dossier.id,
    role: 'user',
    content: question,
    refs_json: '[]',
    provider: '',
    created_at: now(),
  });
  const result = await askAssistant(req.user.id, dossier.id, question);
  const msgId = id('msg');
  insert('chat_messages', {
    id: msgId,
    dossier_id: dossier.id,
    role: 'assistant',
    content: result.answer,
    refs_json: JSON.stringify(result.refs ?? []),
    provider: result.mode === 'ia' ? `${result.provider ?? ''} ${result.model ?? ''}`.trim() : 'moteur déterministe',
    created_at: now(),
  });
  audit(dossier.id, req.user.id, 'chat.ask', { mode: result.mode });
  res.json({
    answer: result.answer,
    mode: result.mode,
    reason: (result as any).reason ?? null,
    refs: result.refs ?? [],
    usedData: (result as any).usedData ?? [],
    message: get('SELECT * FROM chat_messages WHERE id = ?', [msgId]),
  });
});

app.delete('/api/dossiers/:id/chat', requireUser, (req: AuthedRequest, res) => {
  const dossier = guardDossier(req, res);
  if (!dossier) return;
  run('DELETE FROM chat_messages WHERE dossier_id = ?', [dossier.id]);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ Demo */

app.post('/api/demo', requireUser, (req: AuthedRequest, res) => {
  const dossierId = createDemoDossier(req.user.id, req.body?.company_name);
  audit(dossierId, req.user.id, 'demo.create', {});
  res.json({ dossierId, dossier: get('SELECT * FROM dossiers WHERE id = ?', [dossierId]) });
});

app.delete('/api/demo', requireUser, (req: AuthedRequest, res) => {
  const n = resetDemoDossier(req.user.id);
  audit(null, req.user.id, 'demo.reset', { removed: n });
  res.json({ removed: n });
});

/* ------------------------------------------------------- Sert le frontend */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(ROOT, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err?.message || 'Erreur interne du serveur.' });
});

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, () => {
  console.log(`[IFRS Bridge Maroc] API disponible sur http://localhost:${PORT}`);
  const stats = {
    norms: all('SELECT COUNT(*) AS n FROM norms')[0]?.n,
    users: all('SELECT COUNT(*) AS n FROM users')[0]?.n,
  };
  console.log(`[IFRS Bridge Maroc] Bibliothèque normative : ${stats.norms} norme(s) — ${stats.users} utilisateur(s).`);
});

void db;
