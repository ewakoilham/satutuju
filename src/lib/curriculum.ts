// The 10-session curriculum structure from the SatuTuju Mentor Toolkit

export interface SessionTemplate {
  sessionNum: number;
  phase: string;
  phaseLabel: string;
  phaseEmoji: string;
  topic: string;
  objective: string;
  deliverables: string[];
  menteePrep: string[];
  mentorPrep: string[];
  duration: number; // minutes
  docChecklist: string[];
}

export const PHASES = {
  discovery: { label: "Discovery", emoji: "🔍", color: "blue" },
  planning: { label: "Planning", emoji: "🗺️", color: "amber" },
  writing: { label: "Writing", emoji: "✍️", color: "purple" },
  execution: { label: "Execution", emoji: "🎯", color: "orange" },
  closing: { label: "Closing", emoji: "🏁", color: "green" },
} as const;

export const CURRICULUM: SessionTemplate[] = [
  {
    sessionNum: 1,
    phase: "discovery",
    phaseLabel: "Discovery",
    phaseEmoji: "🔍",
    topic: "Introduction & Mentee Profiling",
    objective:
      "Build rapport, understand mentee background, motivations, and goals",
    deliverables: [
      "Mentee profile documented",
      "Study goals identified",
      "Program expectations set",
    ],
    menteePrep: [
      "Prepare CV/resume",
      "List dream universities",
    ],
    mentorPrep: [
      "Prepare intake form",
      "Prepare mentee profile template",
    ],
    duration: 75,
    docChecklist: ["CV/Resume (draft)", "University wish list"],
  },
  {
    sessionNum: 2,
    phase: "discovery",
    phaseLabel: "Discovery",
    phaseEmoji: "🔍",
    topic: "Gap Analysis & Readiness Assessment",
    objective:
      "Identify gaps in academic, language, financial, and document readiness",
    deliverables: [
      "Gap analysis report per category",
      "Strength map",
      "Priority action items",
    ],
    menteePrep: [
      "Collect transcript",
      "Language test scores (if any)",
      "Financial information",
    ],
    mentorPrep: [
      "Prepare readiness scorecard",
      "Standard document checklist",
    ],
    duration: 75,
    docChecklist: ["Transcript", "Language test score", "Financial overview"],
  },
  {
    sessionNum: 3,
    phase: "planning",
    phaseLabel: "Planning",
    phaseEmoji: "🗺️",
    topic: "University Shortlisting",
    objective:
      "Produce shortlist of 5-10 universities (Safety/Target/Reach)",
    deliverables: [
      "University shortlist finalized",
      "Ranking rationale per option",
      "Safety/Target/Reach categorization",
    ],
    menteePrep: [
      "Research 3+ dream universities with reasons",
      "Confirm budget & financing options",
    ],
    mentorPrep: [
      "Prepare university database",
      "Ranking data & requirements per school",
    ],
    duration: 90,
    docChecklist: ["University shortlist document"],
  },
  {
    sessionNum: 4,
    phase: "planning",
    phaseLabel: "Planning",
    phaseEmoji: "🗺️",
    topic: "Application Strategy & Timeline",
    objective: "Create master application plan with realistic timeline",
    deliverables: [
      "Application master plan (timeline + checklist)",
      "LPDP eligibility confirmation",
      "Reference letter strategy",
    ],
    menteePrep: [
      "List all university deadlines",
      "Start ML outline draft",
    ],
    mentorPrep: [
      "Prepare application tracker template",
      "Example success timelines",
    ],
    duration: 75,
    docChecklist: ["Application tracker", "Deadline calendar"],
  },
  {
    sessionNum: 5,
    phase: "writing",
    phaseLabel: "Writing",
    phaseEmoji: "✍️",
    topic: "Motivation Letter — Brainstorm & Outline",
    objective:
      "Extract key stories, build authentic narrative arc, finalize outline",
    deliverables: [
      "ML/PS outline draft",
      "Key stories map",
      "Narrative core document",
    ],
    menteePrep: [
      "Write 5 most important life experiences (free format)",
      "Reflect on 'why this program'",
    ],
    mentorPrep: [
      "Read best ML examples",
      "Prepare storytelling guide questions",
    ],
    duration: 90,
    docChecklist: ["Narrative core document", "ML/PS outline"],
  },
  {
    sessionNum: 6,
    phase: "writing",
    phaseLabel: "Writing",
    phaseEmoji: "✍️",
    topic: "Motivation Letter — Review & Revision",
    objective:
      "Produce polished, authentic ML/PS that answers: why you, why this program, why now",
    deliverables: [
      "ML/PS final draft (v2+)",
      "Essay LPDP draft reviewed",
    ],
    menteePrep: [
      "Submit ML/PS draft v1 (at least 3 days before session)",
      "Get rough feedback from one person",
    ],
    mentorPrep: [
      "Read & annotate mentee draft",
      "Prepare feedback framework",
    ],
    duration: 90,
    docChecklist: ["Motivation Letter v2+", "LPDP Essay draft"],
  },
  {
    sessionNum: 7,
    phase: "writing",
    phaseLabel: "Writing",
    phaseEmoji: "✍️",
    topic: "Academic CV & Supporting Documents",
    objective:
      "Produce professional CV + ensure all supporting documents are ready",
    deliverables: [
      "Academic CV final",
      "Document checklist 100% complete",
    ],
    menteePrep: [
      "Latest CV draft",
      "List all achievements & awards",
      "Collect all supporting documents",
    ],
    mentorPrep: [
      "Prepare CV templates per region",
      "Document checklist per university",
    ],
    duration: 75,
    docChecklist: [
      "Academic CV (final)",
      "Transcript (official)",
      "Certificates",
      "Recommendation letters",
    ],
  },
  {
    sessionNum: 8,
    phase: "execution",
    phaseLabel: "Execution",
    phaseEmoji: "🎯",
    topic: "Mock Interview & Preparation",
    objective:
      "Build interview confidence through practice and specific feedback",
    deliverables: [
      "Interview preparation notes",
      "Self-introduction (60-90 sec)",
      "Recorded mock interview + feedback",
    ],
    menteePrep: [
      "Research typical interview questions for target programs",
      "Prepare self-introduction draft",
    ],
    mentorPrep: [
      "Prepare 20 common interview questions",
      "Scoring rubric",
    ],
    duration: 90,
    docChecklist: ["Interview prep notes", "Mock interview recording"],
  },
  {
    sessionNum: 9,
    phase: "execution",
    phaseLabel: "Execution",
    phaseEmoji: "🎯",
    topic: "Final Document Review & Audit",
    objective:
      "Zero-tolerance final audit of ALL documents before submission",
    deliverables: [
      "Final document checklist — all approved",
      "Cross-document consistency verified",
      "Submission plan per platform",
    ],
    menteePrep: [
      "Compile all documents in one folder",
      "Self-check everything first",
    ],
    mentorPrep: [
      "Final review checklist",
      "Cross-document consistency check",
    ],
    duration: 90,
    docChecklist: [
      "All documents compiled",
      "Naming conventions correct",
      "File formats verified",
    ],
  },
  {
    sessionNum: 10,
    phase: "closing",
    phaseLabel: "Closing",
    phaseEmoji: "🏁",
    topic: "Evaluation & Closing",
    objective:
      "Close program with confidence, create post-submission action plan",
    deliverables: [
      "Submission confirmation",
      "Post-submission action plan (accept/waitlist/reject scenarios)",
      "Program evaluation",
    ],
    menteePrep: [
      "Submit applications (if not yet)",
      "Prepare evaluation questions",
    ],
    mentorPrep: [
      "Prepare evaluation form",
      "Post-submission timeline",
    ],
    duration: 60,
    docChecklist: ["Submission confirmations", "Post-submission plan"],
  },
];

export const DOCUMENT_CATEGORIES = [
  { value: "cv", label: "CV / Resume" },
  { value: "motivation_letter", label: "Motivation Letter / Personal Statement" },
  { value: "transcript", label: "Academic Transcript" },
  { value: "ielts", label: "IELTS / Language Test Score" },
  { value: "recommendation", label: "Recommendation Letter" },
  { value: "essay_lpdp", label: "LPDP Essay" },
  { value: "certificate", label: "Certificate / Award" },
  { value: "other", label: "Other Document" },
] as const;
