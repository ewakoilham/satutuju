"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

/* ─── Data ─────────────────────────────────────────────────────────── */

const CHAPTERS = [
  { id: "welcome",     label: "Welcome",           icon: "book"           },
  { id: "myths",       label: "Rethink Mentoring", icon: "lightbulb"      },
  { id: "role",        label: "Your Role",         icon: "user"           },
  { id: "psychology",  label: "Mentee Psychology", icon: "chart"          },
  { id: "milestones",  label: "Milestones",        icon: "map"            },
  { id: "practices",   label: "Best Practices",    icon: "clipboard-check"},
];

const MYTHS = [
  {
    num: 1,
    myth: "A good mentor always has the answer",
    reality: "The most impactful mentors ask the right questions — not answer everything. A mentee who discovers the answer themselves will own the outcome far more deeply.",
    insight: "The faster you give answers, the less your mentee learns. They will face moments where you are not there — interviews, visa interviews, their first day abroad. What you can leave behind is a way of thinking, not a list of answers.",
  },
  {
    num: 2,
    myth: "Your job is to make sure the mentee gets accepted",
    reality: "Your job is to shape them — not to place the piece. A mentee who leaves as the best version of themselves is a success, with or without an acceptance letter.",
    insight: "Admissions committees reject perfect applications. Quotas fill up. There are hundreds of factors outside anyone's control. What is fully within your control: how prepared your mentee is when they submit, how authentic their narrative is, how confident they feel walking into an interview.",
  },
  {
    num: 3,
    myth: "A good mentor is always available",
    reality: "A good mentor has clear boundaries — and precisely because of those boundaries, the quality of their presence in sessions is far higher. Being available everywhere means being fully present nowhere.",
    insight: "There is a difference between caring and being a rescuer. You can — and should — understand your mentee's context: their financial situation, family pressure, their doubts. But you are not their therapist, not their parent, and not their savior.",
  },
  {
    num: 4,
    myth: "The more detailed your guidance, the better",
    reality: "A good mentor gives a map — not a route. A mentee who follows someone else's route will produce an application that sounds like someone else. Admissions committees detect that.",
    insight: "The strongest motivation letters are not the ones that follow the best formula. They are the most authentic — the ones that sound most like the person who wrote them. That voice cannot be given to your mentee. What you can do is help them find it.",
  },
];

const PILLARS = [
  {
    num: 1,
    title: "Give a Map, Not a Route",
    description: "A map shows the big picture: where you are now, where you could go, what lies along the way. But the mentee decides their own route.",
    examples: [
      "When asked 'which university should I choose?' — don't answer directly. First ask: 'What matters most to you in choosing a university?'",
      "When you read a motivation letter draft and immediately see what's wrong — resist giving the solution. Ask: 'Which part doesn't sound like you yet?'",
      "When a mentee is stuck — share context from your own experience, not instructions. 'When I was in the same position, I found that…' not 'You should…'",
    ],
    note: "Exception: for factual, time-sensitive things — deadlines, document formats, LPDP requirements — give information directly. This pillar is about not taking over decisions, not withholding information.",
  },
  {
    num: 2,
    title: "Process Is the True Result",
    description: "You cannot guarantee acceptance. What you can guarantee is that when your mentee submits, they have given the very best of themselves.",
    examples: [
      "The right question after every session is not 'is the document good?' but 'does my mentee leave this session more prepared and more confident than when they arrived?'",
    ],
    note: null,
  },
  {
    num: 3,
    title: "Care Deeply, But Know Your Lane",
    description: "Caring deeply is a good thing. But care without boundaries can become a burden — for your mentee, and for yourself.",
    examples: [
      "You can listen to family pressure affecting their decision. You can know their financial situation limits their choices. All of that is relevant.",
      "But if the conversation enters territory that requires professional help — listen, validate, then gently redirect them to the right place. This is not rejection. It is the most responsible form of care.",
    ],
    note: "Ask yourself: 'Is this relevant to shaping their journey, or is this entering territory that needs another professional?' If the latter — listen with empathy, then point them in the right direction.",
  },
];

const MILESTONES = [
  {
    num: 1,
    title: "Self Clarity",
    subtitle: "Who you are and where you stand",
    sessions: 2,
    color: "text-text-blue",
    bg: "bg-surface-blue",
    border: "border-surface-blue-border",
    outputs: [
      "Session 1: Full mentee profile documented — academic background, experience, motivations",
      "Session 2: Gap analysis by category (academic, language, financial, documents) + strength map + priority action items",
    ],
    psychological: [
      "After Session 1: mentee feels heard and understood",
      "After Session 2: mentee understands their position objectively without spiraling into self-doubt, and has one quick win to work on immediately",
    ],
    principles: [
      "Session 1 is about rapport — not information gathering. Mentee should speak 80% of the time. Do not give any technical recommendations in this session.",
      "Session 2: always start from strengths before addressing gaps.",
    ],
  },
  {
    num: 2,
    title: "Direction Clarity",
    subtitle: "Where you're going and why",
    sessions: 1,
    color: "text-text-amber",
    bg: "bg-surface-amber",
    border: "border-surface-amber-border",
    outputs: [
      "University shortlist finalized (5–8 universities: Safety, Target, Reach)",
      "LPDP eligibility confirmation and program fit",
      "Strategy decision: LPDP First or LoA First (based on mentee's financial situation)",
      "Master application timeline — universities and LPDP",
      "Reference letter strategy",
    ],
    psychological: [
      "Mentee can explain why they chose each university on the shortlist — not just name them",
    ],
    principles: [
      "Mentor brings data, mentee brings decision. You bring information not on websites — real acceptance rates, program nuances, personal experience. But the final shortlist decision is entirely the mentee's.",
      "At the end of the session, ask the mentee to verbally state the rationale behind each of their choices.",
    ],
  },
  {
    num: 3,
    title: "Narrative Clarity",
    subtitle: "Tell your story authentically",
    sessions: 3,
    color: "text-text-purple",
    bg: "bg-surface-purple",
    border: "border-surface-purple-border",
    outputs: [
      "Session 1: Narrative core document (one page, in the mentee's own words) + story map",
      "Session 2: LPDP essay final draft v2+",
      "Session 3: University motivation letter draft v2 + LPDP essay final approved",
    ],
    psychological: [
      "Mentee experiences a clarity moment: 'This is my story, and this story is worth telling.' They leave with full ownership of their narrative.",
    ],
    principles: [
      "This is the hardest milestone. Session 1: use story mining — not 'what are your achievements?' but 'tell me a moment when you felt most alive in your work.'",
      "Do not edit the narrative in Session 1 — only excavate and reflect.",
      "Session 3: begin by celebrating the finalized LPDP essay — this is a major achievement that deserves explicit recognition.",
    ],
  },
  {
    num: 4,
    title: "Document Readiness",
    subtitle: "All documents 100% ready",
    sessions: 1,
    color: "text-text-orange",
    bg: "bg-surface-orange",
    border: "border-surface-orange-border",
    outputs: [
      "Academic CV final",
      "All supporting documents complete (transcripts, certificates, recommendation letters)",
      "Final audit checklist — universities and LPDP",
      "All files in correct format and naming convention",
    ],
    psychological: [
      "Mentee leaves with a sense of relief and readiness. They have full confidence that everything needed is in place and in its best condition.",
    ],
    principles: [
      "This is an audit session, not an exploration session. If the mentee arrives with documents they haven't checked themselves — return them and ask them to check first before the session begins. This is about ownership.",
      "Cross-checking consistency across documents is the top priority.",
    ],
  },
  {
    num: 5,
    title: "Interview Readiness",
    subtitle: "Ready to show up and speak",
    sessions: 2,
    color: "text-text-red",
    bg: "bg-surface-red",
    border: "border-surface-red-border",
    outputs: [
      "Session 1: Personal interview framework (not a script) + final self-introduction (60–90 seconds)",
      "Session 2: Recorded mock interview + feedback summary + personal improvement notes",
    ],
    psychological: [
      "Mentee leaves with genuine readiness — having faced the hardest questions in a safe environment. Fear of interviews shifts into a sense of preparedness.",
    ],
    principles: [
      "Session 1: open with 'Which interview question are you most afraid of?' — this immediately identifies the mentee's psychological block.",
      "Session 2: the atmosphere should mirror real conditions as closely as possible. Debrief starts with the mentee self-evaluating before you give feedback.",
      "Close with: 'Compared to 90 minutes ago, how prepared do you feel now?'",
    ],
  },
  {
    num: 6,
    title: "Launch",
    subtitle: "Go as the best version of yourself",
    sessions: 1,
    color: "text-text-green",
    bg: "bg-surface-green",
    border: "border-surface-green-border",
    outputs: [
      "Submission confirmation for all applications (submitted at least 2 days before the session)",
      "Post-submission action plan for each scenario: accepted, waitlist, rejected",
    ],
    psychological: [
      "Mentee feels fully ready, confident, believes they have prepared their best, and trusts that this journey has brought out the best in them.",
    ],
    principles: [
      "Three moments not to rush: (1) Mentee reads their journey reflection aloud — you listen without interrupting, then reflect the transformation you witnessed. (2) The post-submission plan is built with a tone of 'prepared', not 'anxious'. (3) Close with: 'What is the one thing you most want to remember from this journey?' — then listen.",
    ],
  },
];

const WARNING_SIGNS = [
  {
    sign: "Mentee energy rating 2 or below for 2 consecutive sessions",
    action: "Special check-in outside the session agenda — not about documents, but about wellbeing. Inform the Satu Tuju team.",
  },
  {
    sign: "Mentee misses homework deadlines 2 times in a row",
    action: "Don't go straight to the documents. First ask: 'How are you doing right now?' — and listen to the answer seriously.",
  },
];

const DONTS = [
  "Don't write or edit your mentee's sentences — guide them to rewrite it themselves",
  "Don't recommend universities in the first session — rapport must be established first",
  "Don't over-promise: 'you'll definitely get in', 'it's easy' — what you can promise is effort, not outcome",
  "Don't skip the financial gap analysis — it's often ignored but critical to overall strategy",
  "Don't let the mentee submit the night of the deadline — technical issues always happen",
  "Don't let sessions run over without a conclusion — if time runs out, reschedule the remaining agenda; never sacrifice quality for time",
];

/* ─── Sub-components ───────────────────────────────────────────────── */


function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-3 mb-1">
      <h2 className="text-xl font-bold font-[family-name:var(--font-heading)]">{children}</h2>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-foreground pl-3 border-l-2 border-border">{children}</h3>
  );
}

function Callout({ children, color = "blue" }: { children: React.ReactNode; color?: string }) {
  const styles: Record<string, string> = {
    blue:   "bg-surface-blue border-surface-blue-border text-text-blue",
    amber:  "bg-surface-amber border-surface-amber-border text-text-amber",
    green:  "bg-surface-green border-surface-green-border text-text-green",
    red:    "bg-surface-red border-surface-red-border text-text-red",
    purple: "bg-surface-purple border-surface-purple-border text-text-purple",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles[color]}`}>
      {children}
    </div>
  );
}

/* ─── Chapter content ──────────────────────────────────────────────── */

function WelcomeChapter() {
  return (
    <div className="space-y-5">
      <div>
        <SectionHeading>Before You Read Any Further</SectionHeading>
        <p className="text-text-muted text-sm">A note on why you were chosen</p>
      </div>
      <Callout color="blue">
        <p className="font-semibold mb-2">You were not selected as a Satu Tuju mentor because you know a lot about the master's application process.</p>
        <p>You were not selected because you are great at writing motivation letters, or because you have memorized deadlines for universities in the UK and Australia.</p>
      </Callout>
      <p className="text-foreground leading-relaxed">
        You were selected because you have been in the exact same position as the person you will be guiding. You were once confused, uncertain, unsure where to start. And then — you made it through.
      </p>
      <p className="text-foreground leading-relaxed">
        The most valuable wisdom you can give your mentee does not exist on Google. It lives inside your own journey.
      </p>
      <Callout color="green">
        <p className="font-semibold">This toolkit will prepare you to be a truly effective mentor.</p>
        <p className="mt-1">But "effective" here does not mean memorizing all the procedures. Effective means being fully present — and helping your mentee find their own answers.</p>
      </Callout>
      <p className="text-foreground leading-relaxed">
        Read this slowly. Some parts may change how you think about what it means to be a mentor. That is entirely the point.
      </p>
    </div>
  );
}

function MythsChapter() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-5">
      <div>
        <SectionHeading>Rethink Mentoring</SectionHeading>
        <p className="text-text-muted text-sm">Most people arrive with preconceptions about what a good mentor looks like. Most of those are wrong.</p>
      </div>
      <div className="space-y-3">
        {MYTHS.map((m) => (
          <div key={m.num} className="card rounded-2xl !p-0 overflow-hidden">
            <button
              onClick={() => setOpen(open === m.num ? null : m.num)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-surface-elevated transition"
            >
              <span className="text-xs font-bold text-text-muted-2 w-12 flex-shrink-0">MYTH {m.num}</span>
              <span className="flex-1 text-sm font-medium text-foreground">{m.myth}</span>
              <Icon name="chevron-down" size={15} className={`text-text-muted-2 transition-transform flex-shrink-0 ${open === m.num ? "rotate-180" : ""}`} />
            </button>
            {open === m.num && (
              <div className="px-5 pb-5 space-y-3 animate-slide-in-up border-t border-border pt-4">
                <div className="bg-surface-green border border-surface-green-border rounded-xl px-4 py-3">
                  <p className="text-xs font-bold text-text-green uppercase mb-1">Reality</p>
                  <p className="text-sm text-foreground">{m.reality}</p>
                </div>
                <div className="bg-surface-blue border border-surface-blue-border rounded-xl px-4 py-3">
                  <p className="text-xs font-bold text-text-blue uppercase mb-1">Why this matters</p>
                  <p className="text-sm text-foreground">{m.insight}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleChapter() {
  return (
    <div className="space-y-6">
      <div>
        <SectionHeading>Your Role as a Satu Tuju Mentor</SectionHeading>
        <p className="text-text-muted text-sm">You are not a consultant. You are proof.</p>
      </div>
      <Callout color="purple">
        <p className="font-semibold mb-1">The fundamental difference</p>
        <p>A consultant has expertise and sells that expertise. The relationship is transactional. A Satu Tuju mentor is something different — you are living proof that this journey can be made. Not because you are smarter than your mentee. But because you have stood where they are standing right now — and you made it through.</p>
      </Callout>
      <p className="text-foreground leading-relaxed text-sm">
        Your presence in a single mentoring session is already an answer to your mentee's biggest question: <em className="font-semibold">"Is this possible for someone like me?"</em> This is a form of credibility that cannot be purchased with any degree or certificate.
      </p>

      <div className="space-y-4">
        <SubHeading>Three Pillars to Guide Every Session</SubHeading>
        <p className="text-sm text-text-muted">When things don't go as planned, these three pillars are your compass.</p>
        {PILLARS.map((p) => (
          <div key={p.num} className="card rounded-2xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-primary-50 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                {p.num}
              </div>
              <h4 className="text-sm font-semibold text-foreground">{p.title}</h4>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{p.description}</p>
            <ul className="space-y-1.5">
              {p.examples.map((ex, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-muted-3">
                  <Icon name="chevron-right" size={13} className="mt-0.5 flex-shrink-0 text-primary" />
                  {ex}
                </li>
              ))}
            </ul>
            {p.note && (
              <div className="bg-surface-amber border border-surface-amber-border rounded-lg px-3 py-2">
                <p className="text-xs text-text-amber">{p.note}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PsychologyChapter() {
  return (
    <div className="space-y-6">
      <div>
        <SectionHeading>Understanding Your Mentee's Psychological Journey</SectionHeading>
        <p className="text-text-muted text-sm">Two crises that almost always happen. Mentors who know this anticipate them. Those who don't are caught off guard.</p>
      </div>

      <div className="space-y-4">
        <div className="card rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">😟</span>
            <h3 className="text-base font-semibold">Crisis 1: "Am I good enough?"</h3>
          </div>
          <p className="text-xs text-text-muted font-medium">Typically appears early in the program, especially during gap analysis</p>
          <p className="text-sm text-foreground leading-relaxed">Gap analysis is one of the most valuable things you can do for your mentee — and also the most dangerous if not handled correctly. For the first time, the mentee sees the objective distance between their current profile and the requirements of their dream universities.</p>
          <div className="space-y-2">
            <Callout color="green">
              <p className="font-semibold text-xs uppercase mb-1">Before every gap analysis</p>
              <p>Identify and articulate your mentee's strengths first. Not as a formality — but as genuine grounding. Someone who already knows what is strong in them will be far more ready to receive feedback on areas for growth.</p>
            </Callout>
            <Callout color="blue">
              <p className="font-semibold text-xs uppercase mb-1">The right way to deliver gaps</p>
              <p>Use the language "this is what we need to work on together" — not "this is what you're lacking". This small framing difference has a large impact: the first creates collaboration, the second creates judgment.</p>
            </Callout>
            <Callout color="amber">
              <p className="font-semibold text-xs uppercase mb-1">Always end with a quick win</p>
              <p>At the end of the gap analysis session, always ensure your mentee leaves with one quick win they can work on before the next meeting. Not something big — something small and achievable. Small momentum is the best antidote to self-doubt.</p>
            </Callout>
          </div>
        </div>

        <div className="card rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">😮‍💨</span>
            <h3 className="text-base font-semibold">Crisis 2: "Is this worth it?"</h3>
          </div>
          <p className="text-xs text-text-muted font-medium">Typically appears mid-program, when working on motivation letters and LPDP essays</p>
          <p className="text-sm text-foreground leading-relaxed">This is the point where the initial excitement has faded, but the finish line isn't visible yet. The work in this phase is the heaviest — digging deep into oneself, writing, being rejected, rewriting, being rejected again. Energy drains. And the thought "what's the point of all this?" starts to emerge.</p>
          <p className="text-sm text-foreground leading-relaxed">This phase produces the most dropouts. And the most breakthroughs — if the mentor shows up in the right way.</p>
          <div className="space-y-2">
            {[
              { color: "purple", title: "Acknowledge it explicitly", body: "Don't skip past it with 'keep going!' — first validate that what they are feeling is normal and valid." },
              { color: "blue", title: "Show their progress", body: "Show the progress they have already made — even when they cannot see it themselves. A progress tracker is a very useful tool here." },
              { color: "green", title: "Celebrate small milestones", body: "When the LPDP essay is finalized — this is a major achievement worth celebrating explicitly, not leaping straight to the next task." },
            ].map((item) => (
              <Callout key={item.title} color={item.color}>
                <p className="font-semibold text-xs uppercase mb-1">{item.title}</p>
                <p>{item.body}</p>
              </Callout>
            ))}
          </div>
        </div>
      </div>

      <div className="card rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <Icon name="bell" size={16} className="text-danger" />
          <h3 className="text-base font-semibold">Warning Signs to Watch Every Session</h3>
        </div>
        <div className="space-y-3">
          {WARNING_SIGNS.map((w, i) => (
            <div key={i} className="bg-surface-red border border-surface-red-border rounded-xl px-4 py-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <Icon name="x" size={13} className="text-text-red mt-0.5 flex-shrink-0" />
                <p className="text-sm font-semibold text-text-red">{w.sign}</p>
              </div>
              <div className="flex items-start gap-2 ml-5">
                <Icon name="chevron-right" size={13} className="text-foreground mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">{w.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MilestonesChapter() {
  const [open, setOpen] = useState<number>(1);
  return (
    <div className="space-y-5">
      <div>
        <SectionHeading>Milestone Framework</SectionHeading>
        <p className="text-text-muted text-sm">The program is organized around milestones — concrete outputs that must be achieved before moving to the next stage. You have full freedom in how you reach each milestone. What is fixed is the output, not your execution.</p>
      </div>
      <div className="bg-surface-blue border border-surface-blue-border rounded-xl px-4 py-3 text-sm text-text-blue">
        Each milestone has two equally important outputs: <strong>Document Output</strong> (tangible and measurable) and <strong>Psychological Output</strong> (how the mentee should feel). Don't consider a milestone complete if only the document output is achieved.
      </div>
      <div className="space-y-3">
        {MILESTONES.map((m) => {
          const isOpen = open === m.num;
          return (
            <div key={m.num} className={`rounded-2xl border overflow-hidden ${isOpen ? `${m.bg} ${m.border}` : "bg-surface border-border"}`}>
              <button
                onClick={() => setOpen(isOpen ? 0 : m.num)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:opacity-90 transition"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isOpen ? `${m.bg} ${m.color}` : "bg-surface-elevated text-text-muted"}`}>
                  {m.num}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${isOpen ? m.color : "text-text-muted"}`}>
                      MILESTONE {m.num} · {m.sessions} {m.sessions === 1 ? "session" : "sessions"}
                    </span>
                  </div>
                  <p className={`text-sm font-semibold ${isOpen ? m.color : "text-foreground"}`}>{m.title}</p>
                  <p className="text-xs text-text-muted">{m.subtitle}</p>
                </div>
                <Icon name="chevron-down" size={15} className={`text-text-muted-2 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 space-y-4 animate-slide-in-up">
                  <div className="space-y-2">
                    <p className={`text-xs font-bold uppercase ${m.color}`}>Document Outputs</p>
                    <ul className="space-y-1.5">
                      {m.outputs.map((o, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <Icon name="check" size={13} className={`mt-0.5 flex-shrink-0 ${m.color}`} />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-xs font-bold uppercase ${m.color}`}>Psychological Outcomes</p>
                    <ul className="space-y-1.5">
                      {m.psychological.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <Icon name="star" size={13} className={`mt-0.5 flex-shrink-0 ${m.color}`} />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-xs font-bold uppercase ${m.color}`}>Key Principles</p>
                    <ul className="space-y-1.5">
                      {m.principles.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground bg-surface/60 rounded-lg px-3 py-2">
                          <Icon name="lightbulb" size={13} className={`mt-0.5 flex-shrink-0 ${m.color}`} />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PracticesChapter() {
  return (
    <div className="space-y-6">
      <div>
        <SectionHeading>Best Practices</SectionHeading>
        <p className="text-text-muted text-sm">From accumulated mentoring experience</p>
      </div>

      {/* Session rituals */}
      <div className="space-y-3">
        <SubHeading>Three Rituals for Every Session</SubHeading>
        <p className="text-sm text-text-muted">These three things must happen in every meeting — regardless of milestone, regardless of agenda.</p>
        {[
          { icon: "bell", title: "Opening: Genuine Check-in", body: "Not 'ok, let's get straight to the agenda' — but two genuine minutes: 'How have you been since our last session?' And actually listen to the answer. Your mentee's condition will heavily influence how this session should run." },
          { icon: "check", title: "Closing: Acknowledge Progress", body: "Every session must close with one explicit acknowledgment of progress achieved — from you to your mentee. Not empty praise. Something specific: 'The narrative you found today is far stronger than you imagined when we started. You found your own voice.'" },
          { icon: "chart", title: "Progress Tracker: Fill It Together", body: "At the end of every session, fill in the progress tracker together — not you alone afterward, not the mentee alone afterward. Together. This is the ritual that makes progress feel real and concrete for the mentee." },
        ].map((r) => (
          <div key={r.title} className="card rounded-2xl flex items-start gap-4">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Icon name={r.icon} size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{r.title}</p>
              <p className="text-sm text-text-muted mt-1 leading-relaxed">{r.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Story mining */}
      <div className="space-y-3">
        <SubHeading>Story Mining Technique (Milestone 3)</SubHeading>
        <p className="text-sm text-text-muted">Milestone 3 is where mentors are most tempted to "take over" — because they can see what the narrative should contain, and the mentee looks stuck. Story mining helps you excavate without taking over.</p>
        <div className="card rounded-2xl space-y-3">
          <p className="text-xs font-bold text-text-purple uppercase">Most effective questions to ask</p>
          {[
            "Tell me a moment when you felt most alive in your work.",
            "If you didn't continue to a master's degree, what would you most regret not doing?",
            "Who is the one person who will feel the most impact from your master's degree success — and why?",
            "What makes you different from the hundreds of other applicants with a similar background?",
          ].map((q, i) => (
            <div key={i} className="bg-surface-purple border border-surface-purple-border rounded-lg px-3 py-2.5 text-sm text-foreground">
              "{q}"
            </div>
          ))}
          <div className="bg-surface-blue border border-surface-blue-border rounded-xl px-4 py-3 text-sm text-text-blue">
            After the mentee answers — reflect back what you heard in your own words: <em>"From what I hear you saying, the strongest thread is..."</em> Then ask: <em>"Is that what you want to say?"</em> Their yes or no will tell you whether you've uncovered an authentic narrative — or need to dig deeper.
          </div>
        </div>
      </div>

      {/* Don'ts */}
      <div className="space-y-3">
        <SubHeading>Things You Must Never Do</SubHeading>
        <p className="text-sm text-text-muted">These are not just guidelines — they are principles that, if broken, will undermine what we are trying to build.</p>
        <div className="card rounded-2xl space-y-2">
          {DONTS.map((d, i) => (
            <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-border last:border-0">
              <Icon name="x" size={14} className="text-danger mt-0.5 flex-shrink-0" />
              <p className="text-sm text-foreground">{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 24h summary */}
      <div className="space-y-3">
        <SubHeading>Send a Summary Within 24 Hours</SubHeading>
        <Callout color="green">
          <p className="font-semibold mb-2">After every session, send a brief summary to your mentee within 24 hours.</p>
          <p>Not a long report — just three things:</p>
          <ul className="mt-2 space-y-1">
            {["What we achieved today", "What your homework is before the next session", "When the next session is"].map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <Icon name="check" size={13} className="text-text-green flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs opacity-80">This is the only administrative responsibility Satu Tuju asks of you. Everything else — scheduling, reminders, administrative communication — is handled by the Satu Tuju team.</p>
        </Callout>
      </div>

      {/* Closing */}
      <div className="bg-primary-50 border border-primary-200 rounded-2xl px-6 py-5 text-center space-y-2">
        <p className="text-sm font-semibold text-primary">One Session. One Person Shaped.</p>
        <p className="text-sm text-text-muted-3 leading-relaxed">Every time you open a session and meet your mentee — remember that what happens in those 60–90 minutes is not just an ordinary conversation. It is a chance to help shape one person who may return with a broader perspective, stronger capabilities, and a more meaningful contribution. And one day, perhaps, become a mentor for someone else.</p>
        <p className="text-xs text-text-muted-2 italic mt-3">"We are not here to place the puzzle piece. We are here to shape it."</p>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────── */

const CHAPTER_MAP: Record<string, React.ReactNode> = {
  welcome:    <WelcomeChapter />,
  myths:      <MythsChapter />,
  role:       <RoleChapter />,
  psychology: <PsychologyChapter />,
  milestones: <MilestonesChapter />,
  practices:  <PracticesChapter />,
};

export default function MentorToolkitPage() {
  const [active, setActive] = useState("welcome");

  const currentIdx = CHAPTERS.findIndex((c) => c.id === active);
  const prev = CHAPTERS[currentIdx - 1];
  const next = CHAPTERS[currentIdx + 1];
  const activeChapter = CHAPTERS[currentIdx];

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/dashboard/resources"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground transition"
      >
        <Icon name="arrow-left" size={14} />
        Resources
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">Mentor Toolkit</h1>
        <p className="text-text-muted text-sm mt-1">Your complete guide to effective mentoring at Satu Tuju</p>
      </div>

      {/* Document panel — full width. NO overflow-hidden so sticky works */}
      <div className="border border-border rounded-2xl bg-surface shadow-[var(--shadow-xs)]">

        {/* ── Body: sidebar + content column ── */}
        <div className="flex items-start">

          {/* Sidebar — sticky. rounded left corners to compensate for no overflow-hidden on parent */}
          <aside className="hidden md:block w-52 flex-shrink-0 self-start sticky top-6 border-r border-border bg-surface-elevated/30 rounded-tl-2xl rounded-bl-2xl">
            <div className="px-4 pt-5 pb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted-2">Chapters</p>
            </div>
            <nav className="flex flex-col gap-0.5 p-3 pt-1 pb-5">
              {CHAPTERS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                    active === c.id
                      ? "bg-brand-blue-soft text-primary"
                      : "text-text-muted hover:bg-surface-elevated hover:text-foreground"
                  }`}
                >
                  <Icon name={c.icon} size={14} className={active === c.id ? "text-primary" : "text-text-muted-2"} />
                  {c.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content column */}
          <div className="flex-1 min-w-0 flex flex-col">

            {/* ── Chapter content ── */}
            <div className="px-6 py-6 md:px-10 md:py-8">
              <div key={active} className="animate-fade-in space-y-8">
                {CHAPTER_MAP[active]}
              </div>

              {/* Prev / Next */}
              <div className="flex items-center justify-between mt-10 pt-5 border-t border-border">
                {prev ? (
                  <button
                    onClick={() => setActive(prev.id)}
                    className="flex items-center gap-2 text-sm text-text-muted hover:text-foreground transition"
                  >
                    <Icon name="arrow-left" size={14} />
                    {prev.label}
                  </button>
                ) : <span />}
                {next ? (
                  <button
                    onClick={() => setActive(next.id)}
                    className="flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80 transition"
                  >
                    {next.label}
                    <Icon name="arrow-right" size={14} />
                  </button>
                ) : <span />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
