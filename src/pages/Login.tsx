import { useState, type FormEvent } from 'react';
import { BookOpen, FlaskConical, Lock, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useApp } from '../lib/store';
import { Banner, Field } from '../components/ui';

export default function Login() {
  const { login, register } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, name, password);
    } catch (err: any) {
      setError(err?.message || 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between bg-navy-900 p-10 text-white overflow-hidden">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-navy-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500 text-navy-950 font-bold text-lg">IB</div>
            <div>
              <p className="font-semibold">IFRS Bridge Maroc</p>
              <p className="text-xs text-navy-300">Conversion comptable CGNC → IAS/IFRS</p>
            </div>
          </div>
        </div>
        <div className="relative space-y-6">
          <h1 className="text-3xl font-semibold leading-tight">
            Du référentiel marocain CGNC aux normes internationales IAS/IFRS, avec traçabilité complète.
          </h1>
          <ul className="space-y-3 text-sm text-navy-100">
            <li className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-teal-300" />
              Aucun montant inventé : le moteur déterministe vérifie chaque calcul et chaque écriture.
            </li>
            <li className="flex items-start gap-2.5">
              <BookOpen className="mt-0.5 h-4 w-4 text-teal-300" />
              Références normatives rattachées aux retraitements, avec mention « Référence à vérifier ».
            </li>
            <li className="flex items-start gap-2.5">
              <FlaskConical className="mt-0.5 h-4 w-4 text-teal-300" />
              Mode démonstration avec un dossier fictif cohérent pour découvrir le processus complet.
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-navy-400">
          Projet pédagogique — Master Audit / Contrôle de gestion — module Normes comptables internationales IAS/IFRS.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10 bg-navy-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-800 text-white font-bold">IB</div>
            <div>
              <p className="font-semibold text-navy-900">IFRS Bridge Maroc</p>
              <p className="text-xs text-navy-500">CGNC → IAS/IFRS</p>
            </div>
          </div>

          <div className="card card-pad">
            <h2 className="text-lg font-semibold text-navy-900">{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
            <p className="mt-1 text-sm text-navy-500">
              {mode === 'login' ? 'Accédez à vos dossiers de conversion.' : 'Le premier compte créé devient administrateur.'}
            </p>

            {error && <div className="mt-4"><Banner kind="error">{error}</Banner></div>}

            <form className="mt-5 space-y-4" onSubmit={submit}>
              {mode === 'register' && (
                <Field label="Nom complet" required>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-navy-300" />
                    <input className="input pl-9" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Prénom Nom" />
                  </div>
                </Field>
              )}
              <Field label="Adresse email" required>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-navy-300" />
                  <input type="email" className="input pl-9" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="vous@exemple.ma" />
                </div>
              </Field>
              <Field label="Mot de passe" hint={mode === 'register' ? '8 caractères minimum.' : undefined} required>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-navy-300" />
                  <input
                    type="password"
                    className="input pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === 'register' ? 8 : undefined}
                    placeholder="••••••••"
                  />
                </div>
              </Field>
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? 'Veuillez patienter…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-navy-500">
              {mode === 'login' ? 'Pas encore de compte ?' : 'Vous avez déjà un compte ?'}{' '}
              <button
                className="link font-medium"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                }}
              >
                {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
              </button>
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-navy-400">
            Les clés d’API et les données comptables restent stockées localement sur votre poste.
          </p>
        </div>
      </div>
    </div>
  );
}
