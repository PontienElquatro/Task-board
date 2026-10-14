# Performance — bloc en cours

Référence validée : efeb52a, 160 tests, build utilisateur et CI verte.
Le bundle initial est de 774 313 octets, dont 131 977 octets de CSS global.
Les deux plus gros chunks JS mesurent 266 893 et 236 753 octets ; leur contenu
doit être attribué via le rapport de build avant de modifier les dépendances.

## Premier réglage : sources Tailwind explicites

La détection automatique peut scanner les sorties de compilation et les outils
dans une copie de vérification qui ne contient pas le .gitignore du dépôt.
Le CSS utilise maintenant source(none), avec app et index.html enregistrés
explicitement. Les classes complètes des palettes TypeScript restent analysées.
Aucun style manuel, fonction métier, mécanisme Auth ou budget Angular n'est retiré.

Comparaison PostCSS locale du même contenu :

- Détection automatique : 131 294 octets, gzip 23 581 octets.
- Sources explicites : 90 470 octets, gzip 16 458 octets.
- Gain mesuré dans ce diagnostic : 40 824 octets (~31 %), gzip 7 123 octets.

Ce diagnostic n'est pas un nouveau build Angular ni une mesure réseau en
production. La compilation optimisée, la suite navigateur et les contrôles
visuels mobile/sombre/clavier restent à valider. Le seuil de 500 kB reste inchangé.

Le test style-sources vérifie les sources attendues, des classes responsives,
sombres et les palettes, et l'absence d'une classe présente uniquement dans
un fichier non enregistré. analyze-performance reconstruit le graphe initial
par les imports statiques ; les imports dynamiques ne sont pas comptés au démarrage.

Les deux tests style-sources ont passé dans la copie isolée le 13 octobre 2026.
La compilation Angular avec --stats-json est la prochaine preuve requise pour
mesurer le bundle après changement et attribuer les gros chunks JS. Aucun gain
JS, temps de chargement réel ou score Lighthouse n'est encore revendiqué.

## Build utilisateur du premier lot

Le 13 octobre : 160 tests sur 34 fichiers, build et contrôle CSS réussis.
CSS global : 92,11 kB au lieu de 131,98 kB. Bundle initial : 734,44 kB au lieu
de 774,31 kB (gain 39,87 kB, environ 5,15 %). Le budget de 500 kB reste dépassé.

Le stats.json attribue le chunk de 266,89 kB au runtime Angular et celui de
236,75 kB au client Supabase et à ses modules Auth, PostgREST, Storage et Realtime.
Ils ne sont pas supprimés : connexion et collaboration en dépendent.
Le main contient aussi 5 649 octets de résolution des conflits et 3 989 octets
de récupération, en plus de leurs dépendances transitives.

## Deuxième lot — chargement différé des fenêtres

Les composants autonomes de conflit et récupération sont chargés par @defer
uniquement lorsque leur condition d'ouverture est vraie. Les conditions restent
à l'extérieur du bloc pour détruire la fenêtre lorsqu'elle se ferme. Il n'y a
pas de préchargement au repos. Messages de chargement et d'erreur explicites :
en cas d'échec du composant de conflit, l'export reste disponible et le conflit
reste actif ; une récupération non chargée peut être fermée sans écriture.
La connexion, la sauvegarde, les permissions et le SDK ne sont pas modifiés.

Trois tests couvrent démarrage sans fenêtre, fallback d'export du conflit et
fermeture d'une récupération non chargée. Leur exécution, le nouveau build et
le gain JavaScript restent à confirmer. Le bloc performance n'est pas clôturé.

TypeScript des specs et compilation des templates Angular (ngc --noEmit) ont
réussi dans la copie isolée. La CI inclut désormais le test des sources CSS.
Ces contrôles ne remplacent pas l'exécution navigateur des 163 tests ni la
vérification des imports différés dans le build de production.

La première exécution du deuxième lot a passé 152 tests mais échoué sur les
11 tests du menu : sa fixture synchrone ne compilait pas les métadonnées
asynchrones des composants différés après overrideComponent. La préparation
attend désormais compileComponents avant création ; les 11 tests attendent
cette préparation. Aucun test ni assertion n'est supprimé. Le build lié par
&& n'a pas démarré ; aucune mesure du deuxième lot n'est encore validée.

## Validation utilisateur du deuxième lot

La préparation asynchrone corrigée a passé les 11 tests ciblés, puis les
163 tests sur 34 fichiers. Build et contrôle CSS passent. Le bundle initial
est désormais de 725,91 kB (175,16 kB de transfert estimé), soit 48,40 kB
de moins que la référence 774,31 kB, environ 6,25 %. Le deuxième lot réduit
le démarrage de 8,53 kB supplémentaires ; les fenêtres sont dans des chunks
différés de 5,98 et 5,42 kB, plus un chunk partagé de 6,48 kB.
Ce déplacement ne réduit pas nécessairement le total téléchargé après ouverture.
Le seuil de 500 kB reste dépassé de 225,91 kB : l'avertissement n'est pas masqué.

Le contrôle navigateur de production cible l'ouverture réelle de la récupération
et le fallback en cas d'import interrompu, en local sans session et avec réseau
externe bloqué. Il ne valide ni une restauration réelle ni les autorisations API.

Contrôle réel passé sur le build performance-check-02 : ouverture de la
récupération à 1440 px en clair et à 390 px en sombre ; absence de débordement
mobile ; import chargé à la demande ; fallback d'import interrompu, fermeture
et tâches inchangées. Aucune erreur JavaScript dans ces trois scénarios.
La CI génère stats.json et rejoue ce contrôle après le build. Aucun temps de
chargement en conditions réseau réelles ni score Lighthouse n'est revendiqué.

Ce lot de réduction non intrusive est prêt à enregistrer : les identifiants,
permissions, opérations de sauvegarde et services de production sont inchangés.
Le projet ne respecte pas encore le budget initial de 500 kB. Une réduction
supplémentaire des runtimes demande un lot distinct avec validation dédiée.
