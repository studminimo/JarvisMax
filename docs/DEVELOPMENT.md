# Développement

## Prérequis

- Node.js 22
- npm 10
- Expo SDK 58

Le dépôt contient l’application à la racine et le dossier `supabase/` à côté. Il n’y a pas de monorepo.

## Commandes

```bash
npm install
npm test
npm run lint
npm run typecheck
npm start
```

`npm start` ouvre Expo. `npm run ios` demande macOS. `npm run web` sert l’interface dans le navigateur. Les tests Jest couvrent le domaine et ne lancent pas de téléphone.

## Secrets

Copier `.env.example` vers `.env` au moment de brancher Supabase. Les seules variables publiques prévues sont :

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

La clé anonyme est acceptable avec les politiques RLS. La clé `service_role` et la clé OpenAI n’entrent pas dans l’application. OpenAI se configurera comme secret de la fonction Edge `chat`.

`readSupabasePublicConfig` refuse une clé OpenAI ou une clé service placée dans la variable publique. Le journal technique masque les chaînes `sk-…` et les JWT avant de les écrire.

## Étape 1 — socle

Livré :

- projet Expo Router, TypeScript strict, alias `@/`, ESLint, Jest ;
- thème sombre et cinq onglets ;
- calendrier consultable, horloge, états vides calculés ;
- contrats d’outils, de clé de notification, de configuration et d’intégrations ;
- cette documentation.

Volontairement absent : compte Supabase, tâches enregistrées, notifications programmées, conversation, voix, et tout bouton dont l’action n’existe pas.

## Étapes suivantes

2. Interface — composer les écrans détaillés sur les mêmes composants, toujours branchés à un état réel.
3. Supabase — auth e-mail, migrations, RLS, profil. Remplir `.env`.
4. Tâches et rappels — CRUD, répétitions, glisser-déposer, planificateur et profils de notification. Première version utilisable au quotidien.
5. IA — Edge Function, outils, questions si une information manque, confirmation fidèle à la base.
6. Mémoire — consultation, édition, suppression, accord pour le sensible.
7. Routines — étapes, horaires, suivi, modification en langage naturel via les outils déjà prévus.
8. Coach — objectifs par domaine, habitudes, journal facultatif, bilans, modes débordé, concentration, jeu, famille, préparation, absence.
9. Voix — dictée et lecture sur le même moteur d’outils.
10. Intégrations — une à la fois, derrière le dépôt existant. Passer `connected` à `true` seulement quand le branchement fonctionne, et afficher alors le réglage.

Chaque étape met à jour ce guide, ajoute les tests du module touché, et se vérifie par `npm test`, `npm run lint` et `npm run typecheck`.
