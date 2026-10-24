import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FlaskConical,
  Layers,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { useApp } from '../lib/store';
import { amount, dateFr, money, normColor, statusLabel } from '../lib/format';
import { Banner, Card, CardHeader, ErrorState, Loading, Num, Stat, StatusChip } from '../components/ui';
import NoDossier from '../components/RequireDossier';
import type { Adjustment } from '../lib/types';

type DashboardData = {
  cards: {
    dossiers: number;
    documents: number;
    lines: number;
    adjustments: number;
    approved: number;
    pending: number;
    needsInfo: number;
    missingInfoItems: number;
    equityImpact: number;
    normsUsed: number;
    controls: { conforme: number; a_verifier: number; bloquant: number };
  };
  byNorm: { norm: string; impact: number; count: number }[];
  recentAdjustments: Adjustment[];
};

const STEPS = [
  { key: 'import', label: 'Import CGNC', to: '/documents', icon: FileSpreadsheet },
  { key: 'extract', label: 'Extraction & vérification', to: '/documents', icon: ShieldCheck },
  { key: 'analyse', label: 'Analyse des divergences', to: '/analyse', icon: Sparkles },
  { key: 'retrait', label: 'Retraitements IFRS', to: '/retraitements', icon: Wand2 },
  { key: 'validation', label: 'Validation', to: '/retraitements', icon: CheckCircle2 },
  { key: 'etats', label: 'États & passage', to: '/etats-financiers', icon: ScrollText },
];

export default function Dashboard() {
  const { current, dossiers, notify, refreshDossiers, selectDossier } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    setError('');
    api
      .get<DashboardData>(`/dossiers/${current.id}/dashboard`)
      .then(setData)
      .catch((e) => setError(e?.message || 'Chargement impossible.'))
      .finally(() => setLoading(false));
  }, [current]);

  if (!current) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold text-navy-900">Tableau de bord</h1>
        <Card>
          <CardHeader
            title="Bienvenue sur IFRS Bridge Maroc"
            subtitle="Convertissez une comptabilité CGNC en informations IAS/IFRS, étape par étape."
            icon={<Layers className="h-5 w-5" />}
            right={
              <Link to="/nouvelle-conversion" className="btn-primary btn-sm">
                <FileSpreadsheet className="h-4 w-4" /> Nouvelle conversion
              </Link>
            }
          />
          <div className="p-5 grid gap-4 sm:grid-cols-3">
            {[
              { t: 'Importer vos données CGNC', d: 'Balance générale, bilan, CPC ou saisie manuelle (Excel / CSV).', to: '/documents' },
              { t: 'Analyser les divergences', d: 'Le moteur compare vos comptes aux règles IAS/IFRS et identifie les écarts.', to: '/analyse' },
              { t: 'Produire le tableau de passage', d: 'Écritures équilibrées, validation, états financiers et exports PDF / Excel.', to: '/etats-financiers' },
            ].map((s) => (
              <Link key={s.t} to={s.to} className="rounded-lg border border-navy-100 p-4 hover:border-teal-300 hover:bg-teal-50/40 transition">
                <p className="text-sm font-semibold text-navy-900">{s.t}</p>
                <p className="mt-1 text-xs text-navy-500">{s.d}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-teal-700">
                  Ouvrir <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </Card>
        {dossiers.length > 0 && (
          <Card>
            <CardHeader title="Vos dossiers existants" icon={<Layers className="h-5 w-5" />} />
            <div className="divide-y divide-navy-100">
              {dossiers.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy-800 truncate">{d.name}</p>
                    <p className="text-xs text-navy-500">{d.company_name} · exercice {d.exercice} · {statusLabel(d.status)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.is_demo ? <span className="chip bg-teal-50 text-teal-700 border border-teal-200">Démo</span> : null}
                    <button className="btn-ghost btn-sm" onClick={() => selectDossier(d.id)}>
                      Ouvrir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">{current.name}</h1>
          <p className="text-sm text-navy-500">
            {current.company_name} · exercice clos le {dateFr(current.closing_date)} · {current.currency}
            {current.is_demo ? ' · dossier de démonstration' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/analyse" className="btn-ghost btn-sm">
            <Sparkles className="h-4 w-4" /> Analyse
          </Link>
          <Link to="/etats-financiers" className="btn-primary btn-sm">
            <ScrollText className="h-4 w-4" /> États financiers
          </Link>
        </div>
      </div>

      {current.is_demo && (
        <Banner kind="info" title="Dossier de démonstration">
          Les données sont fictives, cohérentes et équilibrées. Les hypothèses de calcul sont identifiées comme hypothèses de l’exercice pédagogique et doivent être validées.
        </Banner>
      )}

      {/* Étapes */}
      <Card className="card-pad">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center">
                <Link to={s.to} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-navy-50 whitespace-nowrap">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-100 text-navy-600 text-xs font-semibold">{i + 1}</span>
                  <Icon className="h-4 w-4 text-teal-600" />
                  <span className="text-xs font-medium text-navy-700">{s.label}</span>
                </Link>
                {i < STEPS.length - 1 && <span className="text-navy-300">›</span>}
              </div>
            );
          })}
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={() => api.get<DashboardData>(`/dossiers/${current.id}/dashboard`).then(setData)} />}
      {loading && !data && <Card><Loading /></Card>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Comptes dans la source" value={data.cards.lines} sub={`${data.cards.documents} document(s)`} icon={<FileSpreadsheet className="h-4 w-4" />} />
            <Stat
              label="Retraitements identifiés"
              value={data.cards.adjustments}
              sub={`${data.cards.approved} approuvé(s) · ${data.cards.pending} à valider`}
              icon={<Wand2 className="h-4 w-4" />}
              tone="accent"
            />
            <Stat
              label="Informations requises"
              value={data.cards.needsInfo}
              sub={`${data.cards.missingInfoItems} élément(s) manquant(s) — aucun montant inventé`}
              tone={data.cards.needsInfo ? 'warn' : 'good'}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <Stat
              label="Impact sur les capitaux propres"
              value={money(data.cards.equityImpact, current.currency)}
              sub="Effet cumulé des retraitements (portée « tous »)"
              tone={data.cards.equityImpact < 0 ? 'bad' : 'good'}
              icon={<Layers className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader title="Impact des retraitements par norme" subtitle="Montants calculés par le moteur déterministe" icon={<Layers className="h-5 w-5" />} />
              <div className="p-4 h-72">
                {data.byNorm.length === 0 ? (
                  <p className="text-sm text-navy-500 p-4">Aucun retraitement pour l’instant. Lancez l’analyse.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byNorm} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <XAxis dataKey="norm" tick={{ fontSize: 11 }} interval={0} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => amount(Number(v))} width={70} />
                      <Tooltip
                        formatter={(v: any) => [money(Number(v), current.currency), 'Impact']}
                        labelFormatter={(l, p) => `${l} — ${p?.[0]?.payload?.count ?? ''} retraitement(s)`}
                      />
                      <Bar dataKey="impact" radius={[4, 4, 0, 0]}>
                        {data.byNorm.map((n) => (
                          <Cell key={n.norm} fill={n.impact < 0 ? '#dc2626' : '#118d8c'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title="Contrôles qualité" subtitle="13 contrôles obligatoires" icon={<ShieldCheck className="h-5 w-5" />} />
              <div className="p-5 space-y-3">
                <ControlRow label="Conformes" value={data.cards.controls.conforme} tone="good" />
                <ControlRow label="À vérifier" value={data.cards.controls.a_verifier} tone="warn" />
                <ControlRow label="Bloquants" value={data.cards.controls.bloquant} tone="bad" />
                {data.cards.controls.bloquant > 0 ? (
                  <Banner kind="error" title="Validation bloquée">
                    Au moins un contrôle bloquant empêche la production d’états financiers définitifs.
                  </Banner>
                ) : (
                  <Banner kind="success">Aucun contrôle bloquant. Les retraitements non validés restent exclus des états définitifs.</Banner>
                )}
                <Link to="/rapports" className="btn-ghost btn-sm w-full">
                  Voir le tableau de contrôle complet
                </Link>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Derniers retraitements"
              subtitle="Aperçu des écritures proposées par le moteur"
              icon={<Wand2 className="h-5 w-5" />}
              right={
                <Link to="/retraitements" className="btn-ghost btn-sm">
                  Tout voir <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            {data.recentAdjustments.length === 0 ? (
              <div className="p-5">
                <Banner kind="warn" title="Aucun retraitement">
                  Ouvrez « Analyse intelligente » puis lancez l’analyse pour générer les retraitements.
                </Banner>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-navy-50/60">
                    <tr>
                      <th className="th">Réf.</th>
                      <th className="th">Poste CGNC</th>
                      <th className="th">Norme</th>
                      <th className="th text-right">Montant</th>
                      <th className="th">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {data.recentAdjustments.map((a) => (
                      <tr key={a.id} className="hover:bg-navy-50/40">
                        <td className="td font-mono text-xs">{a.ref}</td>
                        <td className="td">
                          <span className="block text-sm">{a.title}</span>
                          <span className="text-xs text-navy-400">{a.poste_cgnc}</span>
                        </td>
                        <td className="td">
                          <span className={`chip border ${normColor(a.norm_code)}`}>{a.norm_code}</span>
                        </td>
                        <td className="td">
                          <Num value={a.amount} currency={current.currency} strong />
                        </td>
                        <td className="td">
                          <StatusChip status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="card-pad">
            <div className="flex flex-wrap items-center gap-3">
              <FlaskConical className="h-5 w-5 text-teal-600" />
              <p className="text-sm text-navy-600 flex-1">
                Besoin d’un exemple complet ? Le mode démonstration crée un dossier fictif (machine IAS 16, contrat de location IFRS 16, impôt différé IAS 12) déjà analysé.
              </p>
              <button
                className="btn-accent btn-sm"
                onClick={async () => {
                  try {
                    const res = await api.post<{ dossierId: string }>('/demo', {});
                    await refreshDossiers();
                    selectDossier(res.dossierId);
                    notify('Dossier de démonstration créé et sélectionné.', 'success');
                    nav('/');
                  } catch (e: any) {
                    notify(e?.message || 'Erreur.', 'error');
                  }
                }}
              >
                <FlaskConical className="h-4 w-4" /> Lancer une démonstration
              </button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function ControlRow({ label, value, tone }: { label: string; value: number; tone: 'good' | 'warn' | 'bad' }) {
  const cls = tone === 'good' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />
      <span className="text-sm text-navy-700 flex-1">{label}</span>
      <span className="text-sm font-semibold text-navy-900">{value}</span>
    </div>
  );
}
