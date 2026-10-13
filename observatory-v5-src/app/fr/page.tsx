import type {Metadata} from "next";
import {experience,profile,projects,skillSystems} from "@/lib/content";

export const metadata:Metadata={
  title:"Maharshi Patel — Ingénieur IA",
  description:"Portfolio en français de Maharshi Patel : IA agentique, RAG, document intelligence, évaluation LLM et MLOps.",
  alternates:{
    canonical:"/makma-ai-os/observatory-v5/fr/",
    languages:{
      "en":"/makma-ai-os/observatory-v5/",
      "fr":"/makma-ai-os/observatory-v5/fr/"
    }
  }
};

const summaryFr:Record<string,string>={
  "makma-ai-os":"Runtime IA personnel centré sur la mémoire, la planification, les outils permissionnés, l’observabilité et les workflows durables.",
  "agentic-rag-engine":"Pipeline de recherche hybride inspectable combinant recherche lexicale et sémantique, fusion RRF, reranking, citations et évaluation.",
  "multimodal-ai-studio":"Boîte à outils d’automatisation média et d’inférence IA qui transforme une intention créative en opérations ordonnées, validées et inspectables.",
  "knowledge-twin":"Graphe d’entités et de relations avec preuves, résolution d’identité, navigation et recherche orientée connaissance.",
  "clinical-document-intelligence":"Extraction structurée de documents cliniques avec preuves source, validation, provenance des corrections humaines et adaptateurs document/LLM.",
  "secure-data-copilot":"Copilote analytique en lecture seule avec planification déterministe, restrictions SQL, exécution bornée et métadonnées d’audit.",
  "llm-eval-observability":"Poste d’évaluation et d’observabilité pour qualité, citations, latence, coût, régressions et décisions de release.",
  "mlops-control-plane":"Atelier de gouvernance du cycle de vie des modèles : enregistrement, gates d’évaluation, promotion contrôlée, canary et dérive.",
  "mlops-production-pipeline":"Briques reproductibles de cycle de vie ML avec entraînement déterministe, évaluation hold-out, contrôles d’intégrité et suivi de dérive."
};

const experienceFr:Record<string,string>={
  "Substrate AI":"Traitement de données Python, analyse statistique et visualisation pour des projets analytiques.",
  "X & Y Corp":"Traitement de texte, classification et reconnaissance d’entités nommées exposés via des API REST.",
  "Algo Ético":"Coordination de livraison et analyse de données sur des projets d’IA responsable.",
  "CMI Strategies":"Pipeline Python d’analyse de sous-titres YouTube en six étapes : collecte, traduction, sentiment, résumé, classification zero-shot et NER, avec reprise sur erreur et gestion des quotas API.",
  "Pangea Summit":"POC RAG avec Python, Pinecone et OpenAI : ingestion, chunking, embeddings, recherche vectorielle et réponses sourcées. Amélioration de la qualité de récupération via tests de chunking et A/B prompts ; contribution à un tableau de bord de connaissance et à un Digital Knowledge Twin.",
  "FPT Software":"Conception de l’architecture fonctionnelle d’une plateforme d’entretien — espace candidat, back-office, proctoring et analytics — avec workflows LLM pour génération dynamique de questions et évaluation automatique des réponses.",
  "CERC":"Workflow GenAI pour rédiger des sections de rapports d’études cliniques à partir de quatre types de sources, avec mapping document-section, règles de transformation, bibliothèque de prompts, traçabilité, validation humaine et recommandations QC."
};

const roleFr:Record<string,string>={
  "Data Analytics Intern":"Stagiaire Data Analytics",
  "NLP & Algorithm Developer":"Développeur NLP & Algorithmes",
  "Project Manager & Data Analyst":"Chef de projet & Data Analyst",
  "Data Analyst":"Data Analyst",
  "AI Developer (contract → internship)":"Développeur IA (contrat → stage)",
  "AI Developer":"Développeur IA",
  "AI Engineer":"Ingénieur IA"
};

const featuredSlugs=["agentic-rag-engine","secure-data-copilot","llm-eval-observability","clinical-document-intelligence"];
const featured=featuredSlugs.map(slug=>projects.find(project=>project.slug===slug)).filter(Boolean);

export default function FrenchPage(){
  const base=process.env.NEXT_PUBLIC_BASE_PATH??"";
  return <main className="fr-brief" lang="fr">
    <header className="fr-brief-nav">
      <a href={base+"/"} className="fr-brand">MP <span>MAHARSHI PATEL</span></a>
      <nav aria-label="Navigation française">
        <a href={base+"/"}>EN</a>
        <a href={profile.cvUrl} target="_blank" rel="noreferrer">CV ↗</a>
        <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>
      </nav>
    </header>

    <section className="fr-hero">
      <span className="fr-kicker">VERSION FRANÇAISE / PARIS · 2026</span>
      <h1>Maharshi Patel</h1>
      <h2>Ingénieur IA — systèmes intelligents.</h2>
      <p>Je conçois des systèmes d’IA qui récupèrent des preuves, raisonnent dessus, prennent des actions contrôlées et permettent de vérifier ce qui s’est réellement passé.</p>
      <div className="fr-availability">
        <b>Ouvert à une alternance IA / Machine Learning / Data · disponible immédiatement · partout en France ou à distance</b>
        <span>Alternance 24 mois · {profile.rhythm}</span>
      </div>
      <div className="fr-actions">
        <a href="#projets">Voir les projets phares</a>
        <a href="#experience">Voir l’expérience</a>
        <a href={profile.cvUrl} target="_blank" rel="noreferrer">Ouvrir le CV ↗</a>
      </div>
    </section>

    <section className="fr-section fr-profile">
      <div className="fr-section-head"><span>01</span><h2>Profil</h2></div>
      <div className="fr-profile-grid">
        <article><small>FORMATION</small><b>{profile.school}</b><p>{profile.program}</p></article>
        <article><small>RYTHME</small><b>{profile.rhythm}</b><p>Disponible pour une alternance de 24 mois.</p></article>
        <article><small>CERTIFICATION</small><b>{profile.certification}</b><p>AWS Machine Learning Engineer — Associate.</p></article>
        <article><small>LANGUES</small><b>Anglais · Français · Hindi · Gujarati</b><p>Anglais courant · Français A2.</p></article>
      </div>
    </section>

    <section id="projets" className="fr-section">
      <div className="fr-section-head"><span>02</span><h2>Projets phares</h2></div>
      <p className="fr-section-intro">Quatre systèmes à examiner en priorité. Les limites d’implémentation, preuves techniques et frontières de confiance sont documentées dans chaque dossier.</p>
      <div className="fr-projects">
        {featured.map((project,index)=>project&&<article key={project.slug}>
          <small>{String(index+1).padStart(2,"0")} / {project.family}</small>
          <h3>{project.name}</h3>
          <p>{summaryFr[project.slug]}</p>
          <div className="fr-proof"><b>PREUVE</b><span>{project.proof[0]}</span></div>
          <div className="fr-card-actions">
            <a href={base+"/projects/"+project.slug}>Dossier technique (EN) →</a>
            <a href={project.repoUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
            {project.liveUrl&&<a href={project.liveUrl} target="_blank" rel="noreferrer">Démo ↗</a>}
          </div>
        </article>)}
      </div>
      <a className="fr-all-projects" href={base+"/#knowledge"}>Explorer les {projects.length} systèmes →</a>
    </section>

    <section id="experience" className="fr-section">
      <div className="fr-section-head"><span>03</span><h2>Expérience</h2></div>
      <div className="fr-experience">
        {experience.slice().reverse().map(item=><article key={item.company+item.period}>
          <div><small>{item.period}</small><h3>{item.company}</h3><b>{roleFr[item.role]??item.role}</b></div>
          <p>{experienceFr[item.company]??item.detail}</p>
        </article>)}
      </div>
    </section>

    <section className="fr-section">
      <div className="fr-section-head"><span>04</span><h2>Compétences</h2></div>
      <div className="fr-skills">
        {skillSystems.map(system=><article key={system.name}><b>{system.name}</b><p>{system.items.join(" · ")}</p></article>)}
      </div>
    </section>

    <section className="fr-contact">
      <span>05 / CONTACT</span>
      <h2>Construire quelque chose qui doit vraiment fonctionner.</h2>
      <p>Recherche une alternance IA / Machine Learning / Data de 24 mois · disponible immédiatement · mobilité France et télétravail.</p>
      <div>
        <a href={profile.email}>Email ↗</a>
        <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>
        <a href={profile.github} target="_blank" rel="noreferrer">GitHub ↗</a>
        <a href={profile.cvUrl} target="_blank" rel="noreferrer">CV ↗</a>
      </div>
    </section>
  </main>;
}
