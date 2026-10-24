import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import { amount, money, statusChipClass, statusLabel } from '../lib/format';
import { useApp } from '../lib/store';

export function Card({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
  icon,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-navy-100 px-5 py-3.5">
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && <div className="mt-0.5 text-teal-600">{icon}</div>}
        <div className="min-w-0">
          <h3 className="section-title truncate">{title}</h3>
          {subtitle && <p className="text-xs text-navy-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-navy-500 text-sm py-6 justify-center">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label || 'Chargement…'}
    </div>
  );
}

export function Loading({ label }: { label?: string }) {
  return <Spinner label={label} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
      <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <button className="link mt-1 text-xs" onClick={onRetry}>
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12 px-4">
      {icon && <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 text-navy-400">{icon}</div>}
      <h3 className="text-sm font-semibold text-navy-800">{title}</h3>
      {description && <p className="text-sm text-navy-500 mt-1 max-w-lg mx-auto">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function StatusChip({ status, className = '' }: { status: string; className?: string }) {
  return <span className={`chip ${statusChipClass(status)} ${className}`}>{statusLabel(status)}</span>;
}

export function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`chip border border-navy-200 bg-navy-50 text-navy-700 ${className}`}>{children}</span>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    bloquant: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Bloquant' },
    a_verifier: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'À vérifier' },
    information: { cls: 'bg-navy-50 text-navy-600 border-navy-200', label: 'Information' },
  };
  const m = map[severity] || map.information;
  return <span className={`chip border ${m.cls}`}>{m.label}</span>;
}

export function Num({ value, currency, strong, className = '' }: { value: number | null | undefined; currency?: string; strong?: boolean; className?: string }) {
  const txt = currency ? money(value, currency) : amount(value);
  const negative = value !== null && value !== undefined && Number(value) < 0;
  return <span className={`num ${strong ? 'font-semibold' : ''} ${negative ? 'text-red-600' : ''} ${className}`}>{txt}</span>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/40 p-4 sm:p-8">
      <div className={`w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} card animate-fade my-4`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-3">
          <h3 className="section-title">{title}</h3>
          <button className="rounded p-1 text-navy-400 hover:bg-navy-50" onClick={onClose} aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-navy-100 px-5 py-3 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-navy-400">{hint}</span>}
    </label>
  );
}

export function Banner({
  kind = 'info',
  title,
  children,
  className = '',
}: {
  kind?: 'info' | 'warn' | 'success' | 'error';
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const map = {
    info: { cls: 'border-navy-200 bg-navy-50 text-navy-800', Icon: Info },
    warn: { cls: 'border-amber-200 bg-amber-50 text-amber-900', Icon: AlertTriangle },
    success: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-900', Icon: CheckCircle2 },
    error: { cls: 'border-red-200 bg-red-50 text-red-900', Icon: XCircle },
  } as const;
  const { cls, Icon } = map[kind];
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${cls} ${className}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function CoverageBadge({ status }: { status: 'complet' | 'partiel' | 'indisponible' }) {
  const map = {
    complet: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    partiel: 'bg-amber-50 text-amber-700 border-amber-200',
    indisponible: 'bg-red-50 text-red-700 border-red-200',
  };
  const label = { complet: 'Complet', partiel: 'Partiel', indisponible: 'Indisponible' };
  return <span className={`chip border ${map[status]}`}>Périmètre : {label[status]}</span>;
}

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'accent';
  icon?: React.ReactNode;
}) {
  const tones = {
    default: 'text-navy-900',
    good: 'text-emerald-600',
    warn: 'text-amber-600',
    bad: 'text-red-600',
    accent: 'text-teal-600',
  };
  return (
    <Card className="card-pad">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-navy-500">{label}</p>
        {icon && <span className="text-navy-300">{icon}</span>}
      </div>
      <p className={`mt-1.5 text-xl font-semibold ${tones[tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-navy-400">{sub}</p>}
    </Card>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: React.ReactNode; count?: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-navy-100">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-medium transition ${
            value === t.id ? 'border-teal-500 text-teal-700' : 'border-transparent text-navy-500 hover:text-navy-700'
          }`}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-navy-100 px-1.5 py-0.5 text-[11px] text-navy-600">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Collapse({ title, children, defaultOpen = false, badge }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-navy-100">
      <button className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="text-sm font-medium text-navy-800">{title}</span>
        <span className="flex items-center gap-2">
          {badge}
          <span className="text-navy-400 text-xs">{open ? '▾' : '▸'}</span>
        </span>
      </button>
      {open && <div className="border-t border-navy-100 px-4 py-3 text-sm text-navy-700">{children}</div>}
    </div>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2 no-print">
      {toasts.map((t) => {
        const cls =
          t.kind === 'error'
            ? 'border-red-200 bg-red-50 text-red-900'
            : t.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-navy-200 bg-white text-navy-800';
        return (
          <div key={t.id} className={`animate-fade rounded-lg border px-3.5 py-2.5 text-sm shadow-panel ${cls}`}>
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

export function ConfirmButton({
  onConfirm,
  children,
  className = 'btn-danger btn-sm',
  confirmLabel = 'Confirmer ?',
}: {
  onConfirm: () => void;
  children: React.ReactNode;
  className?: string;
  confirmLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

export function TableWrap({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-x-auto ${className}`}>{children}</div>;
}
