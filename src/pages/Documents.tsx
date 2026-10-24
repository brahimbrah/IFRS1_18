import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { api, downloadFile } from '../lib/api';
import { useApp } from '../lib/store';
import { DOC_KINDS, amount, dateTimeFr, money } from '../lib/format';
import { Banner, Card, CardHeader, ConfirmButton, EmptyState, ErrorState, Field, Loading, Modal, Num, StatusChip, TableWrap, Tabs } from '../components/ui';
import NoDossier from '../components/RequireDossier';
import type { DocumentRow } from '../lib/types';

type Extraction = {
  ok: boolean;
  format: string;
  sheets: string[];
  headers: string[];
  rows: { account_code: string; account_label: string; debit: number; credit: number; balance: number; raw: string[]; warnings: string[] }[];
  warnings: string[];
  meta: { rows: number; coded: number; uncoded: number; totalDebit: number; totalCredit: number; totalBalance: number };
};

type AccountTotal = { code: string; label: string; debit: number; credit: number; balance: number; sources: string[] };
type GlLine = {
  id: string;
  document_id: string | null;
  account_code: string;
  account_label: string;
  debit: number;
  credit: number;
  balance: number;
  source: string;
};

export default function Documents() {
  const { current, notify } = useApp();
  const [tab, setTab] = useState('documents');
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [refKinds, setRefKinds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const load = async () => {
    if (!current) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ documents: DocumentRow[]; referenceKinds: string[] }>(`/dossiers/${current.id}/documents`);
      setDocs(res.documents);
      setRefKinds(res.referenceKinds);
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

  if (!current) return <NoDossier hint="Sélectionnez ou créez un dossier pour importer des documents comptables." />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Documents comptables</h1>
          <p className="text-sm text-navy-500">Importez vos états CGNC (Excel, CSV, PDF texte) ou saisissez une balance manuellement.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setManualOpen(true)}>
            <Pencil className="h-4 w-4" /> Saisie manuelle
          </button>
          <button className="btn-primary btn-sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> Importer un document
          </button>
        </div>
      </div>

      {refKinds.length > 0 && (
        <Banner kind="info" title="Source de référence retenue">
          Priorité : balance &gt; saisie &gt; bilan / CPC &gt; journal. Source utilisée pour le tableau de passage : <strong>{refKinds.map((k) => DOC_KINDS[k] || k).join(', ')}</strong>. Les autres documents servent uniquement au contrôle.
        </Banner>
      )}

      <Card>
        <div className="px-3 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'documents', label: 'Documents importés', count: docs.length },
              { id: 'accounts', label: 'Comptes & lignes' },
            ]}
          />
        </div>
        <div className="card-pad">
          {error && <ErrorState message={error} onRetry={load} />}
          {loading && <Loading />}
          {!loading && !error && tab === 'documents' && (
            <DocumentsList docs={docs} onChanged={load} currency={current.currency} />
          )}
          {!loading && !error && tab === 'accounts' && <AccountsTable />}
        </div>
      </Card>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />
      <ManualModal open={manualOpen} onClose={() => setManualOpen(false)} onDone={load} />
    </div>
  );
}

function DocumentsList({ docs, onChanged, currency }: { docs: DocumentRow[]; onChanged: () => void; currency: string }) {
  const { notify } = useApp();
  if (docs.length === 0) {
    return (
      <EmptyState
        icon={<FileSpreadsheet className="h-6 w-6" />}
        title="Aucun document importé"
        description="Importez une balance générale (Excel/CSV) ou saisissez une balance manuellement. Formats acceptés : .xlsx, .csv, PDF texte."
      />
    );
  }
  return (
    <div className="space-y-3">
      {docs.map((d) => {
        const parsed = d.parsed || {};
        return (
          <div key={d.id} className="rounded-lg border border-navy-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy-500">
                  {d.mime?.includes('pdf') ? <FileText className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-900 truncate">{d.filename}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-navy-500">
                    <span className="chip border border-navy-200 bg-navy-50 text-navy-700">{DOC_KINDS[d.kind] || d.kind}</span>
                    <span>{d.rows} ligne(s)</span>
                    <span>·</span>
                    <span>importé le {dateTimeFr(d.uploaded_at)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip status={d.status === 'extrait' ? 'conforme' : 'a_verifier'} />
                {d.stored_name && (
                  <button className="btn-ghost btn-sm" onClick={() => downloadFile(`/documents/${d.id}/file`, d.filename)}>
                    <Download className="h-3.5 w-3.5" />
                  </button>
                )}
                <ConfirmButton
                  onConfirm={async () => {
                    try {
                      await api.del(`/documents/${d.id}`);
                      notify('Document supprimé.', 'success');
                      onChanged();
                    } catch (e: any) {
                      notify(e?.message || 'Suppression impossible.', 'error');
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </ConfirmButton>
              </div>
            </div>
            {d.message && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-navy-50/60 px-3 py-2 text-xs text-navy-600">
                {d.status === 'extrait' ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600" />}
                <span>{d.message}</span>
              </div>
            )}
            {parsed?.totalDebit !== undefined && (
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-navy-600">
                <span>Total débit : <Num value={parsed.totalDebit} currency={currency} /></span>
                <span>Total crédit : <Num value={parsed.totalCredit} currency={currency} /></span>
                <span>Équilibre : {parsed.equilibre ? 'oui' : 'à vérifier'}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { current, notify } = useApp();
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [token, setToken] = useState('');
  const [filename, setFilename] = useState('');
  const [fileMeta, setFileMeta] = useState<{ size: number; mime: string }>({ size: 0, mime: '' });
  const [kind, setKind] = useState('balance');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setExtraction(null);
    setToken('');
    setFilename('');
    setError('');
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function pick(file: File) {
    if (!current) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.upload<{ token: string; filename: string; format: string; extraction: Extraction }>(`/dossiers/${current.id}/documents/preview`, file);
      setToken(res.token);
      setFilename(res.filename);
      setFileMeta({ size: file.size, mime: file.type });
      setExtraction(res.extraction);
      // suggestion de type selon le nom
      const n = res.filename.toLowerCase();
      if (/balance/.test(n)) setKind('balance');
      else if (/bilan/.test(n)) setKind('bilan');
      else if (/cpc|produits|charges/.test(n)) setKind('cpc');
      else if (/journal/.test(n)) setKind('journal');
      else if (/immob/.test(n)) setKind('immobilisations');
      else if (/location|bail|contrat/.test(n)) setKind('contrat');
      else if (/annexe|provision/.test(n)) setKind('annexe');
    } catch (e: any) {
      setError(e?.message || 'Lecture du fichier impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!current || !extraction) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/dossiers/${current.id}/documents/commit`, {
        token,
        filename,
        mime: fileMeta.mime,
        size: fileMeta.size,
        kind,
        rows: extraction.rows,
        columns: extraction.headers,
        parsed: { type: kind, ...extraction.meta, equilibre: Math.abs(extraction.meta.totalDebit - extraction.meta.totalCredit) < 0.01 },
        warnings: extraction.warnings,
      });
      notify('Document enregistré.', 'success');
      onDone();
      onClose();
      reset();
    } catch (e: any) {
      setError(e?.message || 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      title="Importer un document comptable"
      wide
      footer={
        extraction ? (
          <>
            <button className="btn-ghost" onClick={reset} disabled={busy}>
              Choisir un autre fichier
            </button>
            <button className="btn-primary" onClick={commit} disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer le document'}
            </button>
          </>
        ) : undefined
      }
    >
      {error && <div className="mb-3"><Banner kind="error">{error}</Banner></div>}

      {!extraction && (
        <div className="space-y-4">
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 px-6 py-10 text-center hover:border-teal-400 hover:bg-teal-50/30"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) pick(f);
            }}
          >
            <Upload className="h-7 w-7 text-teal-600" />
            <span className="text-sm font-medium text-navy-800">Déposez un fichier ou cliquez pour parcourir</span>
            <span className="text-xs text-navy-500">Excel (.xlsx), CSV (.csv) ou PDF texte. Word (.docx) non pris en charge.</span>
            <input ref={inputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv,.pdf" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
          </label>
          {busy && <Loading label="Extraction en cours…" />}
          <Banner kind="info">
            L’extraction lit les colonnes compte / libellé / débit / crédit. Les documents scannés (images) ne sont pas pris en charge : l’OCR est une fonctionnalité à développer.
          </Banner>
        </div>
      )}

      {extraction && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-teal-600" />
            <span className="font-medium text-navy-800">{filename}</span>
            <span className="chip border border-navy-200 bg-navy-50 text-navy-600">{extraction.format.toUpperCase()}</span>
          </div>

          {extraction.warnings.length > 0 && (
            <Banner kind="warn" title="Points de vigilance à l’extraction">
              <ul className="list-disc pl-4 space-y-0.5">
                {extraction.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Banner>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Lignes extraites" value={String(extraction.meta.rows)} />
            <MiniStat label="Lignes avec code" value={String(extraction.meta.coded)} />
            <MiniStat label="Total débit" value={amount(extraction.meta.totalDebit)} />
            <MiniStat label="Total crédit" value={amount(extraction.meta.totalCredit)} />
          </div>

          <Field label="Type de document" hint="Le type détermine la priorité de la source dans le tableau de passage.">
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(DOC_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          <div>
            <p className="label">Prévisualisation ({Math.min(extraction.rows.length, 50)} / {extraction.rows.length} lignes)</p>
            <TableWrap className="max-h-72 overflow-y-auto rounded-lg border border-navy-100">
              <table className="min-w-full">
                <thead className="sticky top-0 bg-navy-50/90">
                  <tr>
                    <th className="th">Compte</th>
                    <th className="th">Libellé</th>
                    <th className="th text-right">Débit</th>
                    <th className="th text-right">Crédit</th>
                    <th className="th">Contrôles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {extraction.rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className={r.warnings.length ? 'bg-amber-50/50' : ''}>
                      <td className="td font-mono text-xs">{r.account_code || '—'}</td>
                      <td className="td text-xs">{r.account_label || '—'}</td>
                      <td className="td"><Num value={r.debit} /></td>
                      <td className="td"><Num value={r.credit} /></td>
                      <td className="td text-xs text-amber-700">{r.warnings.join(' ; ') || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ManualModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { current, notify } = useApp();
  const [rows, setRows] = useState<{ account_code: string; account_label: string; debit: string; credit: string }[]>([
    { account_code: '', account_label: '', debit: '', credit: '' },
    { account_code: '', account_label: '', debit: '', credit: '' },
    { account_code: '', account_label: '', debit: '', credit: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const totalDebit = useMemo(() => rows.reduce((s, r) => s + (Number(r.debit) || 0), 0), [rows]);
  const totalCredit = useMemo(() => rows.reduce((s, r) => s + (Number(r.credit) || 0), 0), [rows]);

  function update(i: number, k: string, v: string) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  }

  async function save() {
    if (!current) return;
    setBusy(true);
    setError('');
    try {
      const cleaned = rows
        .filter((r) => r.account_code.trim() || r.account_label.trim())
        .map((r) => ({ account_code: r.account_code.trim(), account_label: r.account_label.trim(), debit: Number(r.debit) || 0, credit: Number(r.credit) || 0 }));
      await api.post(`/dossiers/${current.id}/documents/manual`, { rows: cleaned, filename: 'Saisie manuelle de la balance' });
      notify('Saisie enregistrée.', 'success');
      onDone();
      onClose();
      setRows([{ account_code: '', account_label: '', debit: '', credit: '' }]);
    } catch (e: any) {
      setError(e?.message || 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Saisie manuelle d’une balance"
      wide
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="btn-primary" onClick={save} disabled={busy || totalDebit === 0}>
            {busy ? 'Enregistrement…' : 'Enregistrer la saisie'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Banner kind="error">{error}</Banner>}
        <div className={`flex items-center justify-between rounded-lg border px-3.5 py-2 text-sm ${Math.abs(totalDebit - totalCredit) < 0.01 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <span>Total débit : <strong>{amount(totalDebit)}</strong></span>
          <span>Total crédit : <strong>{amount(totalCredit)}</strong></span>
          <span>{Math.abs(totalDebit - totalCredit) < 0.01 ? 'Équilibré' : `Écart : ${amount(totalDebit - totalCredit)}`}</span>
        </div>
        <TableWrap className="max-h-80 overflow-y-auto rounded-lg border border-navy-100">
          <table className="min-w-full">
            <thead className="sticky top-0 bg-navy-50/90">
              <tr>
                <th className="th">Compte</th>
                <th className="th">Libellé</th>
                <th className="th">Débit</th>
                <th className="th">Crédit</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="td"><input className="input py-1.5 font-mono text-xs" value={r.account_code} onChange={(e) => update(i, 'account_code', e.target.value)} placeholder="6111" /></td>
                  <td className="td"><input className="input py-1.5 text-xs" value={r.account_label} onChange={(e) => update(i, 'account_label', e.target.value)} placeholder="Achats de marchandises" /></td>
                  <td className="td"><input className="input py-1.5 text-right text-xs" inputMode="decimal" value={r.debit} onChange={(e) => update(i, 'debit', e.target.value)} placeholder="0,00" /></td>
                  <td className="td"><input className="input py-1.5 text-right text-xs" inputMode="decimal" value={r.credit} onChange={(e) => update(i, 'credit', e.target.value)} placeholder="0,00" /></td>
                  <td className="td">
                    <button className="text-navy-300 hover:text-red-600" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <button className="btn-ghost btn-sm" onClick={() => setRows((rs) => [...rs, { account_code: '', account_label: '', debit: '', credit: '' }])}>
          <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
        </button>
      </div>
    </Modal>
  );
}

function AccountsTable() {
  const { current, notify } = useApp();
  const [totals, setTotals] = useState<AccountTotal[]>([]);
  const [lines, setLines] = useState<GlLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAllLines, setShowAllLines] = useState(false);
  const [edit, setEdit] = useState<GlLine | null>(null);

  const load = async () => {
    if (!current) return;
    setLoading(true);
    try {
      const res = await api.get<{ totals: AccountTotal[]; lines: GlLine[] }>(`/dossiers/${current.id}/accounts`);
      setTotals(res.totals);
      setLines(res.lines);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (loading) return <Loading />;
  if (totals.length === 0)
    return <EmptyState icon={<FileSpreadsheet className="h-6 w-6" />} title="Aucune donnée comptable" description="Importez ou saisissez une balance pour alimenter les comptes." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-navy-600">Comptes agrégés de la source de référence ({totals.length} comptes).</p>
        <button className="btn-ghost btn-sm" onClick={() => setShowAllLines((s) => !s)}>
          <RefreshCw className="h-3.5 w-3.5" /> {showAllLines ? 'Vue agrégée' : 'Voir les lignes brutes'}
        </button>
      </div>

      {!showAllLines ? (
        <TableWrap className="rounded-lg border border-navy-100">
          <table className="min-w-full">
            <thead className="bg-navy-50/60">
              <tr>
                <th className="th">Compte</th>
                <th className="th">Libellé</th>
                <th className="th text-right">Débit</th>
                <th className="th text-right">Crédit</th>
                <th className="th text-right">Solde</th>
                <th className="th">Source(s)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {totals.map((t) => (
                <tr key={t.code} className="hover:bg-navy-50/40">
                  <td className="td font-mono text-xs">{t.code}</td>
                  <td className="td text-sm">{t.label}</td>
                  <td className="td"><Num value={t.debit} /></td>
                  <td className="td"><Num value={t.credit} /></td>
                  <td className="td"><Num value={t.balance} strong /></td>
                  <td className="td text-xs text-navy-500">{t.sources.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <TableWrap className="rounded-lg border border-navy-100">
          <table className="min-w-full">
            <thead className="bg-navy-50/60">
              <tr>
                <th className="th">Compte</th>
                <th className="th">Libellé</th>
                <th className="th text-right">Débit</th>
                <th className="th text-right">Crédit</th>
                <th className="th">Source</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {lines.map((l) => (
                <tr key={l.id} className="hover:bg-navy-50/40">
                  <td className="td font-mono text-xs">{l.account_code}</td>
                  <td className="td text-sm">{l.account_label}</td>
                  <td className="td"><Num value={l.debit} /></td>
                  <td className="td"><Num value={l.credit} /></td>
                  <td className="td text-xs text-navy-500">{DOC_KINDS[l.source] || l.source}</td>
                  <td className="td">
                    <div className="flex gap-1">
                      <button className="text-navy-400 hover:text-navy-700" onClick={() => setEdit(l)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <ConfirmButton
                        className="text-navy-400 hover:text-red-600"
                        confirmLabel="Supprimer ?"
                        onConfirm={async () => {
                          await api.del(`/lines/${l.id}`);
                          notify('Ligne supprimée.', 'success');
                          load();
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
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Modifier la ligne comptable">
        {edit && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Compte"><input className="input" value={edit.account_code} onChange={(e) => setEdit({ ...edit, account_code: e.target.value })} /></Field>
              <Field label="Libellé"><input className="input" value={edit.account_label} onChange={(e) => setEdit({ ...edit, account_label: e.target.value })} /></Field>
              <Field label="Débit"><input className="input text-right" value={edit.debit} onChange={(e) => setEdit({ ...edit, debit: Number(e.target.value) })} /></Field>
              <Field label="Crédit"><input className="input text-right" value={edit.credit} onChange={(e) => setEdit({ ...edit, credit: Number(e.target.value) })} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEdit(null)}>Annuler</button>
              <button
                className="btn-primary"
                onClick={async () => {
                  await api.patch(`/lines/${edit.id}`, { account_code: edit.account_code, account_label: edit.account_label, debit: edit.debit, credit: edit.credit });
                  notify('Ligne mise à jour.', 'success');
                  setEdit(null);
                  load();
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-navy-100 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">{label}</p>
      <p className="text-sm font-semibold text-navy-900 mt-0.5">{value}</p>
    </div>
  );
}
