# IFRS Bridge Maroc

Plateforme de conversion comptable **CGNC → IAS/IFRS**, à vocation pédagogique (module
« Normes comptables internationales IAS/IFRS », Master Audit & Contrôle de gestion).

L'application guide l'utilisateur de l'import des données comptables marocaines jusqu'à la
production d'états financiers retraités, selon un processus en **six étapes** :

1. **Import des données CGNC** — balance générale, bilan, CPC, journal ou saisie manuelle (Excel / CSV / PDF texte).
2. **Extraction, structuration et vérification** — normalisation des comptes, choix de la source de référence, contrôles de cohérence.
3. **Analyse des divergences** — identification des écarts CGNC ↔ IFRS et des informations manquantes.
4. **Calcul des retraitements justifiés** — montants calculés, références normatives et écritures débit/crédit.
5. **Validation par l'utilisateur** — approbation, modification ou rejet ; contrôle d'équilibre de chaque écriture.
6. **Tableau de passage & états retraités** — états financiers définitifs et exports Excel / PDF.

## Principes non négociables

- **Aucun retraitement par défaut** : un écart n'est proposé que si les conditions de la norme sont réunies au vu des données fournies.
- **Aucun montant inventé** : si une information manque (durée, taux, valeur résiduelle…), le retraitement est marqué
  « **Informations complémentaires requises** » plutôt que d'estimer une valeur.
- **Calcul déterministe** : tous les montants sont produits par un moteur de calcul traçable (étapes de calcul affichées).
  L'IA, strictement facultative, n'explique et ne reformule **jamais** de montant définitif.
- **Aucune citation inventée** : un numéro de paragraphe non vérifié est signalé « **Référence à vérifier** ».
- **Écritures équilibrées** : chaque écriture doit respecter débit = crédit, sinon la validation est bloquée.
- Seuls les retraitements **approuvés** entrent dans les états financiers **définitifs** (une vue « portée provisoire » existe pour le contrôle).

## Prérequis

- **Node.js ≥ 22.5** (recommandé : **Node 24**) — l'application utilise le module natif `node:sqlite`, sans dépendance externe de base de données.
- Windows : si l'exécution des scripts PowerShell est bloquée, préfixez les commandes `npm` / `npx` par `cmd /c` (ex. `cmd /c "npm install"`).

## Installation et démarrage

```bash
# 1. Installer les dépendances
cmd /c "npm install"

# 2. Développement (API + frontend avec rechargement à chaud)
cmd /c "npm run dev"
#    → API   : http://localhost:8787
#    → Vite  : http://localhost:5173  (proxy /api → 8787)

# 3. Production (build du frontend puis serveur qui sert dist/)
cmd /c "npm run build"
cmd /c "npm start"
#    → application complète : http://localhost:8787
```

Au premier lancement : créez un compte via l'écran de connexion, ou cliquez sur
**« Lancer une démonstration »** pour générer un dossier fictif complet et équilibré.

### Scripts npm

| Script | Rôle |
| --- | --- |
| `dev` | Lance l'API (`tsx watch`) et Vite en parallèle. |
| `dev:server` | API seule (port 8787). |
| `dev:web` | Frontend Vite seul. |
| `build` | Typecheck web (`tsc -b tsconfig.web.json`) puis build Vite dans `dist/`. |
| `start` | Sert l'API et le `dist/` construit. |
| `typecheck` | Typecheck du frontend. |

## Architecture

```
server/
  index.ts              Routes Express (auth, dossiers, documents, analyse, retraitements,
                        états, contrôles, exports, chat, démo, paramètres)
  db.ts                 Schéma SQLite (node:sqlite) + helpers
  seed/
    norms.ts            Référentiel des normes IAS/IFRS
    cgnc-map.ts         Correspondance CGNC → rubriques IFRS
    init.ts             Initialisation du référentiel
    demo.ts             Création / réinitialisation du dossier de démonstration
  engine/
    extract.ts          Lecture Excel / CSV / PDF texte, détection de format
    analysis.ts         Correspondances, analyse des divergences, propositions de retraitements
    compute.ts          Primitives de calcul (arrondis, actualisation, durées…)
    statements.ts       Tableau de passage CGNC → IFRS
    financials.ts       États financiers retraités (IAS 1)
    controls.ts         Contrôles qualité obligatoires
    exports.ts          Exports Excel (passage, écritures, synthèse, balance)
    report.ts           Rapport de conversion PDF
    ai.ts               Client LLM facultatif + assistant déterministe de repli

src/
  App.tsx               Routage + garde d'authentification
  components/           UI partagée (Layout, Assistant, ui, RequireDossier)
  lib/                  api, store (contexte), types, format
  pages/                Dashboard, NewConversion, Documents, Analysis, Adjustments,
                        AdjustmentDetail, Statements, Norms, Reports, Settings, About

scripts/
  verify.ts             Harnais de vérification du moteur (19 contrôles)
```

Stockage : SQLite dans `storage/ifrs-bridge.sqlite`, fichiers importés dans `storage/uploads/`.
La clé d'API IA est stockée côté serveur et n'est jamais renvoyée au navigateur.

## Mode démonstration

Le dossier de démonstration (fictif, cohérent et équilibré) contient notamment :

| Réf. | Norme | Objet | Montant |
| --- | --- | --- | --- |
| R002 | IAS 16 | Ajustement d'amortissement (durée CGNC 10 ans vs durée IFRS 5 ans) | 10 000,00 MAD |
| R004 | IFRS 16 | Droit d'utilisation et passif locatif (PV des loyers) | 198 727,61 MAD |
| R005 | IAS 38 | Radiation de dépenses non comptabilisables | 16 000,00 MAD |
| R007 | IAS 12 | Impôts différés nets | 3 116,02 MAD |
| R008 | IAS 1 | Reclassement courant / non courant | — |

Les retraitements sont créés au statut **« À valider »** afin d'exercer le circuit de validation.
Impact total sur les capitaux propres : **−28 464,09 MAD**. Équation comptable IFRS équilibrée.

## Vérification

Le moteur déterministe est couvert par un harnais de vérification :

```bash
cmd /c "npx tsx scripts/verify.ts"
```

Résultat attendu : **19/19 vérifications réussies**. Les tests couvrent notamment :
conservation des montants importés, détection des divergences, calcul IAS 16 / IFRS 16 / IAS 12,
absence de montant inventé (postes en « Informations complémentaires requises »), équilibre des écritures,
équation comptable CGNC et IFRS, cohérence résultat / capitaux propres, contrôles qualité,
production des états financiers et des exports, et comportement d'un dossier sans données (bloquant explicite).

Typecheck du backend :

```bash
cmd /c "npx tsc -p tsconfig.server.json"
```

## Limites et précautions d'usage

- **Références normatives** : les numéros de paragraphe non validés sont marqués « Référence à vérifier » et doivent être
  confrontés au texte officiel avant validation. Aucun numéro n'est inventé.
- **Rôle de l'IA** : facultative, à rôle rédactionnel uniquement. Elle ne calcule pas les montants et ne décide pas des
  retraitements. Le moteur déterministe fonctionne sans clé d'API.
- **Périmètre des états** : certains états (flux de trésorerie, variation des capitaux propres) peuvent être **partiels**
  lorsque les informations nécessaires ne figurent pas dans les documents importés ; le périmètre de couverture est affiché.
- **Portée pédagogique** : l'application ne constitue ni un avis d'audit, ni une attestation, ni un avis juridique ou fiscal.

### Fonctionnalités à développer

- Import de documents Word (`.docx`) et de PDF **scannés** (OCR) — seul le **PDF texte** est pris en charge ; les fichiers
  scannés et `.docx` renvoient une erreur explicite « non pris en charge / fonctionnalité à développer ».
- Extraction automatique des durées et taux depuis des contrats de location scannés.
- Tableau des flux de trésorerie complet par méthode indirecte lorsque les variations du fonds de roulement sont absentes.
- Rapprochement multi-exercices et compte de résultat par nature / par fonction.
- Génération des états financiers au format XBRL.

## Sécurité et confidentialité

- Données comptables et fichiers stockés **localement** ; fichiers privés par dossier.
- Mots de passe hachés (`crypto.scryptSync`) ; sessions par cookie.
- Clé d'API IA stockée côté serveur, jamais exposée au navigateur.
- Aucune donnée transmise à un tiers, sauf si l'envoi au modèle externe a été **explicitement autorisé** dans les paramètres.
