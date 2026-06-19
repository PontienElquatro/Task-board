# MyTaskBoard 🧠

MyTaskBoard est une application de gestion de tâches de type Kanban, moderne et performante, construite avec les dernières technologies du web.

## 🚀 Fonctionnalités

- **Tableau Kanban Complet** : Visualisez vos tâches par colonnes (À faire, En cours, Terminé).
- **Gestion Dynamique** : Créez, consultez, modifiez et supprimez des tâches facilement.
- **Priorités Visuelles** : Attribuez des niveaux de priorité (Basse, Moyenne, Haute) avec des indicateurs colorés.
- **Persistance des Données** : Vos tâches sont sauvegardées automatiquement dans le `LocalStorage` de votre navigateur.
- **Routage Moderne** : Système de navigation entre la page de connexion et le tableau de bord.
- **Interface Responsive** : Design épuré et adaptatif grâce à Tailwind CSS.

## 🛠️ Stack Technique

- **Framework** : [Angular 19.2+](https://angular.dev/)
- **Gestion d'état** : Angular Signals (pour une réactivité optimale)
- **Style** : [Tailwind CSS 4.0](https://tailwindcss.com/)
- **Navigation** : Angular Router
- **Rendu** : SSR (Server-Side Rendering) activé

## 💻 Installation et Démarrage

1. **Installer les dépendances** :
   ```bash
   npm install
   ```

2. **Lancer le serveur de développement** :
   ```bash
   npm start
   ```
   L'application sera accessible sur `http://localhost:4200/`.

## 📦 Déploiement sur Vercel

Ce projet est prêt pour un déploiement sur Vercel.

1. Connectez votre dépôt GitHub/GitLab à Vercel.
2. Vercel détectera automatiquement la configuration Angular.
3. Le fichier `vercel.json` est déjà inclus pour gérer les redirections du routage.

## 📝 Licence

Projet réalisé dans le cadre d'un audit et d'une refactorisation technique.
