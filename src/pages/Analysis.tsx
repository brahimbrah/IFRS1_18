import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Info, ListChecks, Plus, Save, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/store';
import { normColor, statusLabel } from '../lib/format';
import { Badge, Banner, Card, CardHeader, ConfirmButton, EmptyState, ErrorState, Field, Loading, Modal, Num, SeverityBadge, StatusChip, TableWrap, Tabs } from '../components/ui';
import NoDossier from '../components/RequireDossier';
import type { Assumption, Finding, Mapping } from '../lib/types';

type AnalysisData = {
  findings: Finding[];
  proposedMappings: any[];
  mappings: Mapping[];
  totals: any[];
  ai: { status: { ready: boolean; reason?: string }; lastAnalysis: string | null };
  referenceKinds: string[];
};

export default function Analysis() {
  const { current, notify } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState('findings');
  const [data, setData] = useState<AnalysisData | null>(null);
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [prefill, setPrefill] = useState<{ norm: string; scope: string; key: string; label: string } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const load = async () => {
    if (!current) return;
    setLoading(true);
    setError('');
    try {
      const [a, asm] = await Promise.all([
        api.get<AnalysisData>(`/dossiers/${current.id}/analysis`),
        api.get<{ assumptions: Assumption[] }>(`/dossiers/${current.id}/assumptions`),
      ]);
      setData(a);
      setAssumptions(asm.assumptions);
    } catch (e: any) {
      setError(e?.message || 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  async function runAnalysis() {
    if (!current) return;
    setBusy(true);
    try {
      const res = await api.post<{ saved: any }>(`/dossiers/${current.id}/analysis/run`, {});
      notify(`Analyse terminée : ${res.saved?.created ?? 0} retraitement(s) créé(s), ${res.saved?.updated ?? 0} mis à jour.`, 'success');
      await load();
    } catch (e: any) {
      notify(e?.message || 'Analyse impossible.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function runAi() {
    if (!current) return;
    setAiBusy(true);
    try {
      const res = await api.post<{ ok: boolean; configured: boolean; error?: string; provider?: string; model?: string }>(`/dossiers/${current.id}/analysis/ai`, {});
      if (res.ok) notify(`Analyse IA effectuée (${res.provider} ${res.model}).`, 'success');
      else notify(res.error || 'Analyse IA indisponible : le moteur déterministe reste actif.', 'info');
      await load();
    } catch (e: any) {
      notify(e?.message || 'Analyse IA impossible.', 'error');
    } finally {
      setAiBusy(false);
    }
  }

  if (!current) return <NoDossier hint="Sélectionnez un dossier pour lancer l’analyse des divergences CGNC ↔ IFRS." />;

  const findings = data?.findings ?? [];
  const missingCount = findings.filter((f) => f.status === 'informations_requises').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Analyse intelligente</h1>
          <p className="text-sm text-navy-500">Le moteur déterministe identifie les divergences CGNC ↔ IFRS et propose des retraitements justifiés.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost btn-sm" onClick={runAi} disabled={aiBusy} title={data?.ai.status.ready ? 'Enrichir avec le modèle IA' : 'IA non configurée'}>
            <Sparkles className="h-4 w-4" /> {aiBusy ? 'Analyse IA…' : 'Analyse IA'}
          </button>
          <button className="btn-primary btn-sm" onClick={runAnalysis} disabled={busy}>
            <Wand2 className="h-4 w-4" /> {busy ? 'Analyse…' : 'Lancer l’analyse'}
          </button>
        </div>
      </div>

      {data && !data.ai.status.ready && (
        <Banner kind="info" title="Assistant IA non configuré">
          Le moteur déterministe fonctionne seul. Pour enrichir l’analyse avec un modèle de langage, renseignez une clé d’API dans « Paramètres » (elle reste stockée côté serveur). {data.ai.status.reason}
        </Banner>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <MiniCard label="Divergences identifiées" value={findings.length} />
        <MiniCard label="Retraitements chiffrables" value={findings.filter((f) => f.status === 'pret').length} tone="good" />
        <MiniCard label="Informations requises" value={missingCount} tone={missingCount ? 'warn' : 'good'} />
        <MiniCard label="Comptes analysés" value={data?.totals.length ?? 0} />
      </div>

      <Card>
        <div className="px-3 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'findings', label: 'Divergences', count: findings.length },
              { id: 'mappings', label: 'Correspondances CGNC → IFRS', count: data?.mappings.length },
              { id: 'assumptions', label: 'Informations complémentaires', count: assumptions.length },
            ]}
          />
        </div>
        <div className="card-pad">
          {error && <ErrorState message={error} onRetry={load} />}
          {loading && <Loading />}
          {!loading && !error && tab === 'findings' && (
            <FindingsList
              findings={findings}
              onProvide={(p) => {
                setPrefill(p);
                setEditorOpen(true);
              }}
              onGoRetraitements={() => nav('/retraitements')}
            />
          )}
          {!loading && !error && tab === 'mappings' && <MappingsTable mappings={data?.mappings ?? []} onChanged={load} />}
          {!loading && !error && tab === 'assumptions' && (
            <AssumptionsPanel
              assumptions={assumptions}
              onChanged={load}
              editorOpen={editorOpen}
              prefill={prefill}
              setEditorOpen={setEditorOpen}
              setPrefill={setPrefill}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

function MiniCard({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'good' | 'warn' }) {
  const cls = tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-navy-900';
  return (
    <Card className="card-pad">
      <p className="text-xs text-navy-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${cls}`}>{value}</p>
    </Card>
  );
}

function FindingsList({
  findings,
  onProvide,
  onGoRetraitements,
}: {
  findings: Finding[];
  onProvide: (p: { norm: string; scope: string; key: string; label: string }) => void;
  onGoRetraitements: () => void;
}) {
  if (findings.length === 0)
    return <EmptyState icon={<ListChecks className="h-6 w-6" />} title="Aucune divergence détectée" description="Importez d’abord des données comptables, puis lancez l’analyse." />;

  return (
    <div className="space-y-3">
      {findings.map((f) => (
        <div key={f.key} className="rounded-lg border border-navy-100">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-navy-100 px-4 py-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${f.status === 'informations_requises' ? 'bg-orange-50 text-orange-600' : f.status === 'pret' ? 'bg-emerald-50 text-emerald-600' : 'bg-navy-50 text-navy-500'}`}>
                {f.status === 'informations_requises' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`chip border ${normColor(f.normCode)}`}>{f.normCode}</span>
                  <SeverityBadge severity={f.severity} />
                  <StatusChip status={f.status === 'a_examiner' ? 'a_verifier' : f.status} />
                </div>
                <p className="mt-1.5 text-sm font-semibold text-navy-900">{f.title}</p>
                <p className="mt-0.5 text-xs text-navy-500">{f.message}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-navy-400">Comptes concernés</p>
              <p className="text-sm font-medium text-navy-800">{f.accounts.map((a) => a.code).join(', ') || '—'}</p>
            </div>
          </div>

          <div className="px-4 py-3 space-y-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <p className="label">Informations disponibles</p>
                {f.provided.length === 0 ? (
                  <p className="text-xs text-navy-400">Aucune information saisie pour l’instant.</p>
                ) : (
                  <ul className="space-y-1">
                    {f.provided.map((p, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-navy-600">
                        <CheckCircle2 className={`h-3.5 w-3.5 ${p.validated ? 'text-emerald-500' : 'text-amber-500'}`} />
                        <span className="truncate">{p.label} : <strong>{p.value}</strong>{!p.validated && ' (à valider)'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="label">Informations requises</p>
                {f.missing.length === 0 ? (
                  <p className="text-xs text-emerald-600">Toutes les informations nécessaires sont disponibles.</p>
                ) : (
                  <ul className="space-y-1">
                    {f.missing.map((m, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-navy-700">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
                        <span className="flex-1">{m.label}</span>
                        <button
                          className="link shrink-0 text-[11px]"
                          onClick={() => onProvide(targetForFinding(f, m.key, m.label))}
                        >
                          Renseigner
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md bg-navy-50/60 px-3 py-2 text-xs text-navy-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
              <span>{f.recommendation}</span>
            </div>
            {f.status === 'pret' && (
              <button className="btn-ghost btn-sm" onClick={onGoRetraitements}>
                Voir le retraitement proposé <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function targetForFinding(f: Finding, reqKey: string, label: string): { norm: string; scope: string; key: string; label: string } {
  const account = f.accounts[0]?.code ?? '';
  if (f.analyzer === 'ias16' && reqKey.includes(':')) {
    const [code, key] = reqKey.split(':');
    return { norm: f.normCode, scope: `ias16:${code}`, key, label };
  }
  if (f.analyzer === 'ias38') return { norm: f.normCode, scope: `ias38:${account}`, key: reqKey, label };
  if (f.analyzer === 'ias37') return { norm: f.normCode, scope: `ias37:${account}`, key: reqKey, label };
  if (f.analyzer === 'ifrs16') return { norm: f.normCode, scope: `ifrs16:CONTRAT-1`, key: reqKey, label };
  return { norm: f.normCode, scope: '', key: reqKey, label };
}

function MappingsTable({ mappings, onChanged }: { mappings: Mapping[]; onChanged: () => void }) {
  const { notify } = useApp();
  const [edit, setEdit] = useState<Mapping | null>(null);

  if (mappings.length === 0)
    return <EmptyState title="Aucune correspondance" description="Lancez l’analyse pour générer les correspondances CGNC → IFRS." />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-navy-600">Correspondance automatique des comptes vers les rubriques IFRS. Modifiable manuellement.</p>
      <TableWrap className="rounded-lg border border-navy-100">
        <table className="min-w-full">
          <thead className="bg-navy-50/60">
            <tr>
              <th className="th">Compte</th>
              <th className="th">Libellé</th>
              <th className="th">Rubrique IFRS</th>
              <th className="th">Groupe</th>
              <th className="th">Norme</th>
              <th className="th">Statut</th>
              <th className="th">Origine</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {mappings.map((m) => (
              <tr key={m.id} className="hover:bg-navy-50/40">
                <td className="td font-mono text-xs">{m.account_code}</td>
                <td className="td text-sm">{m.account_label}</td>
                <td className="td text-sm">{m.ifrs_line || <span className="text-amber-600">À classer</span>}</td>
                <td className="td text-xs text-navy-500">{m.ifrs_group || '—'}</td>
                <td className="td"><span className={`chip border ${normColor(m.norm_code)}`}>{m.norm_code}</span></td>
                <td className="td"><StatusChip status={m.status} /></td>
                <td className="td text-xs text-navy-500">{m.origin === 'manuel' ? 'Manuel' : 'Automatique'}</td>
                <td className="td">
                  <button className="text-navy-400 hover:text-navy-700" onClick={() => setEdit(m)}>
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Ajuster la correspondance">
        {edit && (
          <div className="space-y-3">
            <Field label="Compte"><input className="input" value={edit.account_code} disabled /></Field>
            <Field label="Rubrique IFRS"><input className="input" value={edit.ifrs_line} onChange={(e) => setEdit({ ...edit, ifrs_line: e.target.value })} /></Field>
            <Field label="Groupe IFRS">
              <select className="input" value={edit.ifrs_group} onChange={(e) => setEdit({ ...edit, ifrs_group: e.target.value })}>
                {['ACTIF_NON_COURANT', 'ACTIF_COURANT', 'CAPITAUX_PROPRES', 'PASSIF_NON_COURANT', 'PASSIF_COURANT', 'CHARGE', 'PRODUIT', 'IMPOT'].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label="Norme"><input className="input" value={edit.norm_code} onChange={(e) => setEdit({ ...edit, norm_code: e.target.value })} /></Field>
            <Field label="Justification"><textarea className="input" rows={3} value={edit.justification} onChange={(e) => setEdit({ ...edit, justification: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEdit(null)}>Annuler</button>
              <button
                className="btn-primary"
                onClick={async () => {
                  try {
                    await api.patch(`/mappings/${edit.id}`, { ifrs_line: edit.ifrs_line, ifrs_group: edit.ifrs_group, norm_code: edit.norm_code, justification_manual: edit.justification });
                    notify('Correspondance mise à jour.', 'success');
                    setEdit(null);
                    onChanged();
                  } catch (e: any) {
                    notify(e?.message || 'Mise à jour impossible.', 'error');
                  }
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function AssumptionsPanel({
  assumptions,
  onChanged,
  editorOpen,
  prefill,
  setEditorOpen,
  setPrefill,
}: {
  assumptions: Assumption[];
  onChanged: () => void;
  editorOpen: boolean;
  prefill: { norm: string; scope: string; key: string; label: string } | null;
  setEditorOpen: (b: boolean) => void;
  setPrefill: (p: any) => void;
}) {
  const { notify } = useApp();
  const [edit, setEdit] = useState<Assumption | null>(null);
  const grouped = useMemo(() => {
    const m = new Map<string, Assumption[]>();
    for (const a of assumptions) {
      const k = a.norm_code;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [assumptions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-navy-600">
          Renseignez ici les faits et hypothèses nécessaires aux calculs. Chaque information est tracée (source, nature, validation). Aucun retraitement n’est chiffré sans ces éléments.
        </p>
        <button
          className="btn-primary btn-sm shrink-0"
          onClick={() => {
            setPrefill(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Ajouter une information
        </button>
      </div>

      {assumptions.length === 0 && <EmptyState title="Aucune information saisie" description="Ajoutez les données nécessaires (durées d’utilité, taux, loyers…) pour permettre les calculs." />}

      {grouped.map(([norm, list]) => (
        <div key={norm} className="rounded-lg border border-navy-100">
          <div className="flex items-center gap-2 border-b border-navy-100 bg-navy-50/40 px-4 py-2">
            <span className={`chip border ${normColor(norm)}`}>{norm}</span>
            <span className="text-xs text-navy-500">{list.length} information(s)</span>
          </div>
          <TableWrap>
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="th">Périmètre</th>
                  <th className="th">Clé</th>
                  <th className="th">Libellé</th>
                  <th className="th">Valeur</th>
                  <th className="th">Nature</th>
                  <th className="th">Source</th>
                  <th className="th">Validée</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {list.map((a) => (
                  <tr key={a.id} className="hover:bg-navy-50/40">
                    <td className="td text-xs text-navy-500">{a.scope || '—'}</td>
                    <td className="td font-mono text-xs">{a.key}</td>
                    <td className="td text-sm">{a.label}</td>
                    <td className="td text-sm font-medium">
                      {a.value}
                      {a.unit ? <span className="ml-1 text-xs text-navy-400">{a.unit}</span> : null}
                    </td>
                    <td className="td"><Badge>{a.kind === 'hypothese' ? 'Hypothèse' : 'Fait'}</Badge></td>
                    <td className="td text-xs text-navy-500">{a.source || '—'}</td>
                    <td className="td">
                      <input
                        type="checkbox"
                        checked={!!a.validated}
                        onChange={async (e) => {
                          await api.patch(`/assumptions/${a.id}`, { validated: e.target.checked });
                          onChanged();
                        }}
                      />
                    </td>
                    <td className="td">
                      <div className="flex gap-1">
                        <button className="text-navy-400 hover:text-navy-700" onClick={() => setEdit(a)}>
                          <Save className="h-3.5 w-3.5" />
                        </button>
                        <ConfirmButton
                          className="text-navy-400 hover:text-red-600"
                          confirmLabel="Supprimer ?"
                          onConfirm={async () => {
                            await api.del(`/assumptions/${a.id}`);
                            notify('Information supprimée.', 'success');
                            onChanged();
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </ConfirmButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      ))}

      <AssumptionEditor
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setPrefill(null);
        }}
        prefill={prefill}
        onSaved={onChanged}
      />
      <AssumptionEditor open={!!edit} onClose={() => setEdit(null)} prefill={null} existing={edit} onSaved={onChanged} />
    </div>
  );
}

function AssumptionEditor({
  open,
  onClose,
  prefill,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  prefill: { norm: string; scope: string; key: string; label: string } | null;
  existing?: Assumption | null;
  onSaved: () => void;
}) {
  const { current, notify } = useApp();
  const [form, setForm] = useState({ norm_code: '', scope: '', key: '', label: '', value: '', unit: '', kind: 'hypothese', source: '', note: '' });

  useEffect(() => {
    if (existing) {
      setForm({
        norm_code: existing.norm_code,
        scope: existing.scope,
        key: existing.key,
        label: existing.label,
        value: existing.value,
        unit: existing.unit,
        kind: existing.kind,
        source: existing.source,
        note: existing.note,
      });
    } else if (prefill) {
      setForm({ norm_code: prefill.norm, scope: prefill.scope, key: prefill.key, label: prefill.label, value: '', unit: '', kind: 'hypothese', source: '', note: '' });
    } else {
      setForm({ norm_code: '', scope: '', key: '', label: '', value: '', unit: '', kind: 'hypothese', source: '', note: '' });
    }
  }, [existing, prefill, open]);

  async function save() {
    if (!current) return;
    if (!form.norm_code || !form.key || !form.label) {
      notify('Norme, clé et libellé sont obligatoires.', 'error');
      return;
    }
    try {
      if (existing) {
        await api.patch(`/assumptions/${existing.id}`, form);
      } else {
        await api.post(`/dossiers/${current.id}/assumptions`, { ...form, validated: true });
      }
      notify('Information enregistrée.', 'success');
      onSaved();
      onClose();
    } catch (e: any) {
      notify(e?.message || 'Enregistrement impossible.', 'error');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Modifier l’information' : 'Ajouter une information'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={save}>Enregistrer</button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Norme" required hint="Ex. IAS 16, IFRS 16, IAS 12">
            <input className="input" value={form.norm_code} onChange={(e) => setForm({ ...form, norm_code: e.target.value })} placeholder="IAS 16" />
          </Field>
          <Field label="Périmètre (scope)" hint="Ex. ias16:2340, ifrs16:CONTRAT-1, ias12">
            <input className="input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="ias16:2340" />
          </Field>
          <Field label="Clé" required hint="Ex. useful_life_years, discount_rate">
            <input className="input font-mono text-xs" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="useful_life_years" />
          </Field>
          <Field label="Nature">
            <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="hypothese">Hypothèse de l’exercice</option>
              <option value="fait">Fait constaté / documenté</option>
            </select>
          </Field>
        </div>
        <Field label="Libellé" required>
          <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Durée d’utilité estimée en IFRS (années)" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valeur" required>
            <input className="input" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="5" />
          </Field>
          <Field label="Unité">
            <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="années, MAD, taux…" />
          </Field>
        </div>
        <Field label="Source">
          <input className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Dossier d’immobilisations, contrat, note fiscale…" />
        </Field>
        <Field label="Note">
          <textarea className="input" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
