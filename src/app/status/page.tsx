import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Status",
  description:
    "Current development status of The Witness Protocol Foundation platform. What exists, what is being built, and what does not yet exist.",
};

const statusSections = [
  {
    title: "Operational",
    description: "Live and functional in the current production build.",
    items: [
      { name: "Global Production Deployment", detail: "Live on Vercel with custom domain and edge-caching" },
      { name: "The Gate (3-Tier Vetting)", detail: "Tier 1: AI Sieve → Tier 2: AI Qualitative → Tier 3: Human Review via Admin Console" },
      { name: "Inquisitor Dialogue Engine", detail: "Phase 3 structured testimony extraction, powered by Claude Sonnet 4" },
      { name: "God Mode Admin Portal", detail: "Standalone passphrase-protected administrative backend" },
      { name: "Corpus Manager & Dashboard", detail: "Manual tagging interface (CAP/REL/FELT), pipeline statistics, and QA metrics" },
      { name: "Contributor Dashboard", detail: "Personal tracker for Gate progress and submission history" },
      { name: "Transaction Email Integration", detail: "Resend-powered magic links and automated acceptance notifications" },
      { name: "Sentry Error Monitoring", detail: "Live error capture and session tracking across browser, server, and edge runtimes" },
      { name: "PII De-identification", detail: "Strict regex-based anonymization pipeline securing all database layers" }
    ],
  },
  {
    title: "In Development",
    description: "Actively being built for Phase 5.",
    items: [
      { name: "Completed Testimony Corpus", detail: "Accumulating real human testimony to train the subsequent layers" },
      { name: "Constitutional Mirror", detail: "Cross-reference engine for analyzing structural taxonomy anomalies" },
      { name: "Icarus Synthesis Engine", detail: "Distilled thought generation derived from cross-witness alignments" }
    ],
  },
  {
    title: "Does Not Exist Yet",
    description: "Planned for future phases. Listed for transparency.",
    items: [
      { name: "Published Research Outputs", detail: "No corpus analysis, papers, or datasets yet released" },
      { name: "RFC-3161 Provenance Chain", detail: "Cryptographic timestamping not yet integrated" },
      { name: "IPFS Archival Layer", detail: "Content-addressed storage not yet implemented" },
      { name: "Board / SAC / HCC Portals", detail: "Structured external governance dashboards not implemented" },
      { name: "GDPR Compliance Tooling", detail: "DSAR handling, consent audit, and data export/purge not built" },
    ],
  },
];

export default function StatusPage() {
  return (
    <main className="relative min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-5xl font-light tracking-widest text-foreground text-glow uppercase">
            Status
          </h1>
          <p className="text-sm text-muted-foreground/60 font-sans max-w-lg mx-auto leading-relaxed">
            An honest accounting of what The Witness Protocol Foundation has
            built, is building, and has not yet started. Updated with each
            development phase.
          </p>
          <p className="inline-block px-4 py-1 border border-border/40 text-[10px] tracking-[0.3em] uppercase text-muted-foreground font-serif">
            Live · Phase 5 Setup
          </p>
        </div>

        {/* Status Sections */}
        {statusSections.map((section) => (
          <section key={section.title} className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl md:text-2xl tracking-widest uppercase text-foreground/80">
                {section.title}
              </h2>
              <p className="text-xs text-muted-foreground/50 font-sans">
                {section.description}
              </p>
            </div>
            <div className="space-y-3">
              {section.items.map((item) => (
                <div
                  key={item.name}
                  className="border border-border/15 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <h3 className="font-serif text-sm tracking-widest uppercase text-foreground/70">
                    {item.name}
                  </h3>
                  <p className="text-xs text-muted-foreground/50 font-sans sm:text-right max-w-sm">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Footer note */}
        <div className="text-center border-t border-border/10 pt-10">
          <p className="text-[10px] text-muted-foreground/30 tracking-widest uppercase font-sans">
            Last updated: April 2026 · This page will evolve with each development phase
          </p>
        </div>
      </div>
    </main>
  );
}
