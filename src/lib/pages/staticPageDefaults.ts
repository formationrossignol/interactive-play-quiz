import type { StaticPage } from './types';

export type StaticSlug =
  | 'features' | 'about' | 'mentions-legales' | 'confidentialite' | 'cgu';

export const STATIC_PAGE_META: { slug: StaticSlug; label: string; icon: string; path: string; hasBlocks: boolean }[] = [
  { slug: 'features', label: 'Fonctionnalités', icon: '✨', path: '/features', hasBlocks: true },
  { slug: 'about', label: 'À propos', icon: '💜', path: '/about', hasBlocks: true },
  { slug: 'mentions-legales', label: 'Mentions légales', icon: '⚖️', path: '/mentions-legales', hasBlocks: false },
  { slug: 'confidentialite', label: 'Confidentialité', icon: '🔒', path: '/confidentialite', hasBlocks: false },
  { slug: 'cgu', label: 'CGU', icon: '📜', path: '/cgu', hasBlocks: false },
];

/** Source-of-truth content. DB rows (admin edits) overlay these when present. */
export const STATIC_PAGE_DEFAULTS: Record<StaticSlug, StaticPage> = {
  features: {
    slug: 'features',
    title: 'Un seul outil pour engager, mesurer et faire progresser.',
    subtitle: 'Quiz multijoueurs, sondages live, flashcards et présentations interactives — dans une expérience unique, du premier clic au débrief analytics.',
    body: '',
    status: 'published',
    blocks: [
      { title: 'Collaboratif', desc: 'Faites participer toute la salle en temps réel : chacun rejoint depuis son téléphone, sans installation.' },
      { title: 'Interactif', desc: 'Quiz, sondages, nuages de mots, flashcards — variez les formats pour garder l’attention.' },
      { title: 'Personnalisable', desc: 'Adaptez couleurs, rythme et règles du jeu à votre marque et à votre public.' },
      { title: 'Analytics', desc: 'Mesurez la compréhension question par question et repérez ce qu’il faut réexpliquer.' },
      { title: 'Modèles', desc: 'Partez d’un modèle prêt à l’emploi et lancez votre première session en quelques minutes.' },
      { title: 'Évaluation', desc: 'Créez des examens notés avec barème, fenêtres de passage et surveillance renforcée.' },
    ],
  },
  about: {
    slug: 'about',
    title: 'Ludiq',
    subtitle: 'Ludiq est né de la volonté de transformer l’apprentissage et l’engagement en expériences interactives et mémorables.',
    body: '<p>Nous croyons que l’apprentissage et l’engagement doivent être dynamiques, collaboratifs et amusants. C’est pourquoi nous avons créé Ludiq, une plateforme tout-en-un qui permet aux éducateurs, formateurs et animateurs de concevoir des expériences interactives captivantes.</p><p>Que vous organisiez un quiz en classe, un sondage en entreprise ou des flashcards pour réviser, Ludiq vous offre tous les outils nécessaires pour captiver votre audience et mesurer l’impact en temps réel.</p>',
    status: 'published',
    blocks: [
      { title: 'Innovation', desc: 'Nous innovons constamment pour offrir des expériences toujours plus engageantes et intuitives.' },
      { title: 'Collaboration', desc: 'Nous facilitons le travail d’équipe et encourageons le partage de connaissances.' },
      { title: 'Simplicité', desc: 'Des outils puissants mais simples d’utilisation, accessibles à tous.' },
      { title: 'Passion', desc: 'Nous aimons ce que nous faisons et nous nous investissons pleinement pour votre succès.' },
    ],
  },
  'mentions-legales': {
    slug: 'mentions-legales',
    title: 'Mentions légales',
    subtitle: 'Conformément à la loi n° 2004-575 du 21 juin 2004 (LCEN)',
    status: 'published',
    blocks: [],
    body: `
<h2>Éditeur du site</h2>
<p>Ludiq est édité par :</p>
<p><strong>[Nom de la société / Nom du porteur de projet]</strong><br>[Forme juridique, ex. : Auto-entrepreneur / SAS]<br>[Adresse complète]<br>[SIRET / RCS]<br>Email : <a href="mailto:contact@quizmaster.app">contact@quizmaster.app</a></p>
<h2>Directeur de la publication</h2>
<p>[Prénom Nom], [Qualité]</p>
<h2>Hébergement</h2>
<p>Le site est hébergé par :<br><strong>Vercel Inc.</strong><br>340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis<br><a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a></p>
<h2>Propriété intellectuelle</h2>
<p>L’ensemble des contenus présents sur Ludiq (textes, images, logotypes, icônes, sons) sont protégés par le droit de la propriété intellectuelle. Toute reproduction, représentation ou diffusion, en tout ou partie, sans autorisation expresse est interdite.</p>
<h2>Données personnelles</h2>
<p>Le traitement de vos données personnelles est décrit dans notre <a href="/confidentialite">Politique de confidentialité</a>.</p>
<h2>Cookies</h2>
<p>Ludiq utilise des cookies strictement nécessaires au fonctionnement du service (authentification, préférences de langue). Aucun cookie publicitaire ou de traçage tiers n’est déposé sans votre consentement.</p>
<h2>Droit applicable</h2>
<p>Les présentes mentions légales sont soumises au droit français. Tout litige relatif à leur interprétation ou à leur exécution relève de la compétence des tribunaux français.</p>`.trim(),
  },
  confidentialite: {
    slug: 'confidentialite',
    title: 'Politique de confidentialité',
    subtitle: 'Conformément au RGPD (UE) 2016/679 et à la loi Informatique et Libertés',
    status: 'published',
    blocks: [],
    body: `
<h2>Responsable du traitement</h2>
<p><strong>[Nom de la société / Porteur de projet]</strong><br>[Adresse]<br>Email DPO / contact RGPD : <a href="mailto:privacy@quizmaster.app">privacy@quizmaster.app</a></p>
<h2>Données collectées et finalités</h2>
<p>Ludiq collecte les données suivantes :</p>
<ul>
<li><strong>Compte utilisateur</strong> : adresse e-mail, nom d’utilisateur, mot de passe haché. Finalité : authentification et gestion du compte. Base légale : exécution du contrat (art. 6.1.b).</li>
<li><strong>Données de quiz</strong> : contenu des quiz créés, scores des participants. Finalité : fourniture du service. Base légale : exécution du contrat (art. 6.1.b).</li>
<li><strong>Données de navigation</strong> : logs techniques (adresse IP, user-agent) conservés par l’hébergeur Vercel à des fins de sécurité. Durée : 90 jours maximum.</li>
</ul>
<h2>Sous-traitants et transferts</h2>
<p>Ludiq fait appel aux sous-traitants suivants :</p>
<ul>
<li><strong>Supabase</strong> (stockage et authentification), serveurs en Europe (eu-west-1).</li>
<li><strong>Vercel</strong> (hébergement), conforme aux clauses contractuelles types de l’UE.</li>
</ul>
<p>Les polices de caractères sont auto-hébergées : aucun appel vers Google Fonts ou autre CDN tiers.</p>
<h2>Durée de conservation</h2>
<p>Les données de compte sont conservées jusqu’à la suppression du compte et 30 jours après (purge définitive). Les données de quiz publics anonymisés peuvent être conservées plus longtemps à des fins statistiques agrégées.</p>
<h2>Vos droits</h2>
<p>Conformément au RGPD, vous disposez des droits suivants : accès, rectification, effacement, portabilité, opposition et limitation du traitement.</p>
<p>Pour exercer ces droits, contactez-nous à <a href="mailto:privacy@quizmaster.app">privacy@quizmaster.app</a>. Vous pouvez également introduire une réclamation auprès de la <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">CNIL</a>.</p>
<h2>Cookies</h2>
<p>Cookies strictement nécessaires uniquement (session, préférences de langue). Pas de cookies publicitaires, pas de traceurs tiers. Aucun consentement n’est requis pour ces cookies (art. 82 loi Informatique et Libertés, exemption CNIL).</p>`.trim(),
  },
  cgu: {
    slug: 'cgu',
    title: 'Conditions générales d’utilisation',
    subtitle: 'En vigueur au 1er juillet 2026',
    status: 'published',
    blocks: [],
    body: `
<h2>1. Objet</h2>
<p>Les présentes Conditions Générales d’Utilisation (CGU) régissent l’accès et l’utilisation du service Ludiq, plateforme de création de quiz interactifs, sondages et présentations en temps réel. Tout accès au service vaut acceptation des présentes CGU.</p>
<h2>2. Accès au service</h2>
<p>Ludiq est accessible via navigateur web. La création de contenu nécessite la création d’un compte. La participation à un quiz public ne nécessite pas de compte. L’accès au service est gratuit dans les limites du plan Starter ; des plans payants sont disponibles pour les fonctionnalités avancées.</p>
<h2>3. Création de compte</h2>
<p>L’utilisateur s’engage à fournir des informations exactes lors de la création de son compte et à maintenir la confidentialité de ses identifiants. Toute activité effectuée depuis un compte est réputée effectuée par son titulaire.</p>
<h2>4. Contenu utilisateur</h2>
<p>L’utilisateur reste propriétaire du contenu qu’il crée. En publiant du contenu sur Ludiq, il accorde à Ludiq une licence non exclusive, mondiale et gratuite pour héberger, afficher et distribuer ce contenu dans le cadre du service.</p>
<p>L’utilisateur s’engage à ne pas publier de contenu illicite, diffamatoire, discriminatoire ou portant atteinte aux droits de tiers. Ludiq se réserve le droit de supprimer tout contenu non conforme.</p>
<h2>5. Responsabilité</h2>
<p>Ludiq est fourni « en l’état ». Ludiq ne saurait être tenu responsable des interruptions de service, des pertes de données ou des dommages indirects. La responsabilité de Ludiq est limitée au montant des sommes versées par l’utilisateur au cours des 12 derniers mois.</p>
<h2>6. Résiliation</h2>
<p>L’utilisateur peut supprimer son compte à tout moment depuis les paramètres de profil. Ludiq peut suspendre ou résilier un compte en cas de violation des présentes CGU, après mise en demeure restée sans effet pendant 7 jours.</p>
<h2>7. Modifications</h2>
<p>Ludiq se réserve le droit de modifier les présentes CGU. Les utilisateurs sont informés par email de toute modification substantielle avec un préavis de 30 jours. L’utilisation continue du service après ce délai vaut acceptation des nouvelles CGU.</p>
<h2>8. Droit applicable et juridiction</h2>
<p>Les présentes CGU sont soumises au droit français. Tout litige relatif à leur interprétation ou à leur exécution sera soumis aux tribunaux compétents du ressort de Paris, sauf disposition légale impérative contraire.</p>`.trim(),
  },
};

/** Effective content = default, overlaid by DB row fields that carry real content. */
export function mergeStaticPage(def: StaticPage, row?: StaticPage | null): StaticPage {
  if (!row) return def;
  return {
    slug: def.slug,
    title: row.title?.trim() ? row.title : def.title,
    subtitle: row.subtitle?.trim() ? row.subtitle : def.subtitle,
    body: row.body?.trim() ? row.body : def.body,
    blocks: row.blocks?.length ? row.blocks : def.blocks,
    status: row.status ?? def.status,
  };
}
