# Homebox

Suivez l'inventaire de votre maison dans Gladys grâce à
[Homebox](https://github.com/sysadminsmedia/homebox), le logiciel d'inventaire
et de rangement auto-hébergé : combien d'objets vous possédez, ce qu'ils
valent, les garanties qui expirent bientôt et les entretiens à faire. Tout
reste sur votre réseau local : Gladys parle directement à Homebox, et se
contente de le lire.

Testée contre de vrais serveurs Homebox, 0.26.2 et 0.21.0 (l'image Docker
officielle). Vos retours sont les bienvenus sur le forum Gladys.

## Prérequis

- Gladys Assistant 5.1 ou plus récent.
- Un serveur Homebox joignable depuis la machine Gladys, sur le port 7745 par
  défaut, ou derrière un proxy inverse.
- Avec Homebox 0.26 ou plus récent : une clé d'API (Homebox → votre profil →
  Clés d'API). Avec un Homebox plus ancien : l'e-mail et le mot de passe d'un
  utilisateur Homebox. L'intégration voit l'inventaire (le « groupe ») de cet
  utilisateur.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Dans **Adresse de Homebox**, saisissez l'adresse IP du serveur, par exemple
   `192.168.1.50` : l'intégration utilise alors le port 7745. Ajoutez un port
   si le vôtre diffère (`192.168.1.50:3100`). Derrière un proxy inverse,
   saisissez l'adresse complète (`https://example.org/homebox`).
3. Collez une **clé d'API**, ou remplissez **E-mail** et **Mot de passe**. La
   clé d'API l'emporte si les deux sont remplis.
4. **Garantie expirant sous (jours)** : une garantie compte comme bientôt
   expirée ce nombre de jours avant sa fin (30 par défaut).
5. **Entretien à venir sous (jours)** : jusqu'où un entretien planifié compte
   comme à venir (7 par défaut).
6. **Un appareil par emplacement** (désactivé par défaut) ajoute un appareil
   pour chaque emplacement principal de Homebox.
7. **Lire Homebox toutes les** : 5, 15 (par défaut), 30 ou 60 minutes.
8. **Langue des noms et messages** fixe les noms des fonctionnalités (figés à
   l'ajout de l'appareil), les textes et les dates des variables de scène.
   Français par défaut.
9. Enregistrez, puis utilisez **Tester la connexion** : elle affiche la
   version de Homebox et le nombre d'objets et d'emplacements.
10. Dans l'onglet **Découverte**, ajoutez les appareils à suivre.

## Appareils

**Homebox** (un appareil pour votre inventaire) :

| Fonctionnalité             | Valeur                                                             |
| -------------------------- | ------------------------------------------------------------------ |
| Objets                     | nombre d'objets, hors objets archivés                              |
| Emplacements               | nombre d'emplacements                                              |
| Valeur totale              | prix d'achat × quantité de chaque objet, dans la monnaie du groupe |
| Garanties bientôt expirées | objets dont la garantie se termine dans la fenêtre réglée          |
| Entretiens en retard       | entretiens planifiés dont la date est passée                       |
| Entretiens à venir         | entretiens planifiés dans la fenêtre réglée                        |
| Prochain entretien         | nom, objet et date du prochain entretien, ou « Aucun »             |
| Prochaine fin de garantie  | objet et date de la prochaine garantie qui expire, ou « Aucun »    |

Gladys a une unité pour l'euro, le dollar et la livre sterling ; une autre
monnaie apparaît dans le nom de la fonctionnalité, par exemple « Valeur totale
(CHF) ». Les garanties à vie ne finissent jamais ; les garanties déjà
terminées ne sont pas comptées.

**Un emplacement** (option) : **Objets** (nombre d'objets rangés là,
sous-emplacements compris) et **Valeur**. Seuls les emplacements principaux
ont un appareil.

## Widget de tableau de bord

**Inventaire de la maison** : quatre tuiles (objets, valeur, garanties,
entretiens à faire) et la liste de ce qui arrive, au plus tôt d'abord :
entretiens en retard (en rouge), entretiens à venir, garanties qui expirent.
Lecture seule.

## Déclencheurs de scène

- **Garantie bientôt expirée** : la garantie d'un objet entre dans la fenêtre
  réglée. Une fois par objet et date de fin. Variables : objet, emplacement,
  date de fin, jours restants.
- **Entretien à faire** : un entretien planifié atteint sa date sans être
  terminé. Une fois par entretien. Variables : entretien, objet, date prévue,
  jours de retard.

La première lecture après l'installation est silencieuse : ce qui est déjà en
attente est affiché sur l'appareil, pas annoncé. Les déclencheurs partent à la
première lecture qui suit le changement (après minuit, dans l'intervalle
réglé).

## Actions de scène

**Chercher un objet dans Homebox** : donnez un nom (`Piles AA`) ; l'action lit
Homebox et renvoie **Trouvé**, **Objets correspondants**, **Objet**,
**Emplacement** (le chemin complet, `Garage / Étagère`) et **Quantité**. Le nom
exact l'emporte, puis les noms qui le contiennent ; les objets archivés sont
ignorés.

## Exemples de scènes

- **Rappel d'entretien** : déclencheur « Entretien à faire » → envoyer un
  message « C'est l'heure de {{triggerEvent.data.maintenance}} sur
  {{triggerEvent.data.item}} ».
- **Garantie** : déclencheur « Garantie bientôt expirée » → message « La
  garantie de {{triggerEvent.data.item}} se termine le
  {{triggerEvent.data.expires}} ».
- **Vérifier un stock** : chaque dimanche à 10 h → « Chercher un objet dans
  Homebox » (`Piles AA`) → continuer seulement si la quantité est inférieure à
  4 → message « Plus beaucoup de piles AA (rangées dans …) ».

## Dépannage

- **« Accès refusé »** : vérifiez la clé d'API (elle a pu expirer, ou être
  supprimée dans Homebox), ou l'e-mail et le mot de passe. Les clés d'API
  n'existent qu'à partir de Homebox 0.26 : sur une version plus ancienne,
  utilisez l'e-mail et le mot de passe.
- **« Homebox ne répond pas »** : vérifiez l'adresse et le port depuis la
  machine Gladys. Le conteneur est sur un réseau en pont : `localhost` désigne
  le conteneur lui-même, saisissez plutôt l'adresse IP du serveur.
- **« Cette adresse ne répond pas comme Homebox »** : une page de connexion de
  proxy répond à la place de Homebox. Saisissez l'adresse de Homebox lui-même,
  ou laissez passer la machine Gladys.
- Pour plus de détails dans les journaux de l'intégration, réglez
  `LOG_LEVEL=debug`.

## Limites

- Lecture seule : l'intégration ne modifie jamais votre inventaire.
- Chaque lecture fait environ cinq requêtes (dont l'export CSV de tout
  l'inventaire) : gardez un intervalle long sur un très gros inventaire.
- Un seul groupe Homebox, celui de la clé d'API ou de l'utilisateur.
- Sans lien avec le projet Homebox.
