import type { Metadata } from "next";
import { TopNav } from "@/components/TopNav";
import { VerticeMark } from "@/components/VerticeMark";

export const metadata: Metadata = {
  title: "The story — Vértice Criativo",
  description:
    "How Vértice Criativo was made — from a broadcast mixing desk to verifiable-AI infrastructure, and the open working group it grew up in. Don't trust. Recompute.",
};

const ORIGINALS = [
  { h: "Tiago Merlini", hn: "@TMerlini · GobRoss", r: "Originator & weaver. Agent identity and WYRIWE input-provenance (ERC-8299)." },
  { h: "Damon Zwicker", hn: "@damonzwicker", r: "Co-founder. The on-chain commitment anchor everything records to (ERC-8281, OCP)." },
  { h: "Vincent Wu", hn: "@TruthAnchor-AI", r: "An on-chain proof layer for agents (ERC-8263); WYRIWE co-author." },
  { h: "Jimmy Shi", hn: "@JimmyShi22", r: "Agent execution and inference-proof verification (ERC-8301 / 8274); zero-knowledge inference." },
  { h: "Fede", hn: "@babyblueviper1", r: "Verifiable verdicts (invinoveritas) and source-token binding (ERC-8323); the recomputability-as-definition principle." },
  { h: "Pavlo", hn: "@pipavlo82", r: "Recomputable verification receipts (ERC-8404); the index-is-not-authority and fail-closed disciplines." },
];

const TIMELINE = [
  { d: "1983", e: "Lisbon. Born; independent from fifteen." },
  { d: "2001–09", e: "NL · London · São Paulo. Self-made across borders; audio engineering; the Techsoul label." },
  { d: "2010s", e: "Broadcast. FOH, mastering, sound design, national-TV mixing — 15+ years." },
  { d: "2020–25", e: "The pivot. Isolation and a COVID layoff spent deep in crypto, then AI-assisted code." },
  { d: "early 2026", e: "dinamic.eth. The first platform — an ENS-native agent kit; the 'proof travels' instinct." },
  { d: "Jun 2026", e: "WYRIWE → ERC-8299. The recompute thesis becomes a standard. trustless-ai org founded." },
  { d: "7 Jul 2026", e: "Vértice Criativo incorporated. 'Don't trust. Recompute.'" },
  { d: "Jul 2026", e: "ETHGlobal Lisbon — 'Recomputable Agents.' recompute-kit productized." },
  { d: "Sep 2026", e: "Today. Self-verifying primitives registry; EuroHPC allocation; grant + eIDAS-ready tracks." },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-brassLight">
      <span className="h-px w-6 bg-brassLight/60" />
      {children}
    </p>
  );
}

export default function StoryPage() {
  return (
    <div className="min-h-screen bg-deepink text-paper font-display">
      <TopNav />

      <main className="mx-auto max-w-3xl px-6">
        {/* ── Hero ── */}
        <header className="border-b border-white/10 py-16 sm:py-20">
          <div className="flex items-center gap-4">
            <VerticeMark size={44} spin />
            <div className="leading-tight">
              <div className="text-lg font-semibold tracking-tight">Vértice&nbsp;Criativo</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-gb-muted">The story</div>
            </div>
          </div>

          <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-brassLight">How it was made</p>
          <h1 className="mt-3 max-w-[18ch] text-balance font-serif text-4xl font-medium leading-[1.06] tracking-tight sm:text-6xl">
            A verifiable-AI company that began at a <span className="italic text-brassLight">mixing desk</span>.
          </h1>
          <p className="mt-5 font-mono text-[13px] tracking-wide text-gb-muted">Don't trust. Recompute.</p>
          <p className="mt-6 max-w-[58ch] font-serif text-xl leading-relaxed text-gb-muted">
            Vértice didn't start in a lab or a fund. It started with a broadcast audio engineer who spent a
            hard stretch going deep instead of going under — and came out convinced that proof should travel
            with the work, not live on a dashboard you're asked to trust.
          </p>
        </header>

        {/* ── The engineer ── */}
        <section className="border-b border-white/[0.06] py-14">
          <Eyebrow>The engineer</Eyebrow>
          <h2 className="mb-5 max-w-[22ch] text-balance text-2xl font-semibold tracking-tight sm:text-3xl">Fifteen years of getting the signal right</h2>
          <p className="mb-4 max-w-[60ch] font-serif text-[18px] leading-relaxed text-paper/90">
            Tiago Merlini Ferrão has been on his own since he was fifteen. At eighteen he was in the
            Netherlands on almost nothing; then London, São Paulo, back to Lisbon — a music label built and
            left, a decade and a half as an audio engineer: front-of-house, mastering, sound design, broadcast
            mixing for Portuguese national television. A craft where you don't get to <em>say</em> the signal
            is clean — the meters either agree or they don't.
          </p>
          <p className="max-w-[60ch] font-serif text-[18px] leading-relaxed text-gb-muted">
            Then a quieter chapter. A hard personal period, and later a COVID layoff, gave him a long stretch
            of time. He used it to go deep — streaming, broadcast infrastructure, and then the thing that would
            reorganise everything: blockchain, and self-taught, AI-assisted code. The instinct for spotting a
            technology early was the same one he'd trained at the desk: don't trust the room, check the signal.
          </p>
        </section>

        {/* ── The instinct ── */}
        <section className="border-b border-white/[0.06] py-14">
          <Eyebrow>The instinct</Eyebrow>
          <h2 className="mb-5 max-w-[22ch] text-balance text-2xl font-semibold tracking-tight sm:text-3xl">A tool built for himself — dinamic.eth</h2>
          <p className="max-w-[60ch] font-serif text-[18px] leading-relaxed text-paper/90">
            It began as infrastructure he wanted to exist: <strong className="font-semibold text-paper">dinamic.eth</strong>,
            an Ethereum-native kit — dynamic ENS identities, on-demand token-gated subnames, two-tier IPFS
            pinning, on-demand contract deploys, on-chain agents. Still live today, owned by a single wallet
            that would come to thread the whole story. Underneath the features was one conviction, carried over
            from broadcast: a system's proof should be part of its output — re-derivable by anyone — not a
            badge on a page.
          </p>
        </section>

        {/* ── The thesis ── */}
        <section className="border-b border-white/[0.06] py-14">
          <Eyebrow>The thesis</Eyebrow>
          <h2 className="mb-5 max-w-[22ch] text-balance text-2xl font-semibold tracking-tight sm:text-3xl">What you read is what you execute</h2>
          <p className="mb-4 max-w-[60ch] font-serif text-[18px] leading-relaxed text-paper/90">
            On <strong className="font-semibold text-paper">11 June 2026</strong> he filed <strong className="font-semibold text-paper">WYRIWE</strong> —
            <em> What You Read Is What You Execute</em> — input-provenance for AI inference, assigned ERC-8299.
            That was the moment the boilerplate became a company-sized idea: don't trust the machine that
            produced a result — re-derive the result yourself, from public data, without owning the machine and
            without calling its servers.
          </p>
          <p className="my-7 border-l-2 border-brassLight pl-5 font-serif text-2xl italic leading-snug text-brassLight">
            Don't trust. Recompute.
          </p>
          <p className="max-w-[60ch] font-serif text-[18px] leading-relaxed text-gb-muted">
            It isn't the same promise as trusted hardware or zero-knowledge proofs. Trusted execution asks
            "can you trust the machine that ran this?" — and needs you to own or attest the silicon.
            Recomputation asks a different question — <strong className="font-semibold text-paper">"can you
            re-derive this yourself?"</strong> — and that answer doesn't change with who owns the hardware.
            Vértice owns no GPUs, and it costs the proof nothing.
          </p>
        </section>

        {/* ── The open house ── */}
        <section className="border-b border-white/[0.06] py-14">
          <Eyebrow>The open house</Eyebrow>
          <h2 className="mb-5 max-w-[22ch] text-balance text-2xl font-semibold tracking-tight sm:text-3xl">Built in the open, with a working group</h2>
          <p className="mb-6 max-w-[60ch] font-serif text-[18px] leading-relaxed text-paper/90">
            He didn't build it closed, and he didn't build it alone. He and <strong className="font-semibold text-paper">Damon
            Zwicker</strong> started it; a core of six became the originals, and the reference implementations
            moved into a neutral home — <strong className="font-semibold text-paper">trustless-ai</strong> —
            where every repository ships clone-run-recompute and recomputability is the definition of
            membership. The founding group, in the order they arrived:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ORIGINALS.map((p) => (
              <div key={p.h} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[15px] font-semibold tracking-tight">{p.h}</h3>
                  <span className="shrink-0 font-mono text-[10.5px] text-brassLight">{p.hn}</span>
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-gb-muted">{p.r}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-[60ch] font-serif text-[17px] leading-relaxed text-gb-muted">
            The group grew from there — early on <strong className="font-semibold text-paper">Tracie Myers</strong> (a
            validation-network interface), <strong className="font-semibold text-paper">Blockbird</strong> (bounded
            agent actions) and <strong className="font-semibold text-paper">Panini</strong> (service discovery &amp;
            escrow) — and many more since: giskard, Zexo, Ryan &amp; Jin, and others. The rooms don't share a
            channel, so Tiago became the weaver — relaying between them, and always arriving with a running
            system, not just a paper. <em>Build the thing first; open the standard second.</em>
          </p>
        </section>

        {/* ── The company ── */}
        <section className="border-b border-white/[0.06] py-14">
          <Eyebrow>The company</Eyebrow>
          <h2 className="mb-5 max-w-[22ch] text-balance text-2xl font-semibold tracking-tight sm:text-3xl">Vértice Criativo — making the work legible</h2>
          <p className="mb-4 max-w-[60ch] font-serif text-[18px] leading-relaxed text-paper/90">
            His last broadcast job was behind him — left over a disagreement he wasn't willing to swallow — and
            the projects were adding up. On <strong className="font-semibold text-paper">7 July 2026</strong> he
            incorporated <strong className="font-semibold text-paper">Vértice Criativo</strong> in Lisbon. The
            name of the discipline became the name of the company: a legible home for the work after a long
            stretch of being all-in on his own projects.
          </p>
          <p className="max-w-[60ch] font-serif text-[18px] leading-relaxed text-gb-muted">
            It runs on two faces. <strong className="font-semibold text-paper">Vértice</strong> ships the
            commercial work — implementations, integration, the recompute-UI, the client relationship. The
            primitives underneath release <strong className="font-semibold text-paper">CC0, in the open</strong>,
            through trustless-ai — because the open, recomputable stack is itself the credibility proof. Take
            the instance, never the definition — a rule he applies even to himself.
          </p>
        </section>

        {/* ── House style ── */}
        <section className="border-b border-white/[0.06] py-14">
          <Eyebrow>The house style</Eyebrow>
          <h2 className="mb-5 max-w-[22ch] text-balance text-2xl font-semibold tracking-tight sm:text-3xl">The bugs it hunts tell you what it is</h2>
          <p className="mb-4 max-w-[60ch] font-serif text-[18px] leading-relaxed text-paper/90">
            Across a summer of building together, nearly every real defect the group found had the same shape:
            <strong className="font-semibold text-paper"> a check that verifies something next to what it claims
            to verify — and prints green doing it.</strong> A byte-integrity test standing in for two-party
            agreement. A signature covering every field except the one the logic used.
          </p>
          <p className="mb-4 max-w-[60ch] font-serif text-[18px] leading-relaxed text-gb-muted">
            None were caught by re-reading. Each was caught by someone who didn't write it, or by real data
            arriving.
          </p>
          <p className="max-w-[60ch] font-serif text-[18px] leading-relaxed text-gb-muted">
            And it isn't a principle in a frame — it's a live practice. The group catches this shape in each
            other's systems, still: a review verdict that had quietly collapsed <em>"found real evidence"</em> and
            <em> "couldn't tell"</em> into one green-looking result surfaced in our own pipeline this very week,
            caught by another member. <strong className="font-semibold text-paper">Agreement is not
            verification, and the only cure is to recompute.</strong>
          </p>
        </section>

        {/* ── Today ── */}
        <section className="border-b border-white/[0.06] py-14">
          <Eyebrow>Today</Eyebrow>
          <h2 className="mb-5 max-w-[22ch] text-balance text-2xl font-semibold tracking-tight sm:text-3xl">Live, in production, opening real doors</h2>
          <p className="mb-4 max-w-[60ch] font-serif text-[18px] leading-relaxed text-paper/90">
            The stack is running, not proposed: agents that emit recomputable receipts, a public no-auth verify
            endpoint anyone can hit, post-quantum key binding anchored on Ethereum mainnet, and a self-verifying
            capability registry — hand it any entry and it re-derives it live. The primitives are moving through
            the Ethereum standards process.
          </p>
          <p className="mb-8 max-w-[60ch] font-serif text-[18px] leading-relaxed text-gb-muted">
            And the open work has started opening institutional doors: a European supercomputing allocation
            (EuroHPC · Deucalion) for zero-knowledge inference proofs, a European public-money grant track, and
            an eIDAS-ready path that lets a recomputable AI action compose under a qualified seal a regulator or
            court accepts. From a personal ENS kit to standards, compute and regulation — in a little over a year.
          </p>

          <div className="border-t border-white/10">
            {TIMELINE.map((r) => (
              <div key={r.d} className="grid grid-cols-[92px_1fr] gap-4 border-b border-white/[0.06] py-3.5">
                <div className="font-mono text-[12px] text-brassLight">{r.d}</div>
                <div className="text-[14.5px] leading-relaxed text-gb-muted">{r.e}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Close ── */}
        <footer className="py-14 sm:py-16">
          <p className="mb-8 max-w-[52ch] font-serif text-2xl italic leading-snug text-paper">
            A broadcast engineer's habit, turned into infrastructure:{" "}
            <span className="font-display font-semibold not-italic text-brassLight">check the signal, don't trust the room.</span>
          </p>
          <a
            href="/business"
            className="inline-flex items-center gap-2.5 rounded-md bg-brassLight px-6 py-3.5 text-[17px] font-semibold tracking-tight text-deepink transition-opacity hover:opacity-90"
          >
            See what Vértice offers →
          </a>
          <div className="mt-8 border-t border-white/10 pt-6 font-mono text-[11.5px] leading-loose tracking-wide text-gb-muted">
            <span className="text-paper/70">VÉRTICE CRIATIVO — UNIPESSOAL LDA</span> · NIPC 519525450 · Amadora, Portugal
            <br />
            contact@verticecriativo.pt · verticecriativo.pt · <span className="text-paper/70">Don't trust. Recompute.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
