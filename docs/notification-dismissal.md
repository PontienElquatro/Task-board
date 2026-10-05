# Effacement des notifications

- Corbeille individuelle, indépendante du lien vers la tâche ; cible tactile 44 px.
- Tout effacer : confirmation dans le panneau, annulation possible avant envoi.
- Effacement logique avec `dismissed_at`, limité au destinataire par RLS et filtre client.
- Le chargement et le compteur ignorent les notifications effacées.
- L'effacement global concerne toutes les pages, avec une date limite pour préserver les nouvelles arrivées.
- Erreur réseau : liste conservée et erreur visible ; double clic bloqué pendant l'opération.
- La souscription UPDATE existante synchronise l'effacement entre sessions.

Base : `database/dismiss-notifications.sql` appliqué à Maat-test uniquement. Production non modifiée.
Vérification : compilation Angular et transaction SQL annulée après assertions (effacement propre autorisé, autre destinataire interdit).
Tests Jasmine ajoutés ; exécution navigateur et déploiement à vérifier après push.
