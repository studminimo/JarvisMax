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

## Étape 2 — interface

Livré :

- feuilles sur l’accueil, le planning, chaque domaine d’objectifs et le prénom ;
- tâches, habitudes, objectifs, prénom et brouillon tenus dans `src/domain/board.ts` pour l’ouverture en cours ;
- accueil recalculé par `describeHome` à partir de cet état ;
- calendrier : veille, lendemain, semaine ou mois précédent et suivant, retour à aujourd’hui quand la date affichée est différente ;
- brouillon Jarvis, avec suggestions qui écrivent le texte et effacement. Aucun envoi.

Le comportement de l’étape 1 reste décrit dans la section « Comportement livré » de `docs/ARCHITECTURE.md`. Ici, un contrôle n’existe que s’il modifie cet état. Rien ne survit à la fermeture de l’application.

À la fin de cette étape, il n’y avait pas encore de compte Supabase.

## Étape 3 — compte

Livré :

- lecture inchangée des deux variables publiques, puis client Supabase seulement si elle réussit ;
- inscription et connexion par e-mail, session conservée sur l’appareil, déconnexion ;
- migration `supabase/migrations/20261119070000_profiles.sql` : une ligne par compte, RLS `auth.uid() = user_id`, création du profil à l’inscription ;
- prénom et fuseau enregistrés seulement quand Postgres renvoie la ligne mise à jour ;
- accueil et planning qui utilisent ce fuseau et ce prénom une fois la session ouverte.

Sans `.env` renseigné, l’onglet Profil indique que la configuration est absente. Il n’y a pas de bouton de connexion dans ce cas.

Pour brancher un projet Supabase :

1. Copier `.env.example` vers `.env` s’il n’existe pas.
2. Y placer l’URL du projet et la clé `anon`. Ne pas y mettre la clé `service_role`.
3. Appliquer la migration dans l’éditeur SQL du projet, ou avec `supabase db push` une fois le projet lié.
4. Relancer l’application.

Toujours absent : tâches conservées, notifications programmées, conversation envoyée, voix. Les colonnes d’horaires et de profil de notification existent, sans interface.

## Étape 4 — tâches et rappels

Livré :

- tâches du compte : titre, jour, heure facultative, priorité, contexte, répétition (aucune, chaque jour, chaque semaine, jours ouvrés) ;
- écriture confirmée seulement quand Postgres renvoie la même ligne. Hors compte, la tâche reste celle de l’ouverture ;
- déplacement : maintenir une tâche, puis toucher un jour en semaine ou en mois. +15 min, +1 h, Plus tard et Ignorer sont dans la tâche ;
- une répétition terminée avance à l’occurrence suivante au lieu de rester cochée ;
- profil de notification enregistré sur le compte : Normal, Intensif, Concentration, Repos, Personnalisé ;
- plan de rappels sur 48 h, plafonné à 64. Sur l’iPhone et Android, ils sont programmés après autorisation. Le navigateur le dit, sans bouton d’autorisation.

Appliquer aussi `supabase/migrations/20261119140000_tasks.sql` après la migration des profils.

Toujours absent à la fin de cette étape : file d’attente hors ligne, conversation envoyée, voix. Les habitudes et les objectifs restent ceux de l’ouverture.

## Étape 5 — conversation

Livré :

- brouillon envoyé seulement avec une session. Sans compte, ou sans configuration publique, il n’y a pas de bouton Envoyer ;
- fonction `supabase/functions/chat` : elle lit `OPENAI_API_KEY` dans son environnement, appelle OpenAI avec le JWT de l’utilisateur, et n’utilise pas la clé `service_role` ;
- une information manquante devient une question. Une routine, un objectif ou un outil inconnu répond qu’il n’est pas disponible ;
- une tâche ou un souvenir n’est confirmé que si Postgres renvoie la même ligne. Une catégorie santé, argent ou privé exige `agreed` ;
- les plans et les bilans sont proposés dans la réponse. Ils ne sont pas enregistrés ;
- après une écriture confirmée, le planning recharge les tâches du compte.

Appliquer `supabase/migrations/20261119150000_chat.sql`, puis, dans un terminal à toi :

```bash
npx supabase functions deploy chat
npx supabase secrets set OPENAI_API_KEY
```

La clé OpenAI ne va pas dans `.env`. Tant que la fonction ou le secret manque, Envoyer affiche « Jarvis n’a pas répondu. »

## Étape 6 — mémoire

Livré :

- sur le profil, la liste des souvenirs du compte. Hors connexion, l’écran le dit et n’offre aucun enregistrement ;
- ajout, modification et suppression confirmés seulement quand Postgres renvoie la ligne, ou confirme l’effacement ;
- catégories Préférence, Fait, Personne, Santé, Argent, Privé. Santé, Argent et Privé sont sensibles : le bouton Enregistrer apparaît après « J’accepte d’enregistrer cette information sensible ».

## Étape 7 — routines, coach, voix

Livré :

- routines sur l’accueil : titre, étapes, répétition chaque jour. Une étape cochée n’est confirmée qu’après la ligne Postgres. Hors connexion, l’écran le dit ;
- modes Normal, Débordé, Concentration, Jeu, Famille, Préparation, Absence. Débordé et Absence ne laissent qu’une action. Le mode est enregistré sur le compte une fois connecté ;
- objectifs et habitudes du compte quand le coach répond. Sinon ils restent sur cet écran, avec la mention de session ;
- note du jour, enregistrée seulement après la ligne Postgres ;
- minuteur local de 5, 15 ou 25 minutes. Il n’est pas un widget iOS ;
- Dicter et Lire dans Jarvis. Si l’appareil ne le permet pas, l’écran le dit ;
- calendrier, widgets, raccourcis et lieu restent non branchés.

La migration `20261119160000_coach.sql` se colle dans l’éditeur SQL de JarvisMax. Puis :

```bash
npx supabase functions deploy chat
```

Tant que cette migration n’est pas appliquée, l’accueil dit que le coach n’est pas disponible. Les tâches restent utilisables.

## Étape 8 — rappels du site

Livré :

- le site peut être ajouté à l’écran d’accueil : manifeste, icône, affichage autonome ;
- sur iPhone, l’autorisation n’est proposée qu’après l’ouverture depuis l’icône ;
- l’abonnement est enregistré seulement quand Postgres renvoie la même adresse ;
- les rappels des 48 prochaines heures sont préparés à partir du même plan que l’application ;
- la fonction `reminders` envoie ceux dont l’heure est passée depuis moins de quinze minutes. Elle exige `REMINDERS_CRON_SECRET`. La clé privée VAPID et la clé service restent des secrets de fonction.

Tant que le site n’est pas servi en HTTPS, l’iPhone ne peut pas recevoir ces rappels. `localhost` ne suffit pas.

Après la migration `20261119170000_web_push.sql` :

1. Générer une paire VAPID. Mettre la clé publique dans `EXPO_PUBLIC_VAPID_PUBLIC_KEY`. Ne pas mettre la clé privée dans `.env`.
2. Enregistrer les secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `REMINDERS_CRON_SECRET`.
3. Lancer `npx supabase functions deploy reminders --no-verify-jwt`.
4. Activer `pg_cron` et `pg_net`, puis planifier un appel chaque minute vers la fonction, avec l’en-tête `x-cron-secret`.

## Étapes suivantes

10. Intégrations — une à la fois, derrière le dépôt existant. Passer `connected` à `true` seulement quand le branchement fonctionne, et afficher alors le réglage.

Chaque étape met à jour ce guide, ajoute les tests du module touché, et se vérifie par `npm test`, `npm run lint` et `npm run typecheck`.
