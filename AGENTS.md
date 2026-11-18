# JARVIS

Application Expo / React Native. Les routes sont dans `app/`. Le domaine, les données et l’interface sont dans `src/`. L’alias TypeScript `@/` pointe vers `src/`.

Lire `docs/ARCHITECTURE.md` et `docs/DEVELOPMENT.md` avant d’étendre le produit.

## Expo

Le SDK est celui de `package.json` (majeure 58). Avant d’utiliser une API Expo, EAS ou React Native, vérifier la page versionnée `https://docs.expo.dev/versions/v58.0.0/` ou l’index `https://docs.expo.dev/llms.txt`. Les API changent à chaque SDK.

```bash
npx expo install <package>
npm test
npm run lint
npm run typecheck
```

`ios/` et `android/` sont générés. Les configurer via `app.json` et les plugins, pas à la main.

## Règles du produit

- Une action visible fait quelque chose. Un écran vide le dit.
- La clé OpenAI et la clé `service_role` restent hors de l’application.
- Le domaine dans `src/domain` reste pur et testé.
- Les emplacements de `src/integrations/slots.ts` ne s’affichent que lorsqu’ils sont réellement branchés.
