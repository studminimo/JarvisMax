# Architecture

JARVIS est un assistant personnel iOS. Cette étape pose le socle : application Expo, thème, navigation, et modules de domaine testés. Les tâches, la mémoire, les notifications programmées et l’IA arrivent dans les étapes suivantes. Une action n’est confirmée à l’utilisateur qu’une fois enregistrée.

## Décisions

- Expo Router et TypeScript. Les écrans vivent dans `app/`, le reste dans `src/`. L’alias `@/` pointe vers `src/`.
- L’interface est en français, sombre, bleu nuit et bleu électrique. Le fuseau affiché est `Europe/Paris` jusqu’au profil utilisateur.
- L’application reste en ligne d’abord. Les tâches d’un compte sont écrites dans Postgres. Une écriture refusée n’est pas affichée comme enregistrée.
- Les rappels à l’heure seront des notifications locales. Le push et le cron serviront aux bilans. iOS limite à 64 notifications programmées : le planificateur calculera une fenêtre de 48 h.
- L’IA écrit depuis l’Edge Function `chat`, avec le JWT de l’utilisateur et les politiques RLS. La clé OpenAI reste un secret de fonction.
- Le schéma sera multi-utilisateur (`user_id` + RLS) dès la première migration.

## Arborescence

- `app/` — routes : cinq onglets et la page introuvable.
- `src/components/` — texte, écran, carte, contrôle segmenté, horloge, erreur.
- `src/theme/` — couleurs, espacements, typographie Outfit.
- `src/features/` — accueil, conversation, planning, objectifs, profil.
- `src/domain/` — fonctions pures : temps, calendrier, accueil, objectifs, clé de notification, noms d’outils, journal technique.
- `src/data/` — lecture de la configuration Supabase publique, journal console, type de file de synchronisation.
- `src/integrations/slots.ts` — emplacements typés, tous déconnectés, absents de l’interface.
- `supabase/migrations/` — profils, tâches, conversation et mémoire, avec RLS. `supabase/functions/chat` répond avec le JWT de l’utilisateur.
- `docs/` — cette note et le guide de développement.

L’interface importe le domaine. Le domaine n’importe ni React, ni Supabase, ni OpenAI.

## Comportement livré

Cette section décrit le socle de l’étape 1. L’interface détaillée est livrée à l’étape 2. Le compte est décrit dans la section Compte. L’envoi Jarvis est livré à l’étape 5, dans le guide de développement.

Cinq onglets navigables :

1. Accueil — salutation selon l’heure de Paris, date et heure réelles, cartes calculées par `describeHome`. Sans données, les cartes disent qu’il n’y a rien.
2. Jarvis — indique que la conversation n’est pas encore disponible. Pas de champ de saisie.
3. Planning — bascule jour, semaine et mois sur le vrai calendrier (semaine commencée le lundi). La veille, le lendemain et la sélection d’un jour changent la date affichée. La liste du jour est vide.
4. Objectifs — sept domaines, chacun avec le résumé d’un compteur. Le compteur vaut zéro.
5. Profil — aucun compte, fuseau affiché, version de l’application.

Le bouton « Réessayer » de l’erreur de navigation relance l’écran. Le message technique est journalisé après masquage des secrets, et n’est pas montré tel quel.

## Compte

L’authentification est l’e-mail et le mot de passe. La session reste sur l’appareil. `detectSessionInUrl` est faux : si l’adresse doit être confirmée, la personne ouvre le message puis se connecte dans l’application.

La table `profiles` porte le prénom, le fuseau, les horaires et le profil de notification. Seuls le prénom et le fuseau ont une interface. Les horaires et le profil de notification ont leurs colonnes, sans bouton. Chaque politique exige `auth.uid() = user_id`. Un déclencheur crée la ligne à l’inscription.

Le prénom et le fuseau affichés après connexion sont ceux de la ligne renvoyée par Postgres. Un échec d’écriture ne change pas l’écran. Sans les deux variables publiques, le profil le dit et n’affiche aucun bouton de connexion. Le prénom saisi hors compte reste limité à l’ouverture en cours.

Les tâches d’un compte suivent la même règle : l’écran change après la ligne renvoyée. Le déplacement, l’heure, la répétition et le profil de notification passent par cette écriture. Hors compte, rien n’est envoyé.

## Contrats déjà fixés

- `Result` distingue un succès et un échec.
- `notificationKey` produit `jarvis:{type}:{id}:{kind}:{instant UTC}`. Six familles : anticipée, principale, relance, confirmation, retard, préparation. Le plan de l’étape 4 programme l’anticipation, le rappel principal et le retard, dans une fenêtre de 48 h et un plafond de 64.
- `AI_TOOL_NAMES` liste les seize outils. Aucun n’est appelé.
- `readSupabasePublicConfig` accepte seulement `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`, en HTTPS. Une clé `sk-` ou un JWT de rôle `service_role` est refusé. Le client Supabase n’est créé que si cette lecture réussit.
- `integrationSlots` réserve voix, calendrier externe, lieu, listes, documents, minuteur, widgets et raccourcis. `connected` vaut `false` pour chacun.

## Modèle prévu

Chaque table métier portera `id`, `user_id`, `created_at`, `updated_at`, avec une politique `auth.uid() = user_id`.

- `profiles` — prénom, fuseau, horaires, profil de notification.
- `tasks` — titre, échéance, priorité, contexte, répétition.
- `notification_specs` et `notification_profiles` — rappels et profils Normal, Intensif, Concentration, Repos, Personnalisé.
- `routines`, `routine_steps` — étapes et suivi.
- `goals`, `milestones`, `habits`, `habit_logs`.
- `memories` — catégorie, sensibilité, origine `user` ou `confirmed_suggestion`.
- `conversations`, `messages` — le résultat d’outil `ok` ou `error`.
- `journal_entries`, `reviews`, `focus_sessions`, `absence_periods`.
- `sync_outbox` — mutations locales.

La suppression de compte et l’export JSON passeront par des fonctions dédiées.

## Suite

Les notifications locales seront réconciliées à l’ouverture : annuler les identifiants obsolètes, programmer le delta, respecter le silence, l’absence et le plafond iOS. Les actions Terminé, +15 min, +1 h, Plus tard et Ignorer écriront dans le dépôt puis relanceront le planificateur.

La fonction `chat` reçoit un résumé du jour. Un outil d’écriture n’est confirmé que si Postgres a renvoyé la ligne. Une information manquante produit une question. `save_memory` sur une catégorie sensible exige un accord explicite. La consultation des souvenirs est décrite à l’étape 6 du guide de développement. Les routines, les modes du coach, les objectifs, les habitudes, la note du jour, le minuteur et la voix sont décrits à l’étape 7. Les rappels d’un site ajouté à l’écran d’accueil sont décrits à l’étape 8. Le calendrier, les widgets, les raccourcis et le lieu ne sont pas branchés.
