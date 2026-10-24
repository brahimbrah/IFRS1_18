import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Download, FileText, Layers, ScrollText, Table2 } from 'lucide-react';
import { api, downloadFile } from '../lib/api';
import { useApp } from '../lib/store';
import { money, normColor } from '../lib/format';
import { Banner, Card, CardHeader, CoverageBadge, EmptyState, ErrorState, Loading, Num, StatusChip, TableWrap, Tabs } from '../components/ui';
import NoDossier from '../components/RequireDossier';
import type { FinancialStatements, Passage, PassageRow } from '../lib/types';

const GROUP_LABELS: Record<string, string> = {
  ACTIF_NON_COURANT: 'Actifs non courants',
  ACTIF_COURANT: 'Actifs courants',
  CAPITAUX_PROPRES: 'Capitaux propres',
  PASSIF_NON_COURANT: 'Passifs non courants',
  PASSIF_COURANT: 'Passifs courants',
};

export default function Statements() {
  const { current, notify } = useApp();
  const [scope, setScope] = useState<'valides' | 'tous'>('valides');
  const [passage, setPassage] = useState<Passage | null>(null);
  const [statements, setStatements] = useState<FinancialStatements | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('passage');

  const load = async () => {
    if (!current) return;
    setLoading(true);
    setError('');
    try {
      const [p, s] = await Promise.all([
        api.get<{ passage: Passage }>(`/dossiers/${current.id}/passage?scope=${scope}`),
        api.get<{ statements: FinancialStatements }>(`/dossiers/${current.id}/statements?scope=${scope}`),
      ]);
      setPassage(p.passage);
      setStatements(s.statements);
    } catch (e: any) {
      setError(e?.message || 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, scope]);

  if (!current) return <NoDossier hint="Sélectionnez un dossier pour consulter les états financiers IFRS." />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">États financiers IFRS</h1>
          <p className="text-sm text-navy-500">Tableau de passage CGNC → IFRS et états retraités, produits par le moteur déterministe.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-navy-200 bg-white p-0.5">
            <button className={`rounded-md px-3 py-1 text-xs font-medium ${scope === 'valides' ? 'bg-navy-700 text-white' : 'text-navy-600'}`} onClick={() => setScope('valides')}>
              Retraitements validés
            </button>
            <button className={`rounded-md px-3 py-1 text-xs font-medium ${scope === 'tous' ? 'bg-navy-700 text-white' : 'text-navy-600'}`} onClick={() => setScope('tous')}>
              Portée provisoire (tous)
            </button>
          </div>
          <button className="btn-ghost btn-sm" onClick={() => downloadFile(`/dossiers/${current.id}/export/passage.xlsx?scope=${scope}`, `tableau-passage-${current.exercice}.xlsx`).catch((e) => notify(e.message, 'error'))}>
            <Download className="h-4 w-4" /> Excel
          </button>
          <button className="btn-primary btn-sm" onClick={() => downloadFile(`/dossiers/${current.id}/export/report.pdf?scope=${scope}`, `rapport-conversion-ifrs-${current.exercice}.pdf`).catch((e) => notify(e.message, 'error'))}>
            <FileText className="h-4 w-4" /> Rapport PDF
          </button>
        </div>
      </div>

      {scope === 'tous' && (
        <Banner kind="warn" title="Portée provisoire">
          Cette vue intègre tous les retraitements non rejetés, y compris ceux qui ne sont pas encore approuvés. Elle sert au contrôle : seuls les retraitements validés composent les états définitifs.
        </Banner>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {loading && !passage && <Card><Loading /></Card>}

      {passage && statements && (
        <Card>
          <div className="px-3 pt-2">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'passage', label: 'Tableau de passage' },
                { id: 'sofp', label: 'Situation financière' },
                { id: 'ploci', label: 'Résultat & OCI' },
                { id: 'cashflow', label: 'Flux de trésorerie' },
                { id: 'socie', label: 'Capitaux propres' },
                { id: 'notes', label: 'Notes' },
              ]}
            />
          </div>
          <div className="card-pad">
            {tab === 'passage' && <PassageView passage={passage} currency={current.currency} />}
            {tab === 'sofp' && <SofpView statements={statements} currency={current.currency} />}
            {tab === 'ploci' && <PlociView statements={statements} currency={current.currency} />}
            {tab === 'cashflow' && <CashflowView statements={statements} currency={current.currency} />}
            {tab === 'socie' && <SocieView statements={statements} currency={current.currency} />}
            {tab === 'notes' && <NotesView statements={statements} />}
          </div>
        </Card>
      )}

      {passage && (
        <Card>
          <CardHeader title="Retraitements intégrés" subtitle="Traçabilité des retraitements repris ou exclus selon la portée choisie" icon={<Layers className="h-5 w-5" />} />
          <TableWrap>
            <table className="min-w-full">
              <thead className="bg-navy-50/60">
                <tr>
                  <th className="th">Réf.</th>
                  <th className="th">Retraitement</th>
                  <th className="th">Norme</th>
                  <th className="th text-right">Montant</th>
                  <th className="th">Intégré</th>
                  <th className="th">Motif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {passage.adjustments.map((a) => (
                  <tr key={a.ref} className={a.included ? '' : 'bg-navy-50/30'}>
                    <td className="td font-mono text-xs">{a.ref}</td>
                    <td className="td text-sm">{a.title}</td>
                    <td className="td"><span className={`chip border ${normColor(a.norm)}`}>{a.norm}</span></td>
                    <td className="td"><Num value={a.amount} currency={current.currency} /></td>
                    <td className="td">
                      {a.included ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Intégré</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-orange-600"><AlertTriangle className="h-3.5 w-3.5" /> Exclu</span>
                      )}
                    </td>
                    <td className="td text-xs text-navy-500">{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}
    </div>
  );
}

function PassageView({ passage, currency }: { passage: Passage; currency: string }) {
  const b = passage.balance;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <BalanceCard label="Actif CGNC" value={money(b.actifCGNC, currency)} />
        <BalanceCard label="Actif IFRS" value={money(b.actifIFRS, currency)} tone="accent" />
        <BalanceCard
          label="Équation comptable IFRS"
          value={b.equilibreIFRS ? 'Équilibrée' : `Écart ${money(b.ecartIFRS, currency)}`}
          tone={b.equilibreIFRS ? 'good' : 'bad'}
        />
      </div>

      {passage.resultInjected && (
        <Banner kind="info">
          Le résultat de l’exercice a été reconstitué à partir des comptes de charges et de produits (le compte 119 est absent de la balance) et rattaché aux capitaux propres.
        </Banner>
      )}

      <div className="space-y-5">
        {passage.sections.map((sec) => (
          <div key={sec.group} className="rounded-lg border border-navy-100">
            <div className="flex items-center justify-between border-b border-navy-100 bg-navy-50/50 px-4 py-2">
              <h4 className="text-sm font-semibold text-navy-800">{sec.label}</h4>
              <span className="text-xs text-navy-500">Total IFRS : <strong>{money(sec.totalIFRS, currency)}</strong></span>
            </div>
            <TableWrap>
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="th">Rubrique IFRS</th>
                    <th className="th text-right">Solde CGNC</th>
                    <th className="th text-right">Reclassements</th>
                    <th className="th text-right">Ajustements</th>
                    <th className="th text-right">Solde IFRS</th>
                    <th className="th">Retraitements</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {sec.rows.map((r) => (
                    <PassageRowView key={r.rubric} row={r} currency={currency} />
                  ))}
                </tbody>
                <tfoot className="bg-navy-50/40">
                  <tr>
                    <td className="td text-xs font-semibold uppercase text-navy-500">Total {sec.label}</td>
                    <td className="td"><Num value={sec.totalCGNC} strong /></td>
                    <td className="td"><Num value={sec.totalReclassements} strong /></td>
                    <td className="td"><Num value={sec.totalAjustements} strong /></td>
                    <td className="td"><Num value={sec.totalIFRS} strong /></td>
                    <td className="td"></td>
                  </tr>
                </tfoot>
              </table>
            </TableWrap>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <BalanceCard label="Résultat CGNC" value={money(passage.result.resultatCGNC, currency)} />
        <BalanceCard label="Résultat IFRS" value={money(passage.result.resultatIFRS, currency)} tone="accent" />
        <BalanceCard label="Impact total sur les capitaux propres" value={money(passage.totalEquityImpact, currency)} tone={passage.totalEquityImpact < 0 ? 'bad' : 'good'} />
      </div>
    </div>
  );
}

function PassageRowView({ row, currency }: { row: PassageRow; currency: string }) {
  return (
    <tr className="hover:bg-navy-50/30">
      <td className="td text-sm">{row.rubric}</td>
      <td className="td"><Num value={row.soldeCGNC} /></td>
      <td className="td"><Num value={row.reclassements} /></td>
      <td className="td"><Num value={row.ajustements} /></td>
      <td className="td"><Num value={row.soldeIFRS} strong /></td>
      <td className="td">
        <div className="flex flex-wrap gap-1">
          {row.contributions.map((c, i) => (
            <span key={i} className={`chip border ${normColor(c.norm)}`} title={`${c.ref} — ${c.title}`}>
              {c.ref}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

function SofpView({ statements, currency }: { statements: FinancialStatements; currency: string }) {
  const s = statements.sofp;
  const Section = ({ title, rows }: { title: string; rows: { rubric: string; cgnc: number; ajustement: number; ifrs: number }[] }) => (
    <div className="rounded-lg border border-navy-100">
      <div className="border-b border-navy-100 bg-navy-50/50 px-4 py-2 text-sm font-semibold text-navy-800">{title}</div>
      <TableWrap>
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="th">Rubrique</th>
              <th className="th text-right">CGNC</th>
              <th className="th text-right">Retraitements</th>
              <th className="th text-right">IFRS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {rows.map((r) => (
              <tr key={r.rubric}>
                <td className="td text-sm">{r.rubric}</td>
                <td className="td"><Num value={r.cgnc} /></td>
                <td className="td"><Num value={r.ajustement} /></td>
                <td className="td"><Num value={r.ifrs} strong /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="td text-sm text-navy-400" colSpan={4}>Aucun poste.</td></tr>
            )}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <CoverageBadge status={s.coverage.status} />
        {s.coverage.reason && <span className="text-xs text-amber-700">{s.coverage.reason}</span>}
      </div>
      <Section title="Actifs non courants" rows={s.assetsNonCurrent} />
      <Section title="Actifs courants" rows={s.assetsCurrent} />
      <Section title="Capitaux propres" rows={s.equity} />
      <Section title="Passifs non courants" rows={s.liabilitiesNonCurrent} />
      <Section title="Passifs courants" rows={s.liabilitiesCurrent} />
      <div className="grid gap-3 sm:grid-cols-2">
        <BalanceCard label="Total actif IFRS" value={money(s.totals.actifIFRS, currency)} tone="accent" />
        <BalanceCard
          label="Capitaux propres + passifs IFRS"
          value={money(s.totals.cpIFRS + s.totals.passifIFRS, currency)}
          tone={s.totals.equilibreIFRS ? 'good' : 'bad'}
        />
      </div>
      <CoverageDetails coverage={s.coverage} />
    </div>
  );
}

function PlociView({ statements, currency }: { statements: FinancialStatements; currency: string }) {
  const p = statements.ploci;
  const Section = ({ title, rows, total }: { title: string; rows: { rubric: string; cgnc: number; ajustement: number; ifrs: number }[]; total?: number }) => (
    <div className="rounded-lg border border-navy-100">
      <div className="border-b border-navy-100 bg-navy-50/50 px-4 py-2 text-sm font-semibold text-navy-800">{title}</div>
      <TableWrap>
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="th">Rubrique</th>
              <th className="th text-right">CGNC</th>
              <th className="th text-right">Retraitements</th>
              <th className="th text-right">IFRS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {rows.map((r) => (
              <tr key={r.rubric}>
                <td className="td text-sm">{r.rubric}</td>
                <td className="td"><Num value={r.cgnc} /></td>
                <td className="td"><Num value={r.ajustement} /></td>
                <td className="td"><Num value={r.ifrs} strong /></td>
              </tr>
            ))}
          </tbody>
          {total !== undefined && (
            <tfoot className="bg-navy-50/40">
              <tr>
                <td className="td text-xs font-semibold uppercase text-navy-500">Total</td>
                <td className="td"></td>
                <td className="td"></td>
                <td className="td"><Num value={total} strong /></td>
              </tr>
            </tfoot>
          )}
        </table>
      </TableWrap>
    </div>
  );
  return (
    <div className="space-y-4">
      <CoverageBadge status={p.coverage.status} />
      <Section title="Produits" rows={p.produits} total={p.totalProduits} />
      <Section title="Charges" rows={p.charges} total={p.totalCharges} />
      <Section title="Impôt sur le résultat" rows={p.impot} total={p.totalImpot} />
      <div className="grid gap-3 sm:grid-cols-2">
        <BalanceCard label="Résultat net IFRS" value={money(p.resultatNet, currency)} tone="accent" />
        <BalanceCard label="Résultat net CGNC" value={money(p.resultatNetCGNC, currency)} />
      </div>
      <div className="rounded-lg border border-navy-100">
        <div className="border-b border-navy-100 bg-navy-50/50 px-4 py-2 text-sm font-semibold text-navy-800">Autres éléments du résultat global (OCI)</div>
        <div className="card-pad">
          {p.oci.length === 0 ? (
            <p className="text-sm text-navy-500">{p.ociNote}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {p.oci.map((o, i) => (
                <li key={i} className="flex justify-between">
                  <span>{o.rubric}</span>
                  <Num value={o.amount} currency={currency} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <CoverageDetails coverage={p.coverage} />
    </div>
  );
}

function CashflowView({ statements, currency }: { statements: FinancialStatements; currency: string }) {
  const c = statements.cashflow;
  return (
    <div className="space-y-4">
      <CoverageBadge status={c.coverage.status} />
      <TableWrap className="rounded-lg border border-navy-100">
        <table className="min-w-full">
          <thead className="bg-navy-50/60">
            <tr>
              <th className="th">Rubrique</th>
              <th className="th text-right">Montant</th>
              <th className="th">Observation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {c.lines.map((l, i) => (
              <tr key={i}>
                <td className="td text-sm">{l.rubric}</td>
                <td className="td">{l.amount === null ? <span className="text-xs text-orange-600">Non disponible</span> : <Num value={l.amount} currency={currency} />}</td>
                <td className="td text-xs text-navy-500">{l.note || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <CoverageDetails coverage={c.coverage} />
    </div>
  );
}

function SocieView({ statements, currency }: { statements: FinancialStatements; currency: string }) {
  const s = statements.socie;
  return (
    <div className="space-y-4">
      <CoverageBadge status={s.coverage.status} />
      <TableWrap className="rounded-lg border border-navy-100">
        <table className="min-w-full">
          <thead className="bg-navy-50/60">
            <tr>
              <th className="th">Mouvement</th>
              <th className="th text-right">Montant</th>
              <th className="th">Observation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {s.movements.map((m, i) => (
              <tr key={i}>
                <td className="td text-sm">{m.label}</td>
                <td className="td">{m.amount === null ? <span className="text-xs text-orange-600">Non documenté</span> : <Num value={m.amount} currency={currency} />}</td>
                <td className="td text-xs text-navy-500">{m.note || ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-navy-50/40">
            <tr>
              <td className="td text-xs font-semibold uppercase text-navy-500">Capitaux propres à la clôture</td>
              <td className="td"><Num value={s.closingEquity} currency={currency} strong /></td>
              <td className="td"></td>
            </tr>
          </tfoot>
        </table>
      </TableWrap>
      <CoverageDetails coverage={s.coverage} />
    </div>
  );
}

function NotesView({ statements }: { statements: FinancialStatements }) {
  return (
    <div className="space-y-3">
      {statements.notes.map((n, i) => (
        <div key={i} className="rounded-lg border border-navy-100 px-4 py-3">
          <p className="text-sm font-semibold text-navy-900">{n.title}</p>
          <p className="mt-1 text-sm text-navy-600 whitespace-pre-wrap">{n.body}</p>
        </div>
      ))}
    </div>
  );
}

function CoverageDetails({ coverage }: { coverage: { covered: string[]; notCovered: string[] } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Périmètre couvert</p>
        <ul className="mt-1 list-disc pl-4 text-xs text-emerald-800">
          {coverage.covered.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-amber-100 bg-amber-50/40 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Non couvert / à développer</p>
        <ul className="mt-1 list-disc pl-4 text-xs text-amber-800">
          {coverage.notCovered.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BalanceCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' | 'bad' | 'accent' }) {
  const cls = tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : tone === 'accent' ? 'text-teal-700' : 'text-navy-900';
  return (
    <div className="rounded-lg border border-navy-100 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">{label}</p>
      <p className={`mt-1 text-base font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
