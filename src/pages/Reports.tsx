import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { api, downloadFile } from '../lib/api';
import { useApp } from '../lib/store';
import { dateTimeFr } from '../lib/format';
import { Banner, Card, CardHeader, EmptyState, ErrorState, Loading, StatusChip, TableWrap } from '../components/ui';
import NoDossier from '../components/RequireDossier';
import type { Control } from '../lib/types';

type ControlsResponse = { controls: Control[]; summary: { conforme: number; a_verifier: number; bloquant: number } };

const EXPORTS = [
  {
    id: 'passage',
    path: 'passage.xlsx',
    label: 'Tableau de passage CGNC → IFRS',
    desc: 'Soldes CGNC, reclassements, ajustements et soldes IFRS par rubrique, avec la traçabilité des retraitements.',
    icon: FileSpreadsheet,
    scoped: true,
  },
  {
    id: 'synthesis',
    path: 'synthesis.xlsx',
    label: 'Synthèse des retraitements',
    desc: 'Liste des retraitements identifiés : norme, poste, montant, statut et justification.',
    icon: FileSpreadsheet,
    scoped: true,
  },
  {
    id: 'entries',
    path: 'entries.xlsx',
    label: 'Écritures de retraitement',
    desc: 'Écritures comptables détaillées (débit / crédit) générées par le moteur déterministe.',
    icon: FileSpreadsheet,
    scoped: false,
  },
  {
    id: 'balance',
    path: 'balance.xlsx',
    label: 'Balance CGNC de référence',
    desc: 'Balance générale d’origine utilisée comme source de référence de la conversion.',
    icon: FileSpreadsheet,
    scoped: false,
  },
  {
    id: 'report',
    path: 'report.pdf',
    label: 'Rapport de conversion IFRS',
    desc: 'Rapport complet : périmètre, méthodologie, tableau de passage, états retraités, contrôles et réserves.',
    icon: FileText,
    scoped: true,
  },
];

export default function Reports() {
  const { current, notify } = useApp();
  const [scope, setScope] = useState<'valides' | 'tous'>('valides');
  const [data, setData] = useState<ControlsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!current) return;
    setLoading(true);
    setError('');
    try {
      setData(await api.get<ControlsResponse>(`/dossiers/${current.id}/controls`));
    } catch (e: any) {
      setError(e?.message || 'Chargement des contrôles impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return <NoDossier hint="Sélectionnez un dossier pour produire les rapports et exports." />;

  async function download(path: string, filename: string, id: string, scoped: boolean) {
    setBusy(id);
    try {
      const query = scoped ? `?scope=${scope}` : '';
      await downloadFile(`/dossiers/${current!.id}/export/${path}${query}`, filename);
      notify('Export généré.', 'success');
    } catch (e: any) {
      notify(e?.message || 'Export impossible.', 'error');
    } finally {
      setBusy(null);
    }
  }

  const summary = data?.summary;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Rapports et exports</h1>
          <p className="text-sm text-navy-500">
            Contrôles qualité obligatoires et production des livrables (Excel / PDF).
          </p>
        </div>
        <div className="flex rounded-lg border border-navy-200 bg-white p-0.5">
          <button className={`rounded-md px-3 py-1 text-xs font-medium ${scope === 'valides' ? 'bg-navy-700 text-white' : 'text-navy-600'}`} onClick={() => setScope('valides')}>
            Retraitements validés
          </button>
          <button className={`rounded-md px-3 py-1 text-xs font-medium ${scope === 'tous' ? 'bg-navy-700 text-white' : 'text-navy-600'}`} onClick={() => setScope('tous')}>
            Portée provisoire (tous)
          </button>
        </div>
      </div>

      {scope === 'tous' && (
        <Banner kind="warn" title="Portée provisoire">
          Les exports marqués « portée » incluent tous les retraitements non rejetés, y compris ceux qui ne sont pas encore approuvés.
          Les états définitifs n’intègrent que les retraitements validés.
        </Banner>
      )}

      {/* Exports */}
      <Card>
        <CardHeader title="Livrables" subtitle="Fichiers générés par le moteur déterministe" icon={<Download className="h-5 w-5" />} />
        <div className="divide-y divide-navy-100">
          {EXPORTS.map((x) => {
            const Icon = x.icon;
            const ext = x.path.endsWith('.pdf') ? 'pdf' : 'xlsx';
            const filename = `${x.id}-${current.exercice}.${ext}`;
            return (
              <div key={x.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <Icon className="h-5 w-5 shrink-0 text-teal-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-navy-800">
                    {x.label}
                    {x.scoped && <span className="ml-2 chip border border-navy-200 bg-navy-50 text-[11px] text-navy-600">portée : {scope === 'valides' ? 'validés' : 'tous'}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-navy-500">{x.desc}</p>
                </div>
                <button
                  className="btn-ghost btn-sm"
                  disabled={busy === x.id}
                  onClick={() => download(x.path, filename, x.id, x.scoped)}
                >
                  <Download className="h-4 w-4" /> {busy === x.id ? 'Génération…' : ext === 'pdf' ? 'PDF' : 'Excel'}
                </button>
              </div>
            );
          })}
        </div>
        <div className="border-t border-navy-100 px-5 py-3 text-xs text-navy-500">
          Les exports reprennent exclusivement les montants calculés par le moteur déterministe. Aucune valeur n’est inventée.
        </div>
      </Card>

      {/* Contrôles */}
      <Card>
        <CardHeader
          title="Contrôles qualité obligatoires"
          subtitle="13 contrôles — « Conforme », « À vérifier » ou « Bloquant »"
          icon={<ShieldCheck className="h-5 w-5" />}
          right={
            <button className="btn-ghost btn-sm" onClick={load} disabled={loading}>
              Actualiser
            </button>
          }
        />

        {summary && (
          <div className="grid gap-3 border-b border-navy-100 px-5 py-4 sm:grid-cols-3">
            <SummaryCard label="Conformes" value={summary.conforme} tone="good" icon={<CheckCircle2 className="h-4 w-4" />} />
            <SummaryCard label="À vérifier" value={summary.a_verifier} tone="warn" icon={<AlertTriangle className="h-4 w-4" />} />
            <SummaryCard label="Bloquants" value={summary.bloquant} tone="bad" icon={<XCircle className="h-4 w-4" />} />
          </div>
        )}

        {summary && summary.bloquant > 0 && (
          <div className="px-5 pt-4">
            <Banner kind="error" title="Validation bloquée">
              Au moins un contrôle bloquant empêche la production d’états financiers définitifs. Corrigez les données d’origine ou les
              écritures concernées avant de valider.
            </Banner>
          </div>
        )}

        {error && <div className="p-5"><ErrorState message={error} onRetry={load} /></div>}
        {loading && !data && <div className="p-5"><Loading /></div>}

        {data && data.controls.length === 0 && (
          <EmptyState title="Aucun contrôle disponible" description="Importez des données comptables pour activer les contrôles qualité." icon={<ShieldCheck className="h-5 w-5" />} />
        )}

        {data && data.controls.length > 0 && (
          <TableWrap>
            <table className="min-w-full">
              <thead className="bg-navy-50/60">
                <tr>
                  <th className="th">Contrôle</th>
                  <th className="th">Statut</th>
                  <th className="th">Détail</th>
                  <th className="th text-right">Valeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {data.controls.map((c) => (
                  <tr key={c.id} className="align-top hover:bg-navy-50/30">
                    <td className="td text-sm font-medium text-navy-800">{c.label}</td>
                    <td className="td"><StatusChip status={c.status} /></td>
                    <td className="td text-xs text-navy-600 max-w-xl">{c.detail}</td>
                    <td className="td text-right num text-sm">{c.value || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Card className="card-pad">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
          <div className="text-sm text-navy-600">
            <p className="font-medium text-navy-800">Piste d’audit</p>
            <p className="mt-0.5">
              Chaque export est rattaché au dossier « {current.name} » ({current.company_name}, exercice {current.exercice}). Les retraitements
              repris sont listés dans <Link to="/etats-financiers" className="link">États financiers IFRS</Link>. Dernier contrôle chargé : {dateTimeFr(new Date().toISOString())}.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, tone, icon }: { label: string; value: number; tone: 'good' | 'warn' | 'bad'; icon: ReactNode }) {
  const cls = tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="flex items-center gap-3 rounded-lg border border-navy-100 px-4 py-3">
      <span className={cls}>{icon}</span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">{label}</p>
        <p className={`text-lg font-semibold ${cls}`}>{value}</p>
      </div>
    </div>
  );
}
