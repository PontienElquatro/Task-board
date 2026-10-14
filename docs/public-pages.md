# Pages visiteurs — validation locale réussie, publication d'aperçu à confirmer

Accueil `/home` (entrée `/`), fonctionnalités `/presentation`, À propos
`/about` et Contact `/contact`. Le tableau reste disponible à `/board`.
Les routes existantes et les identifiants de stockage ne sont pas renommés.

Navigation visiteurs séparée du menu de compte et de l'espace de travail.
Les pages utilisent la palette existante, les polices système et un affichage
adaptatif. Le tableau de l'accueil est explicitement un exemple illustratif,
pas une capture du compte ni un tableau interactif. Les CTA ouvrent de vraies
routes : tableau local, connexion/inscription et aide.

Contact approuvé par l'utilisateur : `pontienmisenga93@gmail.com`. Le contact
public configuré dans l'administration prend priorité lorsqu'il est valide.
Aucun compte principal ou email privé n'est déduit automatiquement. Le lien
mailto encode l'adresse et le sujet, refuse les en-têtes injectés et explique
qu'il ouvre la messagerie, sans envoyer depuis le site. Ce bloc ne modifie pas
les paramètres serveur et n'ajoute pas d'envoi email.

Signature : `Ma'at by El_Quatro Technology`. Copyright avec année courante dans
le pied de page visiteurs et les pages utilisant PageShell. Les informations
juridiques restent provisoires et doivent être finalisées avant ouverture
publique ; ce lot ne revendique pas une conformité juridique.

Restent avant clôture : suite tests navigateur, build et contrôle des styles,
validation visuelle mobile/sombre/clavier et rechargement des routes sur aperçu,
puis commit/push du lot validé. Les emails de notification et le domaine sont
des blocs distincts ; aucun achat, alias ou déploiement de production effectué.

Contrôles du 14 octobre 2026 : TypeScript des specs et compilation des templates
Angular (`ngc --noEmit`) réussis dans la copie isolée. Une première tentative
de tests navigateur, sans résultat exploitable, a été interrompue ; elle n'est
pas comptée comme un succès. La copie a ensuite été resynchronisée avec les
dernières sources. La suite navigateur et le build optimisé restent requis.

Les descriptions factuelles périmées de confidentialité et conditions ont été
actualisées (collaboration disponible, suppression différée existante), sans
retirer les avertissements de validation juridique ni inventer de régime légal.

Première suite utilisateur : 175 tests réussis sur 176, 34 fichiers réussis
sur 35. Les 7 tests des pages visiteurs et les 9 tests AppComponent passent.
L'unique échec est l'ouverture IndexedDB du premier test d'isolation des
comptes ; le délai de production est de 5 secondes. Les deux autres tests du
même fichier passent. Une lenteur de démarrage est une hypothèse, pas une cause
confirmée : relance ciblée puis suite complète requises. Aucun délai de
production augmenté, aucun test supprimé. Le build et le contrôle CSS liés
par `&&` n'ont pas démarré lors de cette exécution.

Relance ciblée utilisateur : 3 tests IndexedDB réussis. Relance complète :
176 tests sur 35 fichiers réussis, build optimisé et contrôle CSS réussis.
Bundle initial : 734,62 kB, transfert estimé 177,19 kB. Le budget de 500 kB
reste dépassé et n'est pas modifié. Aucun délai IndexedDB augmenté.

Le contrôle `tools/test-public-pages-browser.mjs` a passé sur le build réel
`dist/public-pages-check/browser` : 1440 px clair, 390 px clair et 390 px sombre.
Pour chaque affichage : six routes publiques et rechargement direct, un titre
h1 et un main, absence du menu de compte et du menu de travail, aucune erreur
JavaScript et aucun débordement horizontal. L'entrée `/` mène à `/home`,
le lien À propos s'active au clavier et le CTA ouvre le tableau avec son menu
de compte. Les captures Accueil et Contact ont été inspectées visuellement.

Ce contrôle bloque tout réseau externe et utilise des contextes anonymes
éphémères : il valide le mailto de secours autorisé, pas une livraison email
ou un nouveau test du backend. La priorité du contact configuré est couverte
par le test composant. Aucun lien mailto déclenché, aucun message envoyé.

Les captures de diagnostic restent dans `tmp/public-pages-visual` de la copie
de vérification, hors Git. La validation du déploiement d'aperçu après push
reste distincte. Le domaine et les emails de notification ne sont pas inclus.
