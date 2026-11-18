# Architecture

JARVIS est un assistant personnel iOS. Cette étape pose le socle : application Expo, thème, navigation, et modules de domaine testés. Les tâches, la mémoire, les notifications programmées et l’IA arrivent dans les étapes suivantes. Une action n’est confirmée à l’utilisateur qu’une fois enregistrée.

## Décisions

- Expo Router et TypeScript. Les écrans vivent dans `app/`, le reste dans `src/`. L’alias `@/` pointe vers `src/`.
- L’interface est en français, sombre, bleu nuit et bleu électrique. Le fuseau affiché est `Europe/Paris` jusqu’au profil utilisateur.
- L’application reste en ligne d’abord. À l’étape 4, SQLite devient la file d’attente locale et Postgres la source distante.
- Les rappels à l’heure seront des notifications locales. Le push et le cron serviront aux bilans. iOS limite à 64 notifications programmées : le planificateur calculera une fenêtre de 48 h.
- L’IA écrira depuis une Edge Function, avec le JWT de l’utilisateur et les politiques RLS. La clé OpenAI reste un secret de fonction.
- Le schéma sera multi-utilisateur (`user_id` + RLS) dès la première migration.

## Arborescence

- `app/` — routes : cinq onglets et la page introuvable.
- `src/components/` — texte, écran, carte, contrôle segmenté, horloge, erreur.
- `src/theme/` — couleurs, espacements, typographie Outfit.
- `src/features/` — accueil, conversation, planning, objectifs, profil.
- `src/domain/` — fonctions pures : temps, calendrier, accueil, objectifs, clé de notification, noms d’outils, journal technique.
- `src/data/` — lecture de la configuration Supabase publique, journal console, type de file de synchronisation.
- `src/integrations/slots.ts` — emplacements typés, tous déconnectés, absents de l’interface.
- `supabase/migrations/` et `supabase/functions/` — réservés aux étapes 3 et 5.
- `docs/` — cette note et le guide de développement.

L’interface importe le domaine. Le domaine n’importe ni React, ni Supabase, ni OpenAI.

## Comportement livré

Cinq onglets navigables :

1. Accueil — salutation selon l’heure de Paris, date et heure réelles, cartes calculées par `describeHome`. Sans données, les cartes disent qu’il n’y a rien.
2. Jarvis — indique que la conversation n’est pas encore disponible. Pas de champ de saisie.
3. Planning — bascule jour, semaine et mois sur le vrai calendrier (semaine commencée le lundi). La veille, le lendemain et la sélection d’un jour changent la date affichée. La liste du jour est vide.
4. Objectifs — sept domaines, chacun avec le résumé d’un compteur. Le compteur vaut zéro.
5. Profil — aucun compte, fuseau affiché, version de l’application.

Le bouton « Réessayer » de l’erreur de navigation relance l’écran. Le message technique est journalisé après masquage des secrets, et n’est pas montré tel quel.

## Contrats déjà fixés

- `Result` distingue un succès et un échec.
- `notificationKey` produit `jarvis:{type}:{id}:{kind}:{instant UTC}`. Six familles : anticipée, principale, relance, confirmation, retard, préparation. Le planificateur qui programme réellement les notifications n’existe pas encore.
- `AI_TOOL_NAMES` liste les seize outils. Aucun n’est appelé.
- `readSupabasePublicConfig` accepte seulement `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`, en HTTPS. Une clé `sk-` ou un JWT de rôle `service_role` est refusé. Aucun client Supabase n’est créé.
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

La conversation enverra un résumé du jour à la fonction `chat`. Un outil d’écriture ne sera décrit comme réussi que si Postgres a enregistré la ligne. Une information manquante produira une question, pas une écriture. `save_memory` sur une catégorie sensible exigera un accord explicite.
