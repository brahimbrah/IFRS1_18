import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CalendarClock, Check, CircleDollarSign, FileSpreadsheet, Flag, Layers, ScrollText } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/store';
import { dateFr } from '../lib/format';
import { Banner, Card, CardHeader, Field } from '../components/ui';
import type { Dossier } from '../lib/types';

const STEPS = [
  { id: 1, label: 'Entreprise', icon: Building2 },
  { id: 2, label: 'Exercice', icon: CalendarClock },
  { id: 3, label: 'Devise', icon: CircleDollarSign },
  { id: 4, label: 'Conversion', icon: Layers },
  { id: 5, label: 'Référentiel', icon: Flag },
  { id: 6, label: 'Périmètre', icon: FileSpreadsheet },
  { id: 7, label: 'Récapitulatif', icon: ScrollText },
];

const CONVERSION_TYPES = [
  { value: 'premiere_adoption', label: 'Première adoption (IFRS 1)', desc: 'Passage complet du CGNC aux IFRS pour la première fois.' },
  { value: 'transition', label: 'Transition d’exercice', desc: 'Conversion d’un exercice postérieur au premier passage.' },
  { value: 'presentation', label: 'Retraitement de présentation', desc: 'Réorganisation de la présentation sans changement de référentiel.' },
];

export default function NewConversion() {
  const { refreshDossiers, selectDossier, notify } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    company_name: '',
    ice: '',
    city: '',
    secteur: '',
    name: '',
    exercice: String(new Date().getFullYear() - 1),
    closing_date: `${new Date().getFullYear() - 1}-12-31`,
    currency: 'MAD',
    conversion_type: 'premiere_adoption',
    framework: 'IAS 1',
    scope: [] as string[],
    notes: '',
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  function canNext(): boolean {
    if (step === 1) return !!form.company_name.trim();
    if (step === 2) return !!form.closing_date && !!form.name.trim();
    return true;
  }

  async function create() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ dossier: Dossier }>('/dossiers', {
        name: form.name,
        company_name: form.company_name,
        exercice: form.exercice,
        closing_date: form.closing_date,
        currency: form.currency,
        conversion_type: form.conversion_type,
        framework: form.framework,
        notes: `${form.notes}${form.scope.length ? `\nPérimètre documentaire prévu : ${form.scope.join(', ')}.` : ''}`.trim(),
      });
      await refreshDossiers();
      selectDossier(res.dossier.id);
      notify('Dossier créé. Importez maintenant vos documents comptables.', 'success');
      nav('/documents');
    } catch (e: any) {
      setError(e?.message || 'Création impossible.');
    } finally {
      setBusy(false);
    }
  }

  const scopeOptions = ['Balance générale', 'Bilan CGNC', 'Compte de produits et charges', 'Journal', 'Détail des immobilisations', 'Contrats de location', 'Annexe provisions'];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Nouvelle conversion</h1>
        <p className="text-sm text-navy-500">Créez un dossier de conversion CGNC → IAS/IFRS en sept étapes.</p>
      </div>

      <Card className="card-pad">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 whitespace-nowrap transition ${
                    active ? 'bg-navy-800 text-white' : done ? 'text-teal-700' : 'text-navy-500 hover:bg-navy-50'
                  }`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${active ? 'bg-teal-500 text-navy-950' : done ? 'bg-teal-100 text-teal-700' : 'bg-navy-100'}`}>
                    {done ? <Check className="h-3.5 w-3.5" /> : s.id}
                  </span>
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <span className="text-navy-300">›</span>}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title={`Étape ${step} — ${STEPS[step - 1].label}`} subtitle="Les informations saisies ici pourront être modifiées ultérieurement dans les paramètres du dossier." />
        <div className="card-pad space-y-4">
          {error && <Banner kind="error">{error}</Banner>}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Raison sociale" required>
                <input className="input" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} placeholder="Ex. Atlas Composants SARL" />
              </Field>
              <Field label="ICE (identifiant commun de l’entreprise)">
                <input className="input" value={form.ice} onChange={(e) => set('ice', e.target.value)} placeholder="000000000000000" />
              </Field>
              <Field label="Ville">
                <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Casablanca" />
              </Field>
              <Field label="Secteur d’activité">
                <input className="input" value={form.secteur} onChange={(e) => set('secteur', e.target.value)} placeholder="Industrie, commerce, services…" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom du dossier" required hint="Par défaut : conversion IFRS — exercice.">
                <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={`Conversion IFRS ${form.exercice} — ${form.company_name || 'entreprise'}`} />
              </Field>
              <Field label="Exercice comptable" required>
                <input className="input" value={form.exercice} onChange={(e) => set('exercice', e.target.value)} placeholder="2025" />
              </Field>
              <Field label="Date de clôture" required>
                <input type="date" className="input" value={form.closing_date} onChange={(e) => set('closing_date', e.target.value)} />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Devise de présentation" required>
                <select className="input" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                  <option value="MAD">MAD — Dirham marocain</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="USD">USD — Dollar américain</option>
                </select>
              </Field>
              <div className="rounded-lg border border-navy-100 bg-navy-50/50 p-4 text-sm text-navy-600">
                La devise s’applique à l’ensemble des états financiers et des exports. Les montants importés doivent être exprimés dans cette devise.
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              {CONVERSION_TYPES.map((t) => (
                <label key={t.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${form.conversion_type === t.value ? 'border-teal-400 bg-teal-50/50' : 'border-navy-100 hover:bg-navy-50'}`}>
                  <input type="radio" className="mt-1" checked={form.conversion_type === t.value} onChange={() => set('conversion_type', t.value)} />
                  <span>
                    <span className="block text-sm font-semibold text-navy-900">{t.label}</span>
                    <span className="block text-xs text-navy-500">{t.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${form.framework === 'IAS 1' ? 'border-teal-400 bg-teal-50/50' : 'border-navy-100 hover:bg-navy-50'}`}>
                <input type="radio" className="mt-1" checked={form.framework === 'IAS 1'} onChange={() => set('framework', 'IAS 1')} />
                <span>
                  <span className="block text-sm font-semibold text-navy-900">IAS 1 — Présentation des états financiers</span>
                  <span className="block text-xs text-navy-500">Référentiel applicable aux exercices ouverts avant le 1er janvier 2027.</span>
                </span>
              </label>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${form.framework === 'IFRS 18' ? 'border-teal-400 bg-teal-50/50' : 'border-navy-100 hover:bg-navy-50'}`}>
                <input type="radio" className="mt-1" checked={form.framework === 'IFRS 18'} onChange={() => set('framework', 'IFRS 18')} />
                <span>
                  <span className="block text-sm font-semibold text-navy-900">IFRS 18 — Présentation et informations à fournir</span>
                  <span className="block text-xs text-navy-500">Applicable aux exercices ouverts à compter du 1er janvier 2027 (application anticipée permise).</span>
                </span>
              </label>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <p className="text-sm text-navy-600">Indiquez les documents que vous prévoyez d’importer (facultatif — aide à la préparation).</p>
              <div className="flex flex-wrap gap-2">
                {scopeOptions.map((s) => {
                  const active = form.scope.includes(s);
                  return (
                    <button
                      key={s}
                      className={`chip border ${active ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-navy-200 bg-white text-navy-600 hover:bg-navy-50'}`}
                      onClick={() => set('scope', active ? form.scope.filter((x) => x !== s) : [...form.scope, s])}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <Field label="Notes du dossier">
                <textarea className="input" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Contexte, particularités, points de vigilance…" />
              </Field>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Summary label="Raison sociale" value={form.company_name || '—'} />
                <Summary label="ICE" value={form.ice || '—'} />
                <Summary label="Ville" value={form.city || '—'} />
                <Summary label="Secteur" value={form.secteur || '—'} />
                <Summary label="Nom du dossier" value={form.name || `Conversion IFRS ${form.exercice} — ${form.company_name || 'entreprise'}`} />
                <Summary label="Exercice" value={form.exercice} />
                <Summary label="Clôture" value={dateFr(form.closing_date)} />
                <Summary label="Devise" value={form.currency} />
                <Summary label="Type" value={CONVERSION_TYPES.find((t) => t.value === form.conversion_type)?.label || ''} />
                <Summary label="Référentiel" value={form.framework} />
              </div>
              {form.scope.length > 0 && (
                <div>
                  <p className="label">Périmètre documentaire prévu</p>
                  <div className="flex flex-wrap gap-1.5">
                    {form.scope.map((s) => (
                      <span key={s} className="chip border border-navy-200 bg-navy-50 text-navy-700">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              <Banner kind="info">
                À la création, le dossier ne contient aucune donnée comptable. Vous importerez ensuite vos documents (Excel / CSV / PDF texte) ou saisirez une balance manuellement. Aucun montant n’est pré-rempli.
              </Banner>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-navy-100 pt-4">
            <button className="btn-ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
              <ArrowLeft className="h-4 w-4" /> Précédent
            </button>
            {step < 7 ? (
              <button className="btn-primary" onClick={() => setStep((s) => Math.min(7, s + 1))} disabled={!canNext()}>
                Suivant <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button className="btn-accent" onClick={create} disabled={busy}>
                {busy ? 'Création…' : 'Créer le dossier'} <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-navy-100 px-3.5 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">{label}</p>
      <p className="text-sm text-navy-800 mt-0.5">{value}</p>
    </div>
  );
}
