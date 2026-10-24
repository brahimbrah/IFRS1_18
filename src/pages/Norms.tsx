import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, ExternalLink, Plus, Search, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/store';
import { dateFr } from '../lib/format';
import { Badge, Banner, Card, CardHeader, EmptyState, ErrorState, Field, Loading, Modal, StatusChip } from '../components/ui';
import type { Norm, NormParagraph } from '../lib/types';

export default function Norms() {
  const { notify } = useApp();
  const [norms, setNorms] = useState<Norm[]>([]);
  const [selected, setSelected] = useState<Norm | null>(null);
  const [paragraphs, setParagraphs] = useState<NormParagraph[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [addPara, setAddPara] = useState(false);
  const [addNorm, setAddNorm] = useState(false);
  const [filterKind, setFilterKind] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ norms: Norm[] }>('/norms');
      setNorms(res.norms);
      if (!selected && res.norms.length) select(res.norms[0]);
    } catch (e: any) {
      setError(e?.message || 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  async function select(n: Norm) {
    setSelected(n);
    try {
      const res = await api.get<{ norm: Norm; paragraphs: NormParagraph[] }>(`/norms/${encodeURIComponent(n.code)}`);
      setParagraphs(res.paragraphs);
    } catch {
      setParagraphs([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search() {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    const res = await api.get<{ results: any[] }>(`/norms/search?q=${encodeURIComponent(query)}`);
    setResults(res.results);
  }

  const filtered = useMemo(() => (filterKind === 'all' ? norms : norms.filter((n) => n.kind === filterKind)), [norms, filterKind]);
  const kinds = useMemo(() => [...new Set(norms.map((n) => n.kind))], [norms]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Bibliothèque des normes</h1>
          <p className="text-sm text-navy-500">Référentiel normatif CGNC et IAS/IFRS. Les numéros de paragraphe non validés portent la mention « Référence à vérifier ».</p>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => setAddNorm(true)}>
          <Plus className="h-4 w-4" /> Ajouter une norme
        </button>
      </div>

      <Card className="card-pad">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[16rem]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-navy-300" />
            <input
              className="input pl-9"
              placeholder="Rechercher un texte, un mot-clé, une norme…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
            />
          </div>
          <button className="btn-primary" onClick={search}>
            Rechercher
          </button>
          {results && (
            <button className="btn-ghost" onClick={() => { setResults(null); setQuery(''); }}>
              Effacer
            </button>
          )}
        </div>
      </Card>

      {results && (
        <Card>
          <CardHeader title={`Résultats de recherche (${results.length})`} />
          <div className="divide-y divide-navy-100">
            {results.length === 0 && <p className="card-pad text-sm text-navy-500">Aucun résultat.</p>}
            {results.map((r) => (
              <div key={r.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip border border-navy-200 bg-navy-50 text-navy-700">{r.norm_code}</span>
                  <span className="text-xs font-medium text-navy-600">{r.number}</span>
                  {r.verified ? <Badge className="!bg-emerald-50 !text-emerald-700 !border-emerald-200">Vérifié</Badge> : <Badge className="!bg-amber-50 !text-amber-700 !border-amber-200">À vérifier</Badge>}
                </div>
                <p className="mt-1 text-sm text-navy-700">{r.text}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {loading && <Card><Loading /></Card>}

      {!loading && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader title={`Normes (${filtered.length})`} icon={<BookOpen className="h-5 w-5" />} />
            <div className="px-3 pt-2 flex flex-wrap gap-1">
              <button className={`chip border ${filterKind === 'all' ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-navy-200 bg-white text-navy-600'}`} onClick={() => setFilterKind('all')}>Toutes</button>
              {kinds.map((k) => (
                <button key={k} className={`chip border ${filterKind === k ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-navy-200 bg-white text-navy-600'}`} onClick={() => setFilterKind(k)}>{k}</button>
              ))}
            </div>
            <div className="max-h-[32rem] overflow-y-auto p-2">
              {filtered.map((n) => (
                <button
                  key={n.id}
                  onClick={() => select(n)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition ${selected?.id === n.id ? 'bg-navy-50' : 'hover:bg-navy-50/60'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-navy-900">{n.code}</span>
                    <Badge>{n.kind}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-navy-500 truncate">{n.title}</p>
                  <p className="mt-1 text-[11px] text-navy-400">
                    {n.paragraphCount ?? 0} paragraphe(s) · {n.verifiedCount ?? 0} vérifié(s)
                  </p>
                </button>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            {!selected ? (
              <EmptyState title="Sélectionnez une norme" description="Choisissez une norme pour consulter son résumé et ses paragraphes indexés." />
            ) : (
              <>
                <CardHeader
                  title={`${selected.code} — ${selected.title}`}
                  subtitle={`${selected.kind} · ${selected.category || 'sans catégorie'}`}
                  right={
                    <button className="btn-ghost btn-sm" onClick={() => setAddPara(true)}>
                      <Plus className="h-3.5 w-3.5" /> Paragraphe
                    </button>
                  }
                />
                <div className="card-pad space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Meta label="Statut" value={selected.status} />
                    <Meta label="Applicable à partir du" value={selected.applicable_from ? dateFr(selected.applicable_from) : '—'} />
                    <Meta label="Publication" value={selected.publication_date ? dateFr(selected.publication_date) : '—'} />
                    <Meta label="Source" value={selected.source || '—'} />
                  </div>
                  {selected.applicable_note && <Banner kind="info">{selected.applicable_note}</Banner>}
                  {selected.summary && <p className="text-sm text-navy-600">{selected.summary}</p>}
                  {selected.source_url && (
                    <a href={selected.source_url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-sm">
                      <ExternalLink className="h-3.5 w-3.5" /> Texte officiel de référence
                    </a>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-navy-800">Paragraphes indexés ({paragraphs.length})</h4>
                      <span className="text-xs text-navy-400">Les numéros doivent être vérifiés dans le texte officiel.</span>
                    </div>
                    {paragraphs.length === 0 && (
                      <p className="text-sm text-navy-500">
                        Aucun paragraphe indexé. Les retraitements rattachés à cette norme portent la mention « Référence à vérifier ».
                      </p>
                    )}
                    {paragraphs.map((p) => (
                      <div key={p.id} className="rounded-lg border border-navy-100 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-navy-600">{p.number}</span>
                          {p.verified ? (
                            <Badge className="!bg-emerald-50 !text-emerald-700 !border-emerald-200"><CheckCircle2 className="h-3 w-3" /> Vérifié</Badge>
                          ) : (
                            <Badge className="!bg-amber-50 !text-amber-700 !border-amber-200"><ShieldCheck className="h-3 w-3" /> Référence à vérifier</Badge>
                          )}
                          <button
                            className="link ml-auto text-xs"
                            onClick={async () => {
                              await api.patch(`/paragraphs/${p.id}`, { verified: !p.verified });
                              notify('Statut du paragraphe mis à jour.', 'success');
                              select(selected);
                            }}
                          >
                            Marquer comme {p.verified ? 'à vérifier' : 'vérifié'}
                          </button>
                        </div>
                        {p.title && <p className="mt-1 text-xs font-medium text-navy-600">{p.title}</p>}
                        <p className="mt-1 text-sm text-navy-700">{p.text}</p>
                        <p className="mt-1 text-[11px] text-navy-400">Source : {p.source || '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <AddParagraphModal open={addPara} onClose={() => setAddPara(false)} norm={selected} onSaved={() => selected && select(selected)} />
      <AddNormModal open={addNorm} onClose={() => setAddNorm(false)} onSaved={load} />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-navy-100 px-3.5 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">{label}</p>
      <p className="text-sm text-navy-800 mt-0.5">{value}</p>
    </div>
  );
}

function AddParagraphModal({ open, onClose, norm, onSaved }: { open: boolean; onClose: () => void; norm: Norm | null; onSaved: () => void }) {
  const { notify } = useApp();
  const [form, setForm] = useState({ number: '', title: '', text: '', keywords: '', source: '', verified: false });
  useEffect(() => setForm({ number: '', title: '', text: '', keywords: '', source: norm?.source || '', verified: false }), [open, norm]);

  if (!norm) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ajouter un paragraphe — ${norm.code}`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button
            className="btn-primary"
            onClick={async () => {
              if (!form.text.trim()) return notify('Le texte est obligatoire.', 'error');
              try {
                await api.post(`/norms/${norm.id}/paragraphs`, form);
                notify('Paragraphe ajouté.', 'success');
                onSaved();
                onClose();
              } catch (e: any) {
                notify(e?.message || 'Ajout impossible.', 'error');
              }
            }}
          >
            Ajouter
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Banner kind="warn">Saisissez uniquement des reformulations ou des extraits dont vous avez vérifié le numéro de paragraphe dans le texte officiel. Sinon, laissez la mention « Référence à vérifier ».</Banner>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Numéro de paragraphe"><input className="input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="ex. 30" /></Field>
          <Field label="Titre / thème"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        </div>
        <Field label="Texte (reformulation)" required><textarea className="input" rows={4} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mots-clés"><input className="input" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} /></Field>
          <Field label="Source"><input className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-navy-700">
          <input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} />
          J’ai vérifié ce numéro de paragraphe dans le texte officiel
        </label>
      </div>
    </Modal>
  );
}

function AddNormModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { notify } = useApp();
  const [form, setForm] = useState({ code: '', title: '', kind: 'IFRS', category: '', status: 'en_vigueur', summary: '', source: '', source_url: '', applicable_from: '' });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajouter une norme au référentiel"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button
            className="btn-primary"
            onClick={async () => {
              if (!form.code || !form.title) return notify('Code et intitulé obligatoires.', 'error');
              try {
                await api.post('/norms', form);
                notify('Norme ajoutée.', 'success');
                onSaved();
                onClose();
              } catch (e: any) {
                notify(e?.message || 'Ajout impossible.', 'error');
              }
            }}
          >
            Ajouter
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code" required><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="IFRS 17" /></Field>
          <Field label="Type">
            <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option>IFRS</option>
              <option>IAS</option>
              <option>CGNC</option>
            </select>
          </Field>
        </div>
        <Field label="Intitulé" required><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Catégorie"><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Applicable à partir du"><input type="date" className="input" value={form.applicable_from} onChange={(e) => setForm({ ...form, applicable_from: e.target.value })} /></Field>
        </div>
        <Field label="Résumé"><textarea className="input" rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source"><input className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
          <Field label="URL source"><input className="input" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} /></Field>
        </div>
      </div>
    </Modal>
  );
}
