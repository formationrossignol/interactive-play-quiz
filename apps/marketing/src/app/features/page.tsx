import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Dices,
  FileArchive,
  FileDown,
  FileSignature,
  FolderSearch,
  Gauge,
  GraduationCap,
  Layers3,
  MessageCircleMore,
  MonitorPlay,
  PanelTop,
  Presentation,
  QrCode,
  ScanText,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TableProperties,
  Timer,
  Upload,
  UsersRound,
  WandSparkles,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CompetitorComparison } from "@/components/landing/CompetitorComparison";
import { QUESTION_TYPE_PAGES } from "@/lib/questionTypePages";
import styles from "@/components/MarketingPage.module.css";

const FORMATS = [
  {
    id: "format-quiz",
    name: "Quiz",
    description: "Neuf types de questions, points, chronomètre, correction et classement en direct.",
    href: "/builder-start?type=quiz",
    icon: Gauge,
    meta: "Évaluer en direct",
  },
  {
    id: "format-polls",
    name: "Sondages",
    description: "Choix, Likert, NPS, étoiles, priorisation et réponses ouvertes sans logique de bonne réponse.",
    href: "/builder-start?type=poll",
    icon: BarChart3,
    meta: "Faire émerger l’opinion",
  },
  {
    id: "format-flashcards",
    name: "Flashcards",
    description: "Cartes recto-verso, images et séances de mémorisation à son rythme.",
    href: "/builder-start?type=flashcard",
    icon: Layers3,
    meta: "Mémoriser durablement",
  },
  {
    id: "format-presentations",
    name: "Présentations",
    description: "Un vrai éditeur de slides avec texte riche, images, vidéos, formes, tableaux et mode présentateur.",
    href: "/builder-start?type=slide",
    icon: Presentation,
    meta: "Présenter et faire agir",
  },
  {
    id: "format-exams",
    name: "Examens",
    description: "Fenêtres de passage, tentatives, seuils, résultats différés et surveillance configurable.",
    href: "/exam-builder",
    icon: ClipboardCheck,
    meta: "Certifier les acquis",
  },
  {
    id: "format-courses",
    name: "Cours",
    description: "Modules mêlant texte, vidéo, fichiers, quiz, sondages, SCORM, H5P et dépôts de travaux.",
    href: "/course-builder",
    icon: GraduationCap,
    meta: "Structurer un parcours",
  },
] as const;

const CAPABILITY_GROUPS = [
  {
    id: "creation",
    title: "Créer sans repartir de zéro",
    items: [
      { icon: Boxes, title: "Modèles prêts à adapter", text: "Quiz, sondages et flashcards démarrent depuis une bibliothèque de scénarios." },
      { icon: ScanText, title: "Banque de questions", text: "Centralisez les questions, réutilisez-les et importez ou exportez au format Excel." },
      { icon: PanelTop, title: "Mise en page par question", text: "Choisissez la disposition du texte, des réponses et des médias selon le contenu." },
      { icon: SlidersHorizontal, title: "Règles ajustables", text: "Temps, points, ordre, rythme et comportements de session restent sous votre contrôle." },
      { icon: Upload, title: "Imports structurés", text: "Importez quiz et sondages en YAML ou CSV, puis flashcards et présentations en Markdown." },
      { icon: WandSparkles, title: "Génération de cours assistée", text: "Transformez un document en base de cours, puis relisez et adaptez chaque module." },
    ],
  },
  {
    id: "live-sessions",
    title: "Animer une salle en direct",
    items: [
      { icon: QrCode, title: "Accès par QR ou code", text: "Les participants rejoignent depuis leur navigateur, sans créer de compte." },
      { icon: MonitorPlay, title: "Pilotage côté animateur", text: "Lancez, mettez en pause, passez une question et affichez les réponses au bon moment." },
      { icon: MessageCircleMore, title: "Réactions et échanges", text: "Activez les réactions pendant la session et le commentaire de fin selon le contexte." },
      { icon: Gauge, title: "Rythme et ambiance", text: "Compte à rebours, chronomètre, classement, sons et transitions donnent un tempo lisible." },
    ],
  },
  {
    id: "learning-paths",
    title: "Construire de vrais parcours pédagogiques",
    items: [
      { icon: BookOpenCheck, title: "Dix types de leçons", text: "Texte, vidéo, document, iframe, dépôt, quiz, sondage, flashcards, SCORM et H5P." },
      { icon: FileArchive, title: "Imports SCORM et H5P", text: "Réutilisez des modules e-learning existants sans les reconstruire dans un autre outil." },
      { icon: GraduationCap, title: "Parcours séquentiels", text: "Ordonnez plusieurs cours et débloquez la suite selon le seuil obtenu." },
      { icon: Sparkles, title: "Certificats de cours", text: "Terminez un parcours avec une preuve de complétion partageable." },
    ],
  },
  {
    id: "assessment",
    title: "Évaluer avec le bon niveau de contrôle",
    items: [
      { icon: ClipboardCheck, title: "Examens configurables", text: "Définissez durée, tentatives, fenêtre d’accès, score retenu et moment de publication." },
      { icon: ShieldCheck, title: "Surveillance graduée", text: "Plein écran, changements d’onglet, webcam, microphone, captures et Safe Exam Browser restent optionnels." },
      { icon: TableProperties, title: "Notation manuelle", text: "Créez un carnet de notes, utilisez des groupes et conservez l’historique des changements." },
      { icon: CheckCircle2, title: "Décision humaine", text: "Les alertes de surveillance sont à vérifier et ne constituent jamais une preuve automatique." },
    ],
  },
  {
    id: "collaboration",
    title: "Collaborer et organiser",
    items: [
      { icon: UsersRound, title: "Partage avec permissions", text: "Invitez une personne ou un groupe avec un accès en lecture ou en modification." },
      { icon: FolderSearch, title: "Dossiers et recherche globale", text: "Classez chaque format, retrouvez un contenu et accédez rapidement aux éléments récents." },
      { icon: WandSparkles, title: "Communauté de contenus", text: "Publiez un contenu, découvrez ceux de la communauté et partez d’une ressource existante." },
      { icon: UsersRound, title: "Organisations et groupes", text: "Gérez les invitations, les groupes d’apprenants et les ressources partagées au même endroit." },
      { icon: FileSignature, title: "Demandes de signature", text: "Envoyez une demande à un groupe, fixez une échéance et suivez les réponses." },
      { icon: Dices, title: "Outils autonomes", text: "Utilisez la roue de tirage au sort et le chronomètre sans créer de quiz." },
      { icon: Timer, title: "Historique et notifications", text: "Retrouvez l’activité récente et les événements qui demandent une action." },
    ],
  },
  {
    id: "results",
    title: "Mesurer et transmettre les résultats",
    items: [
      { icon: BarChart3, title: "Résultats détaillés", text: "Analysez scores, réponses, progression et difficultés au niveau de la session ou du contenu." },
      { icon: FileDown, title: "Exports utiles", text: "Téléchargez les résultats live en PDF, Excel, CSV ou JSON." },
      { icon: TableProperties, title: "Tableaux de bord", text: "Suivez l’activité, les créations, les scores et les éléments qui demandent votre attention." },
      { icon: BookOpenCheck, title: "Suivi SCORM et H5P", text: "Retrouvez la progression et les traces des activités intégrées dans les cours." },
    ],
  },
] as const;

export const metadata: Metadata = {
  title: "Fonctionnalités",
  description: "Quiz, sondages, flashcards, présentations, examens, cours, parcours, SCORM, H5P, analytics et exports dans Brivia.",
};

export default function FeaturesPage() {
  const quizQuestionTypes = QUESTION_TYPE_PAGES.filter((item) => item.mode !== "Sondage");
  const pollQuestionTypes = QUESTION_TYPE_PAGES.filter((item) => item.mode === "Sondage");

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.page}>
        <section className={styles.hero} aria-labelledby="features-title">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <h1 id="features-title">
                Bien plus qu’un <span>quiz live.</span>
              </h1>
              <p className={styles.heroText}>
                Créez, animez, évaluez et suivez un parcours complet dans le même espace.
              </p>
              <div className={styles.actions}>
                <a className={styles.primaryButton} href="/builder-start?type=quiz">
                  Créer gratuitement
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
                <a className={styles.secondaryButton} href="#comparatif">
                  Comparer les outils
                </a>
              </div>
            </div>
            <div className={styles.heroMedia}>
              <Image
                src="/images/brivia-platform-control.jpg"
                alt="Un concepteur pédagogique pilote ses contenus depuis un poste de travail"
                fill
                priority
                sizes="(max-width: 900px) 100vw, 46vw"
              />
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="formats-title">
          <div className={styles.container}>
            <div className={styles.sectionLead}>
              <h2 id="formats-title">Six formats natifs, un seul espace.</h2>
              <p>Chaque format a son propre éditeur et partage la même organisation, les mêmes accès et le même suivi.</p>
            </div>
            <div className={styles.formatGrid}>
              {FORMATS.map(({ id, name, description, href, icon: Icon, meta }) => (
                <a id={id} className={styles.formatCard} href={href} key={name}>
                  <Icon size={29} strokeWidth={1.6} aria-hidden="true" />
                  <div>
                    <h3>{name}</h3>
                    <p>{description}</p>
                  </div>
                  <span className={styles.formatMeta}>
                    {meta}
                    <ArrowRight size={18} aria-hidden="true" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="types-de-questions" className={styles.section} aria-labelledby="question-types-title">
          <div className={styles.container}>
            <div className={styles.sectionLead}>
              <h2 id="question-types-title">Le bon geste pour chaque question.</h2>
              <p>Quinze formats documentés, avec leur usage, leurs réglages et un exemple interactif.</p>
            </div>
            <div className={styles.questionTypeGroups}>
              <section className={styles.questionTypeGroup}>
                <div className={styles.questionTypeImage}>
                  <Image
                    src="/images/brivia-learner-session.jpg"
                    alt="Un apprenant répond à une question pendant une formation"
                    fill
                    sizes="(max-width: 900px) 100vw, 34vw"
                  />
                </div>
                <div>
                  <h3>Évaluer les connaissances</h3>
                  <p>Rappel, choix, ordre, association, repérage et estimation.</p>
                  <nav aria-label="Types de questions de quiz">
                    {quizQuestionTypes.map((questionType) => (
                      <a href={`/features/questions/${questionType.slug}`} key={questionType.slug}>
                        <span>
                          <strong>{questionType.navTitle}</strong>
                          <small>{questionType.description}</small>
                        </span>
                        <ArrowRight size={17} aria-hidden="true" />
                      </a>
                    ))}
                  </nav>
                </div>
              </section>

              <section className={styles.questionTypeGroup}>
                <div className={styles.questionTypeImage}>
                  <Image
                    src="/images/brivia-analytics-review.jpg"
                    alt="Deux responsables analysent ensemble les données d’une session"
                    fill
                    sizes="(max-width: 900px) 100vw, 34vw"
                  />
                </div>
                <div>
                  <h3>Recueillir l’opinion</h3>
                  <p>Préférences, accord, fréquence, satisfaction et verbatims.</p>
                  <nav aria-label="Types de questions de sondage">
                    {pollQuestionTypes.map((questionType) => (
                      <a href={`/features/questions/${questionType.slug}`} key={questionType.slug}>
                        <span>
                          <strong>{questionType.navTitle}</strong>
                          <small>{questionType.description}</small>
                        </span>
                        <ArrowRight size={17} aria-hidden="true" />
                      </a>
                    ))}
                  </nav>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="capabilities-title">
          <div className={`${styles.container} ${styles.capabilityLayout}`}>
            <div className={styles.capabilityNav}>
              <h2 id="capabilities-title">Ce que l’app fait déjà.</h2>
              <p>Inventaire fondé sur les éditeurs, outils, exports et parcours présents dans Brivia.</p>
            </div>
            <div className={styles.capabilityGroups}>
              {CAPABILITY_GROUPS.map((group) => (
                <section id={group.id} className={styles.capabilityGroup} key={group.title}>
                  <h3>{group.title}</h3>
                  <div className={styles.capabilityItems}>
                    {group.items.map(({ icon: Icon, title, text }) => (
                      <article className={styles.capabilityItem} key={title}>
                        <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
                        <div>
                          <strong>{title}</strong>
                          <p>{text}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="workflow-proof-title">
          <div className={`${styles.container} ${styles.proofGrid}`}>
            <div className={styles.proofMedia}>
              <Image
                src="/images/brivia-live-entry-cinematic.jpg"
                alt="Une participante rejoint une session depuis son téléphone face à la projection"
                fill
                sizes="(max-width: 900px) 100vw, 55vw"
              />
            </div>
            <div>
              <div className={styles.sectionLead}>
                <h2 id="workflow-proof-title">Puissant côté animateur. Direct côté participant.</h2>
                <p>L’expérience reste légère pour la salle, même quand le scénario pédagogique devient plus exigeant.</p>
              </div>
              <div className={styles.proofList}>
                <article className={styles.proofItem}>
                  <QrCode size={23} aria-hidden="true" />
                  <div><h3>Un scan suffit</h3><p>Pas de compte participant, pas d’installation et pas de parcours d’inscription.</p></div>
                </article>
                <article className={styles.proofItem}>
                  <SlidersHorizontal size={23} aria-hidden="true" />
                  <div><h3>Le contrôle reste chez vous</h3><p>Vous choisissez le rythme, les règles, le moment de la correction et les résultats visibles.</p></div>
                </article>
                <article className={styles.proofItem}>
                  <BarChart3 size={23} aria-hidden="true" />
                  <div><h3>Le débrief est déjà prêt</h3><p>Les réponses et scores restent disponibles pour analyser, exporter et faire progresser.</p></div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section id="comparatif" className={styles.section} aria-labelledby="comparison-title">
          <div className={styles.container}>
            <div className={styles.comparisonIntro}>
              <h2 id="comparison-title">Brivia face aux outils du marché.</h2>
              <p>
                Kahoot, Mentimeter et Wooclap sont solides sur leur terrain. Brivia réunit animation, révision,
                présentation, examen et cours dans un seul environnement.
              </p>
            </div>
            <CompetitorComparison />
          </div>
        </section>

        <section className={styles.section}>
          <div className={`${styles.container} ${styles.cta}`}>
            <div>
              <h2>Commencez par une question.</h2>
              <p>Le plan Starter accueille jusqu’à 20 participants et ne demande aucune carte bancaire.</p>
            </div>
            <a className={styles.primaryButton} href="/builder-start?type=quiz">
              Créer gratuitement
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
