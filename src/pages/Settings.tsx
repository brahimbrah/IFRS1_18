import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  FlaskConical,
  KeyRound,
  Layers,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/store';
import { dateFr, statusLabel } from '../lib/format';
import { Banner, Card, CardHeader, ConfirmButton, Field, Loading, StatusChip } from '../components/ui';
import type { Dossier, Settings as SettingsType } from '../lib/types';

type SettingsResponse = {
  settings: SettingsType;
  aiStatus: { ready: boolean; reason: string };
  referential: { norms: number; paragraphs: number };
};

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI / compatible (endpoint /chat/completions)' },
  { value: 'anthropic', label: 'Anthropic (Messages API)' },
];

export default function Settings() {
  const { dossiers, current, selectDossier, refreshDossiers, notify } = useApp();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [form, setForm] = useState<SettingsType | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [busyDemo, setBusyDemo] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<SettingsResponse>('/settings');
      setData(res);
      setForm(res.settings);
    } catch (e: any) {
      setError(e?.message || 'Chargement des paramètres impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (k: keyof SettingsType, v: any) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await api.put('/settings', {
        ai_enabled: form.ai_enabled,
        ai_provider: form.ai_provider,
        ai_model: form.ai_model,
        ai_base_url: form.ai_base_url,
        ai_temperature: Number(form.ai_temperature),
        allow_external_ai: form.allow_external_ai,
        default_currency: form.default_currency,
        default_exercise: form.default_exercise,
        ...(apiKey.trim() ? { ai_api_key: apiKey.trim() } : {}),
      });
      setApiKey('');
      await load();
      notify('Paramètres enregistrés.', 'success');
    } catch (e: any) {
      notify(e?.message || 'Enregistrement impossible.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function clearKey() {
    try {
      await api.put('/settings', { clear_api_key: true });
      await load();
      notify('Clé API supprimée.', 'success');
    } catch (e: any) {
      notify(e?.message || 'Suppression impossible.', 'error');
    }
  }

  async function launchDemo() {
    setBusyDemo(true);
    try {
      const res = await api.post<{ dossierId: string }>('/demo', {});
      await refreshDossiers();
      selectDossier(res.dossierId);
      notify('Dossier de démonstration créé et sélectionné.', 'success');
    } catch (e: any) {
      notify(e?.message || 'Création impossible.', 'error');
    } finally {
      setBusyDemo(false);
    }
  }

  async function resetDemo() {
    try {
      const res = await api.del<{ removed: number }>('/demo');
      await refreshDossiers();
      selectDossier(null);
      notify(`${res.removed} dossier(s) de démonstration supprimé(s).`, 'success');
    } catch (e: any) {
      notify(e?.message || 'Réinitialisation impossible.', 'error');
    }
  }

  async function removeDossier(id: string, name: string) {
    try {
      await api.del(`/dossiers/${id}`);
      const list = await refreshDossiers();
      if (current?.id === id) selectDossier(list[0]?.id ?? null);
      notify(`Dossier « ${name} » supprimé.`, 'success');
    } catch (e: any) {
      notify(e?.message || 'Suppression impossible.', 'error');
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold text-navy-900">Paramètres</h1>
        <Card><Loading /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Paramètres</h1>
        <p className="text-sm text-navy-500">
          Configuration de l’assistant IA (facultatif), référentiel normatif et gestion des dossiers.
        </p>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {/* Statut IA */}
      {data && (
        <Card className="card-pad">
          <div className="flex flex-wrap items-start gap-3">
            {data.aiStatus.ready ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy-800">
                {data.aiStatus.ready ? 'Assistant IA actif' : 'Assistant IA inactif — le moteur déterministe fonctionne seul'}
              </p>
              <p className="mt-0.5 text-xs text-navy-500">{data.aiStatus.reason}</p>
            </div>
            <span className={`chip border ${data.aiStatus.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-navy-200 bg-navy-50 text-navy-600'}`}>
              {data.aiStatus.ready ? 'IA prête' : 'IA non configurée'}
            </span>
          </div>
          <Banner kind="info" className="mt-3">
            Le moteur de calcul déterministe identifie les divergences, calcule les retraitements et produit les états financiers sans IA.
            L’IA n’intervient que pour enrichir les explications et l’assistant : elle ne produit jamais de montant définitif.
          </Banner>
        </Card>
      )}

      {form && (
        <Card>
          <CardHeader title="Configuration de l’IA" subtitle="Facultatif — la clé reste stockée côté serveur et n’est jamais renvoyée au navigateur" icon={<Bot className="h-5 w-5" />} />
          <div className="card-pad space-y-4">
            <label className="flex items-start gap-3 rounded-lg border border-navy-100 p-3.5">
              <input type="checkbox" className="mt-1" checked={form.ai_enabled} onChange={(e) => set('ai_enabled', e.target.checked)} />
              <span>
                <span className="block text-sm font-semibold text-navy-900">Activer l’assistant IA</span>
                <span className="block text-xs text-navy-500">Enrichit l’analyse et le chat. Sans IA, l’assistant répond de façon déterministe à partir des données du dossier.</span>
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fournisseur">
                <select className="input" value={form.ai_provider} onChange={(e) => set('ai_provider', e.target.value)}>
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Modèle" hint="Ex. gpt-4o-mini, claude-3-5-sonnet…">
                <input className="input" value={form.ai_model} onChange={(e) => set('ai_model', e.target.value)} placeholder="gpt-4o-mini" />
              </Field>
              <Field label="URL de base (facultatif)" hint="Pour un endpoint compatible OpenAI auto-hébergé.">
                <input className="input" value={form.ai_base_url} onChange={(e) => set('ai_base_url', e.target.value)} placeholder="https://api.openai.com/v1" />
              </Field>
              <Field label="Température" hint="0 = réponses strictes et reproductibles.">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  className="input"
                  value={form.ai_temperature}
                  onChange={(e) => set('ai_temperature', Number(e.target.value))}
                />
              </Field>
            </div>

            <Field label="Clé API" hint={form.ai_api_key_set ? `Clé enregistrée : ${form.ai_api_key_hint}. Saisissez une nouvelle clé pour la remplacer.` : 'Aucune clé enregistrée.'}>
              <div className="flex items-center gap-2">
                <span className="relative flex-1">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
                  <input
                    type="password"
                    className="input pl-9"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={form.ai_api_key_set ? '••••••••  (laisser vide pour conserver)' : 'sk-…'}
                    autoComplete="off"
                  />
                </span>
                {form.ai_api_key_set && (
                  <ConfirmButton className="btn-ghost btn-sm" onConfirm={clearKey} confirmLabel="Confirmer la suppression ?">
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </ConfirmButton>
                )}
              </div>
            </Field>

            <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3.5">
              <input type="checkbox" className="mt-1" checked={form.allow_external_ai} onChange={(e) => set('allow_external_ai', e.target.checked)} />
              <span>
                <span className="block text-sm font-semibold text-amber-900">Autoriser l’envoi de données au modèle externe</span>
                <span className="block text-xs text-amber-800">
                  Requis pour activer l’IA. Les données transmises se limitent aux comptes et montants du dossier analysé.
                </span>
              </span>
            </label>

            <div className="grid gap-4 border-t border-navy-100 pt-4 sm:grid-cols-2">
              <Field label="Devise par défaut">
                <select className="input" value={form.default_currency} onChange={(e) => set('default_currency', e.target.value)}>
                  <option value="MAD">MAD — Dirham marocain</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="USD">USD — Dollar américain</option>
                </select>
              </Field>
              <Field label="Exercice par défaut" hint="Pré-remplit la création de nouveaux dossiers.">
                <input className="input" value={form.default_exercise} onChange={(e) => set('default_exercise', e.target.value)} placeholder="2025" />
              </Field>
            </div>

            <div className="flex justify-end border-t border-navy-100 pt-4">
              <button className="btn-primary" onClick={save} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Référentiel */}
      {data && (
        <Card>
          <CardHeader title="Référentiel normatif" subtitle="Base des normes et paragraphes utilisée par le moteur" icon={<Layers className="h-5 w-5" />} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <StatBox icon={<Database className="h-4 w-4" />} label="Normes enregistrées" value={data.referential.norms} />
            <StatBox icon={<ShieldCheck className="h-4 w-4" />} label="Paragraphes référencés" value={data.referential.paragraphs} />
          </div>
          <div className="border-t border-navy-100 px-5 py-3 text-xs text-navy-500">
            Les numéros de paragraphe non validés sont signalés « Référence à vérifier ». Gérez le référentiel depuis la{' '}
            <a href="/normes" className="link">bibliothèque des normes</a>.
          </div>
        </Card>
      )}

      {/* Démonstration */}
      <Card>
        <CardHeader title="Mode démonstration" subtitle="Dossier fictif cohérent et équilibré pour tester la chaîne complète" icon={<FlaskConical className="h-5 w-5" />} />
        <div className="card-pad space-y-3">
          <p className="text-sm text-navy-600">
            Crée un dossier de démonstration (machine amortissable IAS 16, contrat de location IFRS 16, impôt différé IAS 12) déjà analysé.
            Les retraitements sont créés « À valider » pour exercer le circuit de validation.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-accent btn-sm" onClick={launchDemo} disabled={busyDemo}>
              <FlaskConical className="h-4 w-4" /> {busyDemo ? 'Création…' : 'Lancer une démonstration'}
            </button>
            <ConfirmButton className="btn-ghost btn-sm" onConfirm={resetDemo} confirmLabel="Supprimer tous les dossiers de démonstration ?">
              <RefreshCw className="h-4 w-4" /> Réinitialiser les démonstrations
            </ConfirmButton>
          </div>
        </div>
      </Card>

      {/* Dossiers */}
      <Card>
        <CardHeader
          title="Dossiers"
          subtitle={`${dossiers.length} dossier(s) enregistré(s)`}
          icon={<Server className="h-5 w-5" />}
          right={
            <button className="btn-ghost btn-sm" onClick={() => refreshDossiers()}>
              <RefreshCw className="h-4 w-4" /> Actualiser
            </button>
          }
        />
        {dossiers.length === 0 ? (
          <div className="p-5 text-sm text-navy-500">Aucun dossier. Créez une nouvelle conversion ou lancez une démonstration.</div>
        ) : (
          <div className="divide-y divide-navy-100">
            {dossiers.map((d) => (
              <DossierRow key={d.id} dossier={d} active={d.id === current?.id} onOpen={() => selectDossier(d.id)} onDelete={() => removeDossier(d.id, d.name)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-navy-100 px-4 py-3">
      <span className="text-teal-600">{icon}</span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">{label}</p>
        <p className="text-lg font-semibold text-navy-900">{value}</p>
      </div>
    </div>
  );
}

function DossierRow({ dossier, active, onOpen, onDelete }: { dossier: Dossier; active: boolean; onOpen: () => void; onDelete: () => void }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 px-5 py-3 ${active ? 'bg-navy-50/40' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-navy-800">{dossier.name}</p>
          {dossier.is_demo ? <span className="chip border border-teal-200 bg-teal-50 text-teal-700">Démo</span> : null}
          {active ? <span className="chip border border-navy-200 bg-navy-50 text-navy-600">Actif</span> : null}
        </div>
        <p className="mt-0.5 text-xs text-navy-500">
          {dossier.company_name} · exercice {dossier.exercice} · clôture {dateFr(dossier.closing_date)} · {dossier.lines ?? 0} compte(s) ·{' '}
          {dossier.adjustments ?? 0} retraitement(s)
        </p>
      </div>
      <StatusChip status={dossier.status} />
      {!active && (
        <button className="btn-ghost btn-sm" onClick={onOpen}>
          Ouvrir
        </button>
      )}
      <ConfirmButton className="btn-ghost btn-sm text-red-600" onConfirm={onDelete} confirmLabel="Confirmer la suppression ?">
        <Trash2 className="h-4 w-4" /> Supprimer
      </ConfirmButton>
    </div>
  );
}
