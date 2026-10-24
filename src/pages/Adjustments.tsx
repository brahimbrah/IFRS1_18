import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Filter, Wand2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/store';
import { money, normColor } from '../lib/format';
import { Banner, Card, CardHeader, EmptyState, ErrorState, Loading, Num, StatusChip, TableWrap, Tabs } from '../components/ui';
import NoDossier from '../components/RequireDossier';
import type { Adjustment } from '../lib/types';

export default function Adjustments() {
  const { current, notify } = useApp();
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!current) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ adjustments: Adjustment[] }>(`/dossiers/${current.id}/adjustments`);
      setAdjustments(res.adjustments);
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

  const counts = useMemo(() => {
    return {
      all: adjustments.length,
      a_valider: adjustments.filter((a) => a.status === 'a_valider').length,
      approuve: adjustments.filter((a) => a.status === 'approuve').length,
      infos: adjustments.filter((a) => a.status === 'informations_requises').length,
      autres: adjustments.filter((a) => ['rejete', 'modifie', 'justification_demandee'].includes(a.status)).length,
    };
  }, [adjustments]);

  const filtered = useMemo(() => {
    if (tab === 'all') return adjustments;
    if (tab === 'infos') return adjustments.filter((a) => a.status === 'informations_requises');
    if (tab === 'autres') return adjustments.filter((a) => ['rejete', 'modifie', 'justification_demandee'].includes(a.status));
    return adjustments.filter((a) => a.status === tab);
  }, [adjustments, tab]);

  if (!current) return <NoDossier hint="Sélectionnez un dossier pour consulter et valider les retraitements IFRS." />;

  async function generate() {
    if (!current) return;
    setBusy(true);
    try {
      const res = await api.post<{ saved: any }>(`/dossiers/${current.id}/adjustments/generate`, {});
      notify(`Retraitements régénérés : ${res.saved?.created ?? 0} créé(s), ${res.saved?.updated ?? 0} mis à jour.`, 'success');
      await load();
    } catch (e: any) {
      notify(e?.message || 'Génération impossible.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const totalImpact = adjustments.filter((a) => a.status !== 'rejete').reduce((s, a) => s + Number(a.amount || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Retraitements IFRS</h1>
          <p className="text-sm text-navy-500">Chaque retraitement est justifié, chiffré par le moteur et doit être validé avant d’intégrer les états définitifs.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={load}>
            <Filter className="h-4 w-4" /> Actualiser
          </button>
          <button className="btn-primary btn-sm" onClick={generate} disabled={busy}>
            <Wand2 className="h-4 w-4" /> {busy ? 'Génération…' : 'Régénérer les retraitements'}
          </button>
        </div>
      </div>

      {counts.infos > 0 && (
        <Banner kind="warn" title={`${counts.infos} retraitement(s) en attente d’informations complémentaires`}>
          Ces postes ne comportent aucun montant : aucune valeur n’est inventée. Complétez les informations dans « Analyse intelligente » puis régénérez les retraitements.
        </Banner>
      )}

      <Card>
        <CardHeader
          title="Synthèse"
          subtitle={`${counts.all} retraitement(s) · ${counts.approuve} approuvé(s) · impact cumulé ${money(totalImpact, current.currency)}`}
          right={<Link to="/etats-financiers" className="btn-ghost btn-sm">Tableau de passage <ArrowRight className="h-3.5 w-3.5" /></Link>}
        />
        <div className="px-3 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'all', label: 'Tous', count: counts.all },
              { id: 'a_valider', label: 'À valider', count: counts.a_valider },
              { id: 'approuve', label: 'Approuvés', count: counts.approuve },
              { id: 'infos', label: 'Informations requises', count: counts.infos },
              { id: 'autres', label: 'Autres', count: counts.autres },
            ]}
          />
        </div>
        <div className="card-pad">
          {error && <ErrorState message={error} onRetry={load} />}
          {loading && <Loading />}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState
              icon={<Wand2 className="h-6 w-6" />}
              title="Aucun retraitement"
              description="Lancez l’analyse depuis « Analyse intelligente » ou régénérez les retraitements."
            />
          )}
          {!loading && !error && filtered.length > 0 && (
            <TableWrap className="rounded-lg border border-navy-100">
              <table className="min-w-full">
                <thead className="bg-navy-50/60">
                  <tr>
                    <th className="th">Réf.</th>
                    <th className="th">Poste CGNC</th>
                    <th className="th">Norme</th>
                    <th className="th">Type</th>
                    <th className="th text-right">Montant</th>
                    <th className="th">Écriture</th>
                    <th className="th">Statut</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {filtered.map((a) => (
                    <tr key={a.id} className="hover:bg-navy-50/40">
                      <td className="td font-mono text-xs">{a.ref}</td>
                      <td className="td">
                        <span className="block text-sm text-navy-800">{a.title}</span>
                        <span className="text-xs text-navy-400">{a.poste_cgnc}</span>
                      </td>
                      <td className="td"><span className={`chip border ${normColor(a.norm_code)}`}>{a.norm_code}</span></td>
                      <td className="td text-xs text-navy-500">{a.category === 'reclassement' ? 'Reclassement' : 'Ajustement'}</td>
                      <td className="td"><Num value={a.amount} currency={current.currency} strong /></td>
                      <td className="td">
                        {a.entries.length === 0 ? (
                          <span className="text-xs text-orange-600">Aucune écriture</span>
                        ) : a.entryBalance.balanced ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Équilibrée</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> Déséquilibrée</span>
                        )}
                      </td>
                      <td className="td"><StatusChip status={a.status} /></td>
                      <td className="td">
                        <Link to={`/retraitements/${a.ref}`} className="btn-ghost btn-sm">
                          Fiche <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      </Card>
    </div>
  );
}
