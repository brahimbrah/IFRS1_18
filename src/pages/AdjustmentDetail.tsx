import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calculator,
  CheckCircle2,
  FileWarning,
  MessageSquare,
  Pencil,
  Save,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/store';
import { dateTimeFr, money, normColor } from '../lib/format';
import { Banner, Card, CardHeader, ConfirmButton, ErrorState, Loading, Num, StatusChip, TableWrap } from '../components/ui';
import NoDossier from '../components/RequireDossier';
import type { Adjustment, Entry } from '../lib/types';

export default function AdjustmentDetail() {
  const { ref } = useParams();
  const { current, notify } = useApp();
  const nav = useNavigate();
  const [adjustment, setAdjustment] = useState<Adjustment | null>(null);
  const [validations, setValidations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ amount: 0, title: '', rationale: '' });

  const load = async () => {
    if (!current || !ref) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ adjustments: Adjustment[] }>(`/dossiers/${current.id}/adjustments`);
      const found = res.adjustments.find((a) => a.ref === ref) || null;
      setAdjustment(found);
      if (found) {
        setEditForm({ amount: found.amount, title: found.title, rationale: found.rationale });
        const v = await api.get<{ validations: any[] }>(`/adjustments/${found.id}/validations`);
        setValidations(v.validations);
      }
    } catch (e: any) {
      setError(e?.message || 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, ref]);

  async function act(action: string, extra: Record<string, any> = {}) {
    if (!adjustment) return;
    setBusy(true);
    try {
      const res = await api.patch<{ adjustment: Adjustment }>(`/adjustments/${adjustment.id}`, { action, comment, ...extra });
      setAdjustment(res.adjustment);
      setEditForm({ amount: res.adjustment.amount, title: res.adjustment.title, rationale: res.adjustment.rationale });
      setComment('');
      setEditMode(false);
      notify('Retraitement mis à jour.', 'success');
      await load();
    } catch (e: any) {
      notify(e?.message || 'Action impossible.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!current) return <NoDossier />;
  if (loading) return <Card><Loading /></Card>;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!adjustment)
    return (
      <Card>
        <div className="card-pad">
          <Banner kind="error">Retraitement « {ref} » introuvable dans ce dossier.</Banner>
          <Link to="/retraitements" className="btn-ghost btn-sm mt-3">
            <ArrowLeft className="h-4 w-4" /> Retour à la liste
          </Link>
        </div>
      </Card>
    );

  const a = adjustment;
  const approved = a.status === 'approuve';
  const hasEntries = a.entries.length > 0;
  const canApprove = hasEntries && a.entryBalance.balanced;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <button className="btn-ghost btn-sm mt-0.5" onClick={() => nav('/retraitements')}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-navy-500">{a.ref}</span>
              <span className={`chip border ${normColor(a.norm_code)}`}>{a.norm_code}</span>
              <StatusChip status={a.status} />
              <span className="chip border border-navy-200 bg-navy-50 text-navy-600">{a.category === 'reclassement' ? 'Reclassement' : 'Ajustement'}</span>
            </div>
            <h1 className="mt-1 text-lg font-semibold text-navy-900">{a.title}</h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-navy-400">Montant du retraitement</p>
          <p className="text-lg font-semibold text-navy-900">{money(a.amount, current.currency)}</p>
        </div>
      </div>

      {a.status === 'informations_requises' && (
        <Banner kind="warn" title="Informations complémentaires requises">
          Aucun montant n’est calculé pour ce poste tant que les informations manquantes ne sont pas fournies. Un retraitement ne peut être inventé.
        </Banner>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* A. Poste CGNC */}
          <Card>
            <CardHeader title="A. Poste CGNC concerné" icon={<FileWarning className="h-5 w-5" />} />
            <div className="card-pad grid gap-3 sm:grid-cols-2">
              <Info label="Compte" value={a.account_code || '—'} mono />
              <Info label="Poste CGNC" value={a.poste_cgnc || '—'} />
              <Info label="Type de retraitement" value={a.type} />
              <Info label="Catégorie" value={a.category} />
            </div>
          </Card>

          {/* B. Divergence + justification */}
          <Card>
            <CardHeader title="B. Divergence identifiée et justification" icon={<ShieldAlert className="h-5 w-5" />} />
            <div className="card-pad text-sm text-navy-700 whitespace-pre-wrap">{a.rationale || '—'}</div>
          </Card>

          {/* C. Références normatives */}
          <Card>
            <CardHeader title="C. Références normatives" icon={<BookOpen className="h-5 w-5" />} />
            <div className="divide-y divide-navy-100">
              {(a.refs ?? []).map((r, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`chip border ${normColor(r.norm)}`}>{r.norm}</span>
                    <span className="text-xs font-medium text-navy-700">{r.number}</span>
                    {r.verified ? (
                      <span className="chip border border-emerald-200 bg-emerald-50 text-emerald-700">Référence validée</span>
                    ) : (
                      <span className="chip border border-amber-200 bg-amber-50 text-amber-700">Référence à vérifier</span>
                    )}
                  </div>
                  {r.title && <p className="mt-1 text-xs font-medium text-navy-600">{r.title}</p>}
                  <p className="mt-1 text-sm text-navy-700">{r.text}</p>
                  <p className="mt-1 text-[11px] text-navy-400">
                    Source : {r.source || '—'} {r.sourceUrl ? `· ${r.sourceUrl}` : ''}
                  </p>
                </div>
              ))}
              {(a.refs ?? []).length === 0 && <p className="card-pad text-sm text-navy-500">Aucune référence rattachée.</p>}
            </div>
          </Card>

          {/* D. Calculs */}
          <Card>
            <CardHeader title="D. Détail du calcul (moteur déterministe)" icon={<Calculator className="h-5 w-5" />} />
            {a.computations.length === 0 ? (
              <p className="card-pad text-sm text-navy-500">Aucun calcul : informations insuffisantes.</p>
            ) : (
              <TableWrap>
                <table className="min-w-full">
                  <thead className="bg-navy-50/60">
                    <tr>
                      <th className="th">Étape</th>
                      <th className="th">Formule</th>
                      <th className="th">Entrées</th>
                      <th className="th text-right">Résultat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {a.computations.map((s, i) => (
                      <tr key={i}>
                        <td className="td text-sm font-medium">{s.label}</td>
                        <td className="td text-xs text-navy-500">{s.formula}</td>
                        <td className="td text-xs text-navy-500">
                          {Object.entries(s.inputs || {}).map(([k, v]) => `${k}=${v}`).join(', ')}
                        </td>
                        <td className="td">
                          <Num value={Number(s.result)} /> <span className="text-xs text-navy-400">{s.unit}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          {/* E. Écriture */}
          <Card>
            <CardHeader
              title="E. Écriture comptable de retraitement"
              subtitle={hasEntries ? `Débit ${money(a.entryBalance.debit, current.currency)} = Crédit ${money(a.entryBalance.credit, current.currency)}` : 'Aucune écriture'}
              icon={<Pencil className="h-5 w-5" />}
              right={
                hasEntries && a.entryBalance.balanced ? (
                  <span className="chip border border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Équilibrée</span>
                ) : hasEntries ? (
                  <span className="chip border border-red-200 bg-red-50 text-red-700"><AlertTriangle className="h-3.5 w-3.5" /> Déséquilibrée</span>
                ) : null
              }
            />
            {!hasEntries ? (
              <p className="card-pad text-sm text-navy-500">Aucune écriture générée pour ce retraitement.</p>
            ) : (
              <EntriesEditor entries={a.entries} disabled={approved} onChanged={load} currency={current.currency} />
            )}
          </Card>

          {/* F. Informations complémentaires */}
          <Card>
            <CardHeader title="F. Informations complémentaires requises" icon={<AlertTriangle className="h-5 w-5" />} />
            {a.missing.length === 0 ? (
              <p className="card-pad text-sm text-emerald-600">Toutes les informations nécessaires sont disponibles.</p>
            ) : (
              <ul className="card-pad space-y-1.5">
                {a.missing.map((m, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-navy-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                    {m.label}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Colonne actions */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Validation" />
            <div className="card-pad space-y-3">
              {approved ? (
                <Banner kind="success">Ce retraitement est approuvé et intégré aux états financiers définitifs.</Banner>
              ) : a.status === 'rejete' ? (
                <Banner kind="error">Ce retraitement a été rejeté : il est exclu des états.</Banner>
              ) : (
                <Banner kind="info">Ce retraitement est en attente de validation.</Banner>
              )}

              {!canApprove && !approved && hasEntries && (
                <Banner kind="error">Écriture déséquilibrée : la validation est bloquée tant que le débit n’égale pas le crédit.</Banner>
              )}
              {!hasEntries && !approved && (
                <Banner kind="warn">Aucune écriture : l’approbation est impossible tant que les informations manquent.</Banner>
              )}

              <textarea
                className="input"
                rows={3}
                placeholder="Commentaire de validation (facultatif)…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-2">
                <button className="btn-accent btn-sm" disabled={busy || !canApprove || approved} onClick={() => act('approuver')}>
                  <CheckCircle2 className="h-4 w-4" /> Approuver
                </button>
                <button className="btn-ghost btn-sm" disabled={busy || approved} onClick={() => setEditMode((m) => !m)}>
                  <Pencil className="h-4 w-4" /> Modifier
                </button>
                <button className="btn-ghost btn-sm" disabled={busy || approved} onClick={() => act('demander_justification')}>
                  <MessageSquare className="h-4 w-4" /> Demander une justification
                </button>
                <ConfirmButton className="btn-danger btn-sm" confirmLabel="Rejeter ?" onConfirm={() => act('rejeter')}>
                  <XCircle className="h-4 w-4" /> Rejeter
                </ConfirmButton>
              </div>

              {editMode && (
                <div className="space-y-2 rounded-lg border border-navy-100 p-3">
                  <label className="label">Montant retenu (MAD)</label>
                  <input className="input text-right" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })} />
                  <label className="label">Titre</label>
                  <input className="input" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                  <label className="label">Justification</label>
                  <textarea className="input" rows={3} value={editForm.rationale} onChange={(e) => setEditForm({ ...editForm, rationale: e.target.value })} />
                  <button className="btn-primary btn-sm w-full" disabled={busy} onClick={() => act('modifier', editForm)}>
                    <Save className="h-4 w-4" /> Enregistrer la modification
                  </button>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Historique des décisions" />
            <div className="card-pad">
              {validations.length === 0 ? (
                <p className="text-sm text-navy-500">Aucune décision enregistrée.</p>
              ) : (
                <ol className="space-y-3">
                  {validations.map((v, i) => (
                    <li key={i} className="border-l-2 border-navy-100 pl-3">
                      <p className="text-xs font-medium text-navy-700">{v.action}</p>
                      <p className="text-[11px] text-navy-400">{dateTimeFr(v.created_at)}</p>
                      {v.comment && <p className="text-xs text-navy-600 mt-0.5">{v.comment}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className={`text-sm text-navy-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function EntriesEditor({ entries, disabled, onChanged, currency }: { entries: Entry[]; disabled: boolean; onChanged: () => void; currency: string }) {
  const { notify } = useApp();
  const [rows, setRows] = useState<Entry[]>(entries);
  useEffect(() => setRows(entries), [entries]);
  const totals = useMemo(() => {
    const d = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
    const c = rows.reduce((s, r) => s + Number(r.credit || 0), 0);
    return { d, c, balanced: Math.abs(d - c) < 0.01 };
  }, [rows]);

  async function save(entry: Entry) {
    try {
      await api.patch(`/entries/${entry.id}`, {
        account_code: entry.account_code,
        account_label: entry.account_label,
        label: entry.label,
        debit: entry.debit,
        credit: entry.credit,
      });
      notify('Écriture mise à jour.', 'success');
      onChanged();
    } catch (e: any) {
      notify(e?.message || 'Mise à jour impossible.', 'error');
    }
  }

  return (
    <div>
      <TableWrap>
        <table className="min-w-full">
          <thead className="bg-navy-50/60">
            <tr>
              <th className="th">Compte</th>
              <th className="th">Libellé</th>
              <th className="th">Date</th>
              <th className="th text-right">Débit</th>
              <th className="th text-right">Crédit</th>
              {!disabled && <th className="th"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {rows.map((e, i) => (
              <tr key={e.id}>
                <td className="td">
                  <input className="input py-1 font-mono text-xs" value={e.account_code} disabled={disabled} onChange={(ev) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, account_code: ev.target.value } : r)))} />
                </td>
                <td className="td">
                  <input className="input py-1 text-xs" value={e.account_label} disabled={disabled} onChange={(ev) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, account_label: ev.target.value } : r)))} />
                </td>
                <td className="td">
                  <input className="input py-1 text-xs" value={e.date} disabled={disabled} onChange={(ev) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, date: ev.target.value } : r)))} />
                </td>
                <td className="td">
                  <input className="input py-1 text-right text-xs" value={e.debit} disabled={disabled} onChange={(ev) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, debit: Number(ev.target.value) } : r)))} />
                </td>
                <td className="td">
                  <input className="input py-1 text-right text-xs" value={e.credit} disabled={disabled} onChange={(ev) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, credit: Number(ev.target.value) } : r)))} />
                </td>
                {!disabled && (
                  <td className="td">
                    <button className="text-navy-400 hover:text-navy-700" onClick={() => save(rows[i])}>
                      <Save className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-navy-50/60">
            <tr>
              <td className="td text-xs font-semibold uppercase text-navy-500" colSpan={3}>Totaux</td>
              <td className="td"><Num value={totals.d} strong /></td>
              <td className="td"><Num value={totals.c} strong /></td>
              {!disabled && <td className="td">{totals.balanced ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-red-500" />}</td>}
            </tr>
          </tfoot>
        </table>
      </TableWrap>
      {disabled && <p className="px-4 py-2 text-xs text-navy-400">Écriture validée : rejetez d’abord le retraitement pour la modifier.</p>}
    </div>
  );
}
