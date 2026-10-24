import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Filter,
  Lightbulb,
  ListChecks,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import { Card, CardHeader } from '../components/ui';

const ENTREES = [
  { label: 'Balance générale CGNC', desc: 'Comptes, libellés, soldes débit/crédit — source de référence prioritaire.' },
  { label: 'Bilan et compte de produits et charges', desc: 'Utilisés pour le contrôle et en l’absence de balance.' },
  { label: 'Journal comptable', desc: 'Source de dernier recours lorsque aucune balance n’est disponible.' },
  { label: 'Détail des immobilisations', desc: 'Coût, date de mise en service, durée, mode d’amortissement (IAS 16 / IAS 38).' },
  { label: 'Contrats de location', desc: 'Loyers, durée, taux d’actualisation (IFRS 16).' },
  { label: 'Saisie manuelle', desc: 'Création de lignes de balance directement dans l’application.' },
];

const TRAITEMENT = [
  { label: 'Extraction & structuration', desc: 'Lecture des fichiers Excel / CSV / PDF texte, normalisation des comptes et détection de la source de référence.' },
  { label: 'Correspondance CGNC → IFRS', desc: 'Affectation de chaque compte à une rubrique IFRS, avec niveau de confiance et possibilité de correction manuelle.' },
  { label: 'Analyse des divergences', desc: 'Le moteur déterministe confronte les comptes aux conditions des normes IAS/IFRS et signale les écarts, sans retraitement par défaut.' },
  { label: 'Calcul des retraitements', desc: 'Chaque retraitement justifié est calculé (étapes de calcul traçables) et traduit en écritures débit/crédit équilibrées.' },
  { label: 'Validation', desc: 'Chaque écriture doit être équilibrée et approuvée par l’utilisateur ; seuls les retraitements validés composent les états définitifs.' },
  { label: 'Production des livrables', desc: 'Tableau de passage, états financiers retraités et exports Excel / PDF.' },
];

const SORTIES = [
  { label: 'Tableau de passage CGNC → IFRS', desc: 'Solde CGNC, reclassements, ajustements et solde IFRS par rubrique, avec traçabilité des retraitements.' },
  { label: 'État de la situation financière', desc: 'Actifs, capitaux propres et passifs retraités (IAS 1).' },
  { label: 'État du résultat et OCI', desc: 'Produits, charges, impôt et autres éléments du résultat global.' },
  { label: 'Tableau des flux de trésorerie', desc: 'Présenté dans la mesure des informations disponibles.' },
  { label: 'Tableau de variation des capitaux propres', desc: 'Mouvements et capitaux propres à la clôture.' },
  { label: 'Notes annexes', desc: 'Justifications, hypothèses et références normatives.' },
  { label: 'Exports', desc: 'Tableau de passage, écritures, synthèse et rapport de conversion (Excel / PDF).' },
];

const A_DEVELOPPER = [
  'Import de documents Word (.docx) et de PDF scannés (OCR) — seul le PDF texte est pris en charge.',
  'Extraction automatique des durées et taux depuis les contrats de location scannés.',
  'Tableau des flux de trésorerie complet par méthode indirecte lorsque les informations de variation du fonds de roulement sont absentes.',
  'Rapprochement multi-exercices et comptes de résultat par nature/par fonction.',
  'Génération des états financiers directement au format XBRL.',
];

export default function About() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">À propos du projet</h1>
        <p className="text-sm text-navy-500">
          IFRS Bridge Maroc — passerelle de conversion des comptes sociaux marocains (CGNC) vers les normes IAS/IFRS.
        </p>
      </div>

      <Card className="card-pad">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-500 text-navy-950 font-bold">IB</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-navy-900">IFRS Bridge Maroc</p>
            <p className="text-xs text-navy-500">
              Application pédagogique de conversion CGNC → IAS/IFRS · module « Normes comptables internationales IAS/IFRS » ·
              Master Audit &amp; Contrôle de gestion
            </p>
          </div>
          <Link to="/nouvelle-conversion" className="btn-primary btn-sm">
            Démarrer une conversion <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>

      {/* Problématique / Objectif */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Problématique" subtitle="Pourquoi cette application ?" icon={<Lightbulb className="h-5 w-5" />} />
          <div className="card-pad text-sm text-navy-600 space-y-3">
            <p>
              Les entreprises marocaines tiennent leur comptabilité selon le <strong>CGNC</strong> (Code général de normalisation
              comptable), fondé sur des règles fiscales et juridiques nationales. Le passage aux normes <strong>IAS/IFRS</strong>, exigé
              pour la consolidation, l’accès aux marchés de capitaux ou la communication vers des investisseurs étrangers, ne se réduit
              pas à une simple traduction de libellés.
            </p>
            <p>
              Il impose de <strong>réexaminer chaque poste</strong> au regard des conditions des normes internationales, d’identifier les
              divergences réelles, de les justifier par un texte de référence et de traduire ces écarts en écritures de retraitement
              cohérentes et vérifiables.
            </p>
            <p>
              Ce travail est aujourd’hui manuel, chronophage et source d’erreurs : il est difficile de tracer l’origine de chaque
              montant, de garantir l’équilibre des écritures et d’éviter les retraitements appliqués « par réflexe » sans vérification des
              conditions.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Objectif" subtitle="Ce que l’application apporte" icon={<Target className="h-5 w-5" />} />
          <div className="card-pad text-sm text-navy-600 space-y-3">
            <p>
              Fournir un <strong>outil structuré et traçable</strong> qui guide l’utilisateur de l’import des données CGNC jusqu’à la
              production d’états financiers retraités selon IAS/IFRS, en respectant trois principes non négociables :
            </p>
            <ul className="space-y-2">
              <Principle icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}>
                <strong>Aucun retraitement par défaut</strong> : un écart n’est proposé que si les conditions de la norme sont réunies au vu
                des données fournies.
              </Principle>
              <Principle icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}>
                <strong>Aucun montant inventé</strong> : si une information manque (durée, taux, valeur résiduelle…), le retraitement est
                marqué « Informations complémentaires requises » plutôt que d’estimer une valeur.
              </Principle>
              <Principle icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}>
                <strong>Calcul déterministe et vérifiable</strong> : tous les montants sont produits par un moteur de calcul contrôlable ;
                l’IA n’explique et ne reformule jamais de montant définitif.
              </Principle>
            </ul>
          </div>
        </Card>
      </div>

      {/* Entrées / Traitement / Sorties */}
      <div className="grid gap-5 lg:grid-cols-3">
        <ProcessCard title="Entrées" subtitle="Documents et données fournis" icon={<FileSpreadsheet className="h-5 w-5" />} items={ENTREES} />
        <ProcessCard title="Traitement" subtitle="Étapes réalisées par la plateforme" icon={<Calculator className="h-5 w-5" />} items={TRAITEMENT} numbered />
        <ProcessCard title="Sorties" subtitle="Livrables produits" icon={<ScrollText className="h-5 w-5" />} items={SORTIES} />
      </div>

      {/* Chaîne en 6 étapes */}
      <Card>
        <CardHeader title="Le processus en six étapes" subtitle="De l’import CGNC aux états financiers retraités" icon={<ListChecks className="h-5 w-5" />} />
        <div className="card-pad">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { n: 1, t: 'Import des données CGNC', d: 'Balance, bilan, CPC, journal ou saisie manuelle (Excel / CSV / PDF texte).' },
              { n: 2, t: 'Extraction, structuration et vérification', d: 'Normalisation des comptes, choix de la source de référence, contrôles de cohérence.' },
              { n: 3, t: 'Analyse des divergences', d: 'Identification des écarts CGNC ↔ IFRS et des informations manquantes.' },
              { n: 4, t: 'Calcul des retraitements justifiés', d: 'Montants calculés, références normatives et écritures débit/crédit.' },
              { n: 5, t: 'Validation par l’utilisateur', d: 'Approbation, modification ou rejet ; contrôle d’équilibre de chaque écriture.' },
              { n: 6, t: 'Tableau de passage & états retraités', d: 'États financiers définitifs et exports Excel / PDF.' },
            ].map((s) => (
              <div key={s.n} className="flex gap-3 rounded-lg border border-navy-100 p-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-600">{s.n}</span>
                <div>
                  <p className="text-sm font-semibold text-navy-900">{s.t}</p>
                  <p className="mt-0.5 text-xs text-navy-500">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Limites */}
      <Card>
        <CardHeader title="Limites et précautions d’usage" subtitle="Ce que l’application ne fait pas" icon={<AlertTriangle className="h-5 w-5" />} />
        <div className="card-pad space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <ShieldCheck className="h-4 w-4" /> Références normatives
              </p>
              <p className="mt-1.5 text-sm text-amber-800">
                Les numéros de paragraphe non vérifiés sont explicitement signalés « <strong>Référence à vérifier</strong> ». L’utilisateur
                doit confronter chaque justification au texte officiel des normes avant de valider un retraitement. Aucun numéro de
                paragraphe n’est inventé.
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <Sparkles className="h-4 w-4" /> Rôle de l’IA
              </p>
              <p className="mt-1.5 text-sm text-amber-800">
                L’IA est strictement facultative et n’a qu’un rôle d’assistance rédactionnelle. Elle ne calcule pas les montants, ne
                décide pas des retraitements et ne remplace pas le jugement de l’utilisateur. Le moteur déterministe fonctionne seul, sans
                clé d’API.
              </p>
            </div>
            <div className="rounded-lg border border-navy-100 bg-navy-50/40 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy-800">
                <Filter className="h-4 w-4" /> Périmètre des états
              </p>
              <p className="mt-1.5 text-sm text-navy-600">
                Certains états (flux de trésorerie, tableau de variation des capitaux propres) peuvent être <strong>partiels</strong> lorsque
                les informations nécessaires ne figurent pas dans les documents importés. Le périmètre de couverture est affiché sur chaque
                état.
              </p>
            </div>
            <div className="rounded-lg border border-navy-100 bg-navy-50/40 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy-800">
                <XCircle className="h-4 w-4" /> Portée pédagogique
              </p>
              <p className="mt-1.5 text-sm text-navy-600">
                Cette application a une finalité pédagogique. Elle ne constitue pas un avis d’audit, une attestation ni un avis juridique
                ou fiscal. Les résultats doivent être revus par un professionnel avant tout usage officiel.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-4">
            <p className="text-sm font-semibold text-orange-900">Fonctionnalités à développer</p>
            <ul className="mt-2 space-y-1.5">
              {A_DEVELOPPER.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-orange-800">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* Confidentialité & ressources */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="card-pad">
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
            <div className="text-sm text-navy-600">
              <p className="font-semibold text-navy-900">Données et confidentialité</p>
              <p className="mt-1">
                Les données comptables sont stockées localement (base SQLite) et les fichiers importés restent privés. Les clés d’API sont
                conservées côté serveur et ne sont jamais renvoyées au navigateur. Aucune donnée n’est transmise à un tiers sauf si
                l’envoi au modèle externe a été explicitement autorisé dans les paramètres.
              </p>
            </div>
          </div>
        </Card>
        <Card className="card-pad">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
            <div className="text-sm text-navy-600">
              <p className="font-semibold text-navy-900">Pour aller plus loin</p>
              <p className="mt-1">
                Consultez la{' '}
                <Link to="/normes" className="link">bibliothèque des normes</Link> pour le texte et les paragraphes des normes utilisées, ou
                lancez une <Link to="/" className="link">démonstration</Link> pour parcourir un dossier fictif complet et équilibré.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Principle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

function ProcessCard({
  title,
  subtitle,
  icon,
  items,
  numbered,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  items: { label: string; desc: string }[];
  numbered?: boolean;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} icon={icon} />
      <ul className="divide-y divide-navy-100">
        {items.map((it, i) => (
          <li key={it.label} className="flex gap-3 px-5 py-3">
            {numbered ? (
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-100 text-[11px] font-semibold text-navy-600">
                {i + 1}
              </span>
            ) : (
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
            )}
            <div>
              <p className="text-sm font-medium text-navy-800">{it.label}</p>
              <p className="mt-0.5 text-xs text-navy-500">{it.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
