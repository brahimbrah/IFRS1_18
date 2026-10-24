import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(process.cwd());
export const DATA_DIR = path.join(ROOT, 'storage');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'ifrs-bridge.sqlite');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function id(prefix = ''): string {
  return prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}

export function now(): string {
  return new Date().toISOString();
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY,
  ai_enabled INTEGER NOT NULL DEFAULT 0,
  ai_provider TEXT NOT NULL DEFAULT 'openai',
  ai_model TEXT NOT NULL DEFAULT '',
  ai_base_url TEXT NOT NULL DEFAULT '',
  ai_api_key TEXT NOT NULL DEFAULT '',
  ai_temperature REAL NOT NULL DEFAULT 0.1,
  allow_external_ai INTEGER NOT NULL DEFAULT 0,
  default_currency TEXT NOT NULL DEFAULT 'MAD',
  default_exercise TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  ice TEXT DEFAULT '',
  identifiant_fiscal TEXT DEFAULT '',
  city TEXT DEFAULT '',
  secteur TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dossiers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT,
  name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  exercice TEXT NOT NULL,
  closing_date TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MAD',
  conversion_type TEXT NOT NULL DEFAULT 'premiere_adoption',
  framework TEXT NOT NULL DEFAULT 'IAS1',
  is_demo INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'brouillon',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  dossier_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  stored_name TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'en_attente',
  message TEXT DEFAULT '',
  rows INTEGER DEFAULT 0,
  columns_json TEXT DEFAULT '',
  parsed_json TEXT DEFAULT '',
  uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gl_lines (
  id TEXT PRIMARY KEY,
  dossier_id TEXT NOT NULL,
  document_id TEXT,
  account_code TEXT NOT NULL,
  account_label TEXT NOT NULL,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  aux TEXT DEFAULT '',
  source TEXT DEFAULT 'import',
  raw_json TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mappings (
  id TEXT PRIMARY KEY,
  dossier_id TEXT NOT NULL,
  account_code TEXT NOT NULL,
  account_label TEXT NOT NULL,
  cgnc_class INTEGER,
  cgnc_group TEXT DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  side TEXT DEFAULT 'debit',
  ifrs_line TEXT DEFAULT '',
  ifrs_group TEXT DEFAULT '',
  nature TEXT DEFAULT '',
  justification TEXT DEFAULT '',
  norm_code TEXT DEFAULT '',
  confidence REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'propose',
  origin TEXT NOT NULL DEFAULT 'auto',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assumptions (
  id TEXT PRIMARY KEY,
  dossier_id TEXT NOT NULL,
  norm_code TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT '',
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'hypothese',
  source TEXT DEFAULT '',
  validated INTEGER NOT NULL DEFAULT 0,
  required INTEGER NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS adjustments (
  id TEXT PRIMARY KEY,
  dossier_id TEXT NOT NULL,
  ref TEXT NOT NULL,
  title TEXT NOT NULL,
  poste_cgnc TEXT NOT NULL,
  account_code TEXT DEFAULT '',
  norm_code TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'ajustement',
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'a_valider',
  direction TEXT DEFAULT '',
  details_json TEXT DEFAULT '{}',
  computations_json TEXT DEFAULT '[]',
  refs_json TEXT DEFAULT '[]',
  missing_json TEXT DEFAULT '[]',
  rationale TEXT DEFAULT '',
  ai_rationale TEXT DEFAULT '',
  origin TEXT NOT NULL DEFAULT 'moteur',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  dossier_id TEXT NOT NULL,
  adjustment_id TEXT,
  entry_group INTEGER NOT NULL DEFAULT 1,
  date TEXT NOT NULL,
  ref TEXT NOT NULL,
  account_code TEXT NOT NULL,
  account_label TEXT NOT NULL,
  label TEXT NOT NULL,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  norm_code TEXT DEFAULT '',
  doc_ref TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'a_valider',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS validations (
  id TEXT PRIMARY KEY,
  dossier_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  comment TEXT DEFAULT '',
  actor TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  dossier_id TEXT,
  actor TEXT DEFAULT '',
  action TEXT NOT NULL,
  payload_json TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS norms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'IFRS',
  category TEXT DEFAULT '',
  status TEXT DEFAULT 'en_vigueur',
  publication_date TEXT DEFAULT '',
  applicable_from TEXT DEFAULT '',
  applicable_note TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  source TEXT DEFAULT '',
  source_url TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS norm_paragraphs (
  id TEXT PRIMARY KEY,
  norm_id TEXT NOT NULL,
  number TEXT NOT NULL,
  title TEXT DEFAULT '',
  text TEXT NOT NULL,
  source TEXT DEFAULT '',
  keywords TEXT DEFAULT '',
  verified INTEGER NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS statements (
  id TEXT PRIMARY KEY,
  dossier_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  dossier_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  refs_json TEXT DEFAULT '[]',
  provider TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gl_dossier ON gl_lines(dossier_id);
CREATE INDEX IF NOT EXISTS idx_map_dossier ON mappings(dossier_id);
CREATE INDEX IF NOT EXISTS idx_adj_dossier ON adjustments(dossier_id);
CREATE INDEX IF NOT EXISTS idx_ent_dossier ON entries(dossier_id);
CREATE INDEX IF NOT EXISTS idx_doc_dossier ON documents(dossier_id);
CREATE INDEX IF NOT EXISTS idx_par_norm ON norm_paragraphs(norm_id);
`;

db.exec(SCHEMA);

export type Row = Record<string, any>;

export function all(sql: string, params: any[] = []): Row[] {
  return db.prepare(sql).all(...params) as Row[];
}

export function get(sql: string, params: any[] = []): Row | undefined {
  return db.prepare(sql).get(...params) as Row | undefined;
}

export function run(sql: string, params: any[] = []): void {
  db.prepare(sql).run(...params);
}

export function insert(table: string, data: Record<string, any>): void {
  const keys = Object.keys(data);
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys
    .map(() => '?')
    .join(', ')})`;
  db.prepare(sql).run(...keys.map((k) => normalise(data[k])));
}

export function update(table: string, rowId: string, data: Record<string, any>): void {
  const keys = Object.keys(data);
  if (keys.length === 0) return;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...keys.map((k) => normalise(data[k])), rowId);
}

function normalise(v: any): any {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

export function audit(dossierId: string | null, actor: string, action: string, payload?: any) {
  insert('audit_log', {
    id: id('aud'),
    dossier_id: dossierId,
    actor,
    action,
    payload_json: payload ? JSON.stringify(payload) : '',
    created_at: now(),
  });
}
