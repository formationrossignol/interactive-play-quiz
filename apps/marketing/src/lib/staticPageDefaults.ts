import type { StaticPage } from "./types";

// Mirrors apps/app/src/lib/pages/staticPageDefaults.ts — legal pages only for
// now. features/about join here when those pages get ported (see
// docs/marketing-app-decoupling.md).
export type StaticSlug = "mentions-legales" | "confidentialite" | "cgu";

/** Source-of-truth content. DB rows (admin edits) overlay these when present. */
export const STATIC_PAGE_DEFAULTS: Record<StaticSlug, StaticPage> = {
  "mentions-legales": {
    slug: "mentions-legales",
    title: "Mentions légales",
    subtitle: "Conformément à la loi n° 2004-575 du 21 juin 2004 (LCEN)",
    status: "published",
    blocks: [],
    body: `
<h2>Éditeur du site</h2>
<p>Brivia est édité par :</p>
<p><strong>[Nom de la société / Nom du porteur de projet]</strong><br>[Forme juridique, ex. : Auto-entrepreneur / SAS]<br>[Adresse complète]<br>[SIRET / RCS]<br>Email : <a href="mailto:contact@quizmaster.app">contact@quizmaster.app</a></p>
<h2>Directeur de la publication</h2>
<p>[Prénom Nom], [Qualité]</p>
<h2>Hébergement</h2>
<p>Le site est hébergé par :<br><strong>Vercel Inc.</strong><br>340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis<br><a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a></p>
<h2>Propriété intellectuelle</h2>
<p>L’ensemble des contenus présents sur Brivia (textes, images, logotypes, icônes, sons) sont protégés par le droit de la propriété intellectuelle. Toute reproduction, représentation ou diffusion, en tout ou partie, sans autorisation expresse est interdite.</p>
<h2>Données personnelles</h2>
<p>Le traitement de vos données personnelles est décrit dans notre <a href="/confidentialite">Politique de confidentialité</a>.</p>
<h2>Cookies</h2>
<p>Brivia dépose des cookies strictement nécessaires au fonctionnement du service (authentification, sécurité). Les cookies de préférence, de mesure d’audience et marketing ne sont déposés qu’avec votre consentement, recueilli via le bandeau affiché à votre première visite. Vous pouvez modifier votre choix à tout moment via le lien « Gérer les cookies » en pied de page — voir notre <a href="/confidentialite">Politique de confidentialité</a>.</p>
<h2>Droit applicable</h2>
<p>Les présentes mentions légales sont soumises au droit français. Tout litige relatif à leur interprétation ou à leur exécution relève de la compétence des tribunaux français.</p>`.trim(),
  },
  confidentialite: {
    slug: "confidentialite",
    title: "Politique de confidentialité",
    subtitle: "Conformément au RGPD (UE) 2016/679 et à la loi Informatique et Libertés",
    status: "published",
    blocks: [],
    body: `
<h2>Responsable du traitement</h2>
<p><strong>[Nom de la société / Porteur de projet]</strong><br>[Adresse]<br>Email DPO / contact RGPD : <a href="mailto:privacy@quizmaster.app">privacy@quizmaster.app</a></p>
<h2>Données collectées et finalités</h2>
<p>Brivia collecte les données suivantes :</p>
<ul>
<li><strong>Compte utilisateur</strong> : adresse e-mail, nom d’utilisateur, mot de passe haché. Finalité : authentification et gestion du compte. Base légale : exécution du contrat (art. 6.1.b).</li>
<li><strong>Données de quiz</strong> : contenu des quiz créés, scores des participants. Finalité : fourniture du service. Base légale : exécution du contrat (art. 6.1.b).</li>
<li><strong>Données de navigation</strong> : logs techniques (adresse IP, user-agent) conservés par l’hébergeur Vercel à des fins de sécurité. Durée : 90 jours maximum.</li>
</ul>
<h2>Sous-traitants et transferts</h2>
<p>Brivia fait appel aux sous-traitants suivants :</p>
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
<p>Brivia distingue quatre catégories de cookies :</p>
<ul>
<li><strong>Nécessaires</strong> : session, authentification, sécurité. Indispensables au fonctionnement du site, exemptés de consentement (art. 82 loi Informatique et Libertés) et toujours actifs.</li>
<li><strong>Préférences</strong> : mémorisation de vos choix d’affichage (langue, thème).</li>
<li><strong>Analytics</strong> : mesure d’audience. Aucun cookie de ce type n’est déposé à ce jour.</li>
<li><strong>Marketing</strong> : personnalisation publicitaire. Aucun cookie de ce type n’est déposé à ce jour.</li>
</ul>
<p>Les catégories Préférences, Analytics et Marketing ne sont activées qu’avec votre accord explicite, recueilli via le bandeau de consentement à votre première visite. Vous pouvez accepter, refuser ou personnaliser votre choix à tout moment depuis le lien « Gérer les cookies » en pied de page.</p>`.trim(),
  },
  cgu: {
    slug: "cgu",
    title: "Conditions générales d’utilisation",
    subtitle: "En vigueur au 1er juillet 2026",
    status: "published",
    blocks: [],
    body: `
<h2>1. Objet</h2>
<p>Les présentes Conditions Générales d’Utilisation (CGU) régissent l’accès et l’utilisation du service Brivia, plateforme de création de quiz interactifs, sondages et présentations en temps réel. Tout accès au service vaut acceptation des présentes CGU.</p>
<h2>2. Accès au service</h2>
<p>Brivia est accessible via navigateur web. La création de contenu nécessite la création d’un compte. La participation à un quiz public ne nécessite pas de compte. L’accès au service est gratuit dans les limites du plan Starter ; des plans payants sont disponibles pour les fonctionnalités avancées.</p>
<h2>3. Création de compte</h2>
<p>L’utilisateur s’engage à fournir des informations exactes lors de la création de son compte et à maintenir la confidentialité de ses identifiants. Toute activité effectuée depuis un compte est réputée effectuée par son titulaire.</p>
<h2>4. Contenu utilisateur</h2>
<p>L’utilisateur reste propriétaire du contenu qu’il crée. En publiant du contenu sur Brivia, il accorde à Brivia une licence non exclusive, mondiale et gratuite pour héberger, afficher et distribuer ce contenu dans le cadre du service.</p>
<p>L’utilisateur s’engage à ne pas publier de contenu illicite, diffamatoire, discriminatoire ou portant atteinte aux droits de tiers. Brivia se réserve le droit de supprimer tout contenu non conforme.</p>
<h2>5. Responsabilité</h2>
<p>Brivia est fourni « en l’état ». Brivia ne saurait être tenu responsable des interruptions de service, des pertes de données ou des dommages indirects. La responsabilité de Brivia est limitée au montant des sommes versées par l’utilisateur au cours des 12 derniers mois.</p>
<h2>6. Résiliation</h2>
<p>L’utilisateur peut supprimer son compte à tout moment depuis les paramètres de profil. Brivia peut suspendre ou résilier un compte en cas de violation des présentes CGU, après mise en demeure restée sans effet pendant 7 jours.</p>
<h2>7. Modifications</h2>
<p>Brivia se réserve le droit de modifier les présentes CGU. Les utilisateurs sont informés par email de toute modification substantielle avec un préavis de 30 jours. L’utilisation continue du service après ce délai vaut acceptation des nouvelles CGU.</p>
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
