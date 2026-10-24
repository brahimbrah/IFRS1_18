import { all, get, id, insert, now, run } from '../db.ts';
import { NORM_SEED } from './norms.ts';
import { MAP_RULES, WATCH_RULES } from './cgnc-map.ts';

/** Bibliothèque normative : insertion idempotente des normes et paragraphes. */
export function seedNorms() {
  const existing = all('SELECT code FROM norms');
  const known = new Set(existing.map((n) => n.code as string));
  for (const n of NORM_SEED) {
    if (known.has(n.code)) continue;
    const normId = id('nrm');
    insert('norms', {
      id: normId,
      code: n.code,
      title: n.title,
      kind: n.kind,
      category: n.category,
      status: n.status,
      publication_date: n.publication_date,
      applicable_from: n.applicable_from,
      applicable_note: n.applicable_note,
      summary: n.summary,
      source: n.source,
      source_url: n.source_url,
      created_at: now(),
    });
    for (const p of n.paragraphs) {
      insert('norm_paragraphs', {
        id: id('par'),
        norm_id: normId,
        number: p.number,
        title: p.title,
        text: p.text,
        source: n.source,
        keywords: p.keywords,
        verified: 0,
        note: 'Référence à vérifier dans le texte officiel — à valider par l’administrateur',
        created_at: now(),
      });
    }
  }
}

/** Compte de démonstration : permet au professeur de tester sans importer de fichiers. */
export function ensureDemoUser() {
  const email = 'demo@ifrsbridge.ma';
  let user = get('SELECT * FROM users WHERE email = ?', [email]);
  if (user) return user;
  // Le mot de passe est généré côté route d'authentification ; ici on crée un
  // compte de démonstration verrouillé sans mot de passe utilisable.
  insert('users', {
    id: id('usr'),
    email,
    name: 'Compte de démonstration',
    password_hash: '!demo',
    role: 'user',
    created_at: now(),
  });
  user = get('SELECT * FROM users WHERE email = ?', [email]);
  return user!;
}

export function referentialStats() {
  return {
    norms: all('SELECT COUNT(*) AS n FROM norms')[0]?.n ?? 0,
    paragraphs: all('SELECT COUNT(*) AS n FROM norm_paragraphs')[0]?.n ?? 0,
    mapRules: MAP_RULES.length,
    watchRules: WATCH_RULES.length,
  };
}

export function resetNorms() {
  run('DELETE FROM norm_paragraphs', []);
  run('DELETE FROM norms', []);
  seedNorms();
}
