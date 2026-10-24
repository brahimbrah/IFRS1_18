import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  Database,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  RefreshCw,
  ScrollText,
  Settings as SettingsIcon,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/store';
import { statusLabel } from '../lib/format';
import { Toasts } from './ui';

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/nouvelle-conversion', label: 'Nouvelle conversion', icon: PlusCircle },
  { to: '/documents', label: 'Documents comptables', icon: FileSpreadsheet },
  { to: '/analyse', label: 'Analyse intelligente', icon: Sparkles },
  { to: '/retraitements', label: 'Retraitements IFRS', icon: Wand2 },
  { to: '/etats-financiers', label: 'États financiers IFRS', icon: ScrollText },
  { to: '/normes', label: 'Bibliothèque des normes', icon: BookOpen },
  { to: '/rapports', label: 'Rapports et exports', icon: FileText },
  { to: '/parametres', label: 'Paramètres', icon: SettingsIcon },
];

export default function Layout() {
  const { user, dossiers, current, selectDossier, logout, refreshDossiers, notify } = useApp();
  const [open, setOpen] = useState(false);
  const [busyDemo, setBusyDemo] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  async function launchDemo() {
    setBusyDemo(true);
    try {
      const res = await api.post<{ dossierId: string }>('/demo', {});
      const list = await refreshDossiers();
      selectDossier(res.dossierId);
      notify('Dossier de démonstration créé et sélectionné.', 'success');
      void list;
      nav('/');
    } catch (e: any) {
      notify(e?.message || 'Création du dossier de démonstration impossible.', 'error');
    } finally {
      setBusyDemo(false);
    }
  }

  return (
    <div className="min-h-full flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-navy-900 text-navy-100 transition-transform lg:translate-x-0 lg:static lg:z-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-navy-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-navy-950 font-bold">IB</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">IFRS Bridge</p>
              <p className="text-[11px] text-navy-300 leading-tight">Maroc — CGNC → IAS/IFRS</p>
            </div>
            <button className="ml-auto lg:hidden text-navy-300" onClick={() => setOpen(false)} aria-label="Fermer le menu">
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                      isActive ? 'bg-navy-800 text-white font-medium' : 'text-navy-200 hover:bg-navy-800/60 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4.5 w-4.5 h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-navy-800 p-3 space-y-1">
            <NavLink
              to="/a-propos"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive ? 'bg-navy-800 text-white font-medium' : 'text-navy-200 hover:bg-navy-800/60 hover:text-white'
                }`
              }
            >
              <Info className="h-[18px] w-[18px] shrink-0" />
              <span>À propos du projet</span>
            </NavLink>
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-navy-300">
              <Database className="h-4 w-4" />
              <span className="truncate">{user?.name} · {user?.role === 'admin' ? 'administrateur' : 'utilisateur'}</span>
            </div>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-navy-950/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-navy-100 bg-white/90 backdrop-blur no-print">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <button className="lg:hidden text-navy-600" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
              <Menu className="h-5 w-5" />
            </button>

            <DossierPicker />

            <div className="ml-auto flex items-center gap-2">
              <button className="btn-ghost btn-sm" onClick={launchDemo} disabled={busyDemo} title="Créer un dossier de démonstration cohérent">
                <FlaskConical className="h-4 w-4" />
                <span className="hidden sm:inline">{busyDemo ? 'Création…' : 'Lancer une démonstration'}</span>
              </button>
              <button
                className="btn-ghost btn-sm"
                onClick={async () => {
                  await refreshDossiers();
                  notify('Liste des dossiers actualisée.');
                }}
                title="Actualiser"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button className="btn-ghost btn-sm" onClick={logout} title="Se déconnecter">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 max-w-[1500px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <Toasts />
    </div>
  );
}

function DossierPicker() {
  const { dossiers, current, selectDossier } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative min-w-0">
      <button
        className="flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm hover:bg-navy-50 max-w-[16rem] sm:max-w-[26rem]"
        onClick={() => setOpen((o) => !o)}
      >
        <BarChart3 className="h-4 w-4 text-teal-600 shrink-0" />
        <span className="truncate text-navy-800">{current ? current.name : 'Aucun dossier sélectionné'}</span>
        {current?.is_demo ? <span className="chip bg-teal-50 text-teal-700 border border-teal-200">Démo</span> : null}
        <ChevronDown className="h-4 w-4 text-navy-400 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-[24rem] max-w-[80vw] card p-1.5 max-h-96 overflow-y-auto animate-fade">
            {dossiers.length === 0 && <p className="px-3 py-4 text-sm text-navy-500">Aucun dossier. Créez une nouvelle conversion ou lancez une démonstration.</p>}
            {dossiers.map((d) => (
              <button
                key={d.id}
                className={`w-full rounded-md px-3 py-2 text-left hover:bg-navy-50 ${d.id === current?.id ? 'bg-navy-50' : ''}`}
                onClick={() => {
                  selectDossier(d.id);
                  setOpen(false);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-navy-800 truncate">{d.name}</span>
                  {d.is_demo ? <span className="chip bg-teal-50 text-teal-700 border border-teal-200">Démo</span> : null}
                </div>
                <div className="text-xs text-navy-500 truncate">
                  {d.company_name} · exercice {d.exercice} · {statusLabel(d.status)}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
