# Instructions pour Codex

Tu travailles sur Éclair Paris, une application de classement des meilleurs éclairs au chocolat à Paris.

Principes :
1. Ne jamais inventer un prix, une disponibilité, une adresse ou une source.
2. Distinguer les établissements simplement recensés des éclairs effectivement vérifiés.
3. Préserver les champs source_url, verified_at et availability_status.
4. Favoriser une architecture mobile-first.
5. Toute donnée utilisateur doit être protégée par RLS côté Supabase.
6. Ne jamais exposer une clé service_role dans un client.
7. Les votes doivent être attribués à leur utilisateur.
8. Le classement doit afficher le nombre de votes et, si possible, les votes vérifiés.
9. Prévoir des états de chargement et d'erreur.
10. La carte doit fonctionner sur iPhone en priorité.

Ordre de travail recommandé :
- import/normalisation des établissements
- carte et recherche
- fiches établissement
- auth
- vote
- favoris
- classement
- PWA/iPhone
