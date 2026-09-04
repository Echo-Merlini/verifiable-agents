import type { Metadata } from "next";
import { TopNav } from "@/components/TopNav";
import { VerticeMark } from "@/components/VerticeMark";

export const metadata: Metadata = {
  title: "For business — Vértice Criativo",
  description:
    "Verifiable AI infrastructure for business: what it is, how a client adopts it, the components, and indicative pricing. Don't trust. Recompute.",
};

const LAYERS = [
  {
    k: "Layer 1",
    core: true,
    h: "Technical proof",
    p: "The recomputable receipt. Self-verifiable by anyone, no trust and no vendor call. This is the spine — always present.",
  },
  {
    k: "Layer 2 · optional",
    h: "Legal proof",
    p: "An eIDAS qualified timestamp / seal composed over the receipt — proof a regulator, auditor or court accepts, which cryptography alone doesn't confer.",
  },
  {
    k: "Layer 3 · optional",
    h: "Post-quantum",
    p: "Non-custodial dual-family (ML-DSA + SLH-DSA) key binding for agents and wallets (ERC-8373). Live today — 29 agents PQ-bound, mainnet-anchored. The key never leaves the client.",
  },
];

const LADDER = [
  { no: "01", name: "Pilot / PoC", desc: "Recompute-receipt + on-chain anchoring bolted onto one existing workload. Proof it verifies, end to end, on the client's real data." },
  { no: "02", name: "Full implementation", desc: "The whole stack tailored to the client's agents and identities — gateway, SIWE auth, recomputable receipts, anchoring, the public verify surface, admin." },
  { no: "03", name: "Enterprise / regulated", desc: "Full stack plus the post-quantum binding, the eIDAS / legal layer, and compliance & audit alignment (EU AI Act) — with ongoing support." },
  { no: "04", name: "Ongoing", desc: "The install is the moat, so it doesn't ship flat: a support retainer keeps proofs current and post-quantum-ready, with optional per-verified-output or per-seat licensing." },
];

const COMPONENTS = [
  { h: "Recompute Kit", tag: "Core", p: "Recomputable receipts + on-chain anchoring. The primitive everything else builds on — re-derive any result from public data.", st: "Production · open primitive" },
  { h: "Attested AI agents", tag: "Core", p: "Agents whose every action carries checkable provenance — EIP-712 signature, per-agent PQ companion signature, on-chain anchor.", st: "Live · ai.verticecriativo.pt" },
  { h: "PQ key binding", tag: "Security", p: "Non-custodial post-quantum identity binding (ML-DSA + SLH-DSA) for agents and any wallet, independently recomputable via the ERC-8373 enforcer.", st: "Live · mainnet KYA-L4 · 29 agents" },
  { h: "Verification surfaces", tag: "Product", p: "The public proof pages a client or their auditor uses to recompute a claim themselves — the trust made visible.", st: "Live · /verify · /review · /quantum" },
  { h: "Primitives registry", tag: "Product", p: "The capability index that verifies itself — lists what's built, and re-derives any entry live (on-chain, endpoint or conformance). Drift fails a check; nothing on faith.", st: "Live · trustless-ai/primitives" },
  { h: "Commercial MCPs", tag: "Product", p: "Specialized capability servers carried by an agent, gated on-chain and billable pay-per-use (A2A micro-payments).", st: "Available" },
  { h: "Identity gateway", tag: "Infra", p: "CCIP-Read ENS names, subnames, records and IPFS — the identity substrate the receipts and bindings resolve against.", st: "Live · gateway.verticecriativo.pt" },
  { h: "Independent review gate", tag: "Assurance", p: "A signed, Bitcoin-anchored review verdict on a release — recomputable against a published key by anyone, in partnership with invinoveritas.", st: "Live · /review" },
];

const TIERS = [
  { no: "01", name: "Pilot / PoC", scope: "Recompute + anchoring on one workload, on the client's existing stack.", price: "15k–40k" },
  { no: "02", name: "Full implementation", scope: "The whole stack tailored to the client's agents & identities.", price: "50k–150k" },
  { no: "03", name: "Enterprise / regulated", scope: "Full stack + PQ binding + eIDAS legal layer + compliance alignment + support.", price: "150k–400k+" },
];

const ADDS = [
  { h: "Day rate", v: "€800–1,500", s: "Time & materials, or to sanity-check a fixed price. A full build is 2–4 months." },
  { h: "Support retainer", v: "€2k–8k / mo", s: "Keeps proofs current and post-quantum-ready after the install." },
  { h: "Licensing", v: "per output / seat", s: "Optional recurring layer for hosted verification — worth more over time than a flat install." },
];

const LEVERS = [
  ["Scope", "one workload versus the full stack moves the number most."],
  ["Buyer", "a regulated enterprise buys the outcome (court-admissible AI), priced accordingly."],
  ["One-off vs recurring", "the install is the moat; it carries a retainer, not a flat fee."],
  ["Bespoke vs productized", "fixed tiers make it repeatable and quotable in a sentence."],
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-brassLight">
      <span className="h-px w-6 bg-brassLight/60" />
      {children}
    </p>
  );
}

export default function BusinessPage() {
  return (
    <div className="min-h-screen bg-deepink text-paper font-display">
      <TopNav />

      <main className="mx-auto max-w-4xl px-6">
        {/* ── Hero ── */}
        <header className="border-b border-white/10 py-16 sm:py-20">
          <div className="flex items-center gap-4">
            <VerticeMark size={44} spin />
            <div className="leading-tight">
              <div className="text-lg font-semibold tracking-tight">Vértice&nbsp;Criativo</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-gb-muted">Verifiable AI · Self-hosted stack</div>
            </div>
          </div>

          <h1 className="mt-10 max-w-[15ch] text-balance text-4xl font-semibold leading-[1.04] tracking-tight sm:text-6xl">
            Verifiable AI infrastructure
          </h1>
          <p className="mt-4 font-serif text-2xl italic text-brassLight">Don't trust. Recompute.</p>
          <p className="mt-5 max-w-[62ch] text-[17px] leading-relaxed text-gb-muted">
            A stack for AI whose output the client reproduces and verifies independently — without trusting
            the operator and without calling its servers. Every action leaves a receipt anyone can re-derive
            from public data. This page covers what it is, how a client adopts it, the components, and
            indicative pricing.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[12px] text-gb-muted">
            <span className="text-paper/70">Product &amp; services brief</span>
            <span>Rev. Sep 2026</span>
            <span>verticecriativo.pt</span>
          </div>
        </header>

        {/* ── The product ── */}
        <section className="border-b border-white/[0.06] py-14">
          <Eyebrow>The product</Eyebrow>
          <h2 className="mb-4 max-w-[20ch] text-balance text-2xl font-semibold tracking-tight sm:text-3xl">Proof that travels with the output</h2>
          <p className="mb-4 max-w-[64ch] text-[16.5px] leading-relaxed text-gb-muted">
            Most "trustworthy AI" asks you to trust a dashboard. Vértice inverts it: every agent action emits
            a <strong className="font-semibold text-paper">recomputable receipt</strong> — anchored on-chain,
            re-derivable by a third party from public data alone. The verifier never re-runs the model and
            never contacts us. Verification is separated from the machine that produced the result — which is
            what makes AI at scale auditable by people who will never own the infrastructure.
          </p>
          <p className="max-w-[64ch] text-[16.5px] leading-relaxed text-gb-muted">
            It is <strong className="font-semibold text-paper">in production today</strong>, not a proposal:
            agents emitting receipts at ai.verticecriativo.pt, a public no-auth verify endpoint at
            gateway.verticecriativo.pt, and even <strong className="font-semibold text-paper">the capability
            list itself is recomputable</strong> — hand our registry any entry and it re-derives it live
            (don't trust the list, recompute it). The open primitives are going through the Ethereum standards
            process. The same discipline recently caught real build errors in a third party's model release.
          </p>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {LAYERS.map((l) => (
              <div key={l.h} className={`relative rounded-xl border p-5 ${l.core ? "border-brassLight/60 bg-white/[0.04]" : "border-white/10 bg-white/[0.02]"}`}>
                {l.core && <span className="absolute right-4 top-4 rounded bg-brassLight/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-brassLight">core</span>}
                <div className="font-mono text-[11px] uppercase tracking-wider text-gb-muted">{l.k}</div>
                <h3 className="mb-2 mt-2 text-[17px] font-semibold tracking-tight">{l.h}</h3>
                <p className="text-sm leading-relaxed text-gb-muted">{l.p}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Application model ── */}
        <section className="border-b border-white/[0.06] py-14">
          <Eyebrow>Application model</Eyebrow>
          <h2 className="mb-4 max-w-[20ch] text-balance text-2xl font-semibold tracking-tight sm:text-3xl">How a client adopts it</h2>
          <p className="mb-2 max-w-[64ch] text-[16.5px] leading-relaxed text-gb-muted">
            Engagements ladder up from a bounded proof-of-concept to a full regulated deployment. It runs
            <strong className="font-semibold text-paper"> on infrastructure the client owns</strong> (self-hosted)
            or hosted by Vértice — keys stay non-custodial either way. Each step is a real deliverable, not a demo.
          </p>
          <div className="mt-6 border-t border-white/10">
            {LADDER.map((r) => (
              <div key={r.no} className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-white/10 py-5 sm:grid-cols-[44px_220px_1fr]">
                <div className="font-mono text-[13px] text-brassLight">{r.no}</div>
                <div className="text-[17px] font-semibold tracking-tight">{r.name}</div>
                <div className="text-[15px] leading-relaxed text-gb-muted">{r.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Components ── */}
        <section className="border-b border-white/[0.06] py-14">
          <Eyebrow>Product list</Eyebrow>
          <h2 className="mb-4 max-w-[20ch] text-balance text-2xl font-semibold tracking-tight sm:text-3xl">The components</h2>
          <p className="max-w-[64ch] text-[16.5px] leading-relaxed text-gb-muted">
            Sold as a tailored implementation or as individual seams that drop onto an existing stack. The
            verifiable-AI core is below; the wider studio also delivers products (clock-in.pt), automation
            (n8n / MCP) and technical AV services.
          </p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {COMPONENTS.map((c) => (
              <div key={c.h} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[16.5px] font-semibold tracking-tight">{c.h}</h3>
                  <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-gb-muted">{c.tag}</span>
                </div>
                <p className="text-sm leading-relaxed text-gb-muted">{c.p}</p>
                <div className="mt-0.5 font-mono text-[11px] tracking-wide text-brassLight">{c.st}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="border-b border-white/[0.06] py-14">
          <Eyebrow>Indicative pricing</Eyebrow>
          <h2 className="mb-5 max-w-[20ch] text-balance text-2xl font-semibold tracking-tight sm:text-3xl">What an engagement runs</h2>
          <div className="mb-6 inline-flex items-center gap-2 rounded border border-white/10 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wide text-gb-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-brassLight" /> Estimate — a scoping call sets the real number
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-white/10 text-left font-mono text-[12px] uppercase tracking-wide text-gb-muted">
                  <th className="pb-3 pr-4 font-semibold">Tier</th>
                  <th className="pb-3 pr-4 font-semibold">Scope</th>
                  <th className="pb-3 text-right font-semibold">Indicative</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t) => (
                  <tr key={t.no} className="border-b border-white/[0.06] align-top">
                    <td className="py-4 pr-4"><span className="font-mono text-[12px] text-brassLight">{t.no}</span> <span className="font-semibold tracking-tight">{t.name}</span></td>
                    <td className="py-4 pr-4 text-[14px] leading-snug text-gb-muted">{t.scope}</td>
                    <td className="whitespace-nowrap py-4 text-right font-mono tabular-nums font-medium text-paper"><span className="text-gb-muted">€</span>{t.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {ADDS.map((a) => (
              <div key={a.h} className="border-l-2 border-brassLight pl-4">
                <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-gb-muted">{a.h}</p>
                <p className="font-mono tabular-nums text-[16px] font-medium">{a.v}</p>
                <p className="mt-1 text-[13px] leading-snug text-gb-muted">{a.s}</p>
              </div>
            ))}
          </div>

          <ul className="mt-8 grid list-none gap-2.5 p-0 sm:grid-cols-2">
            {LEVERS.map(([b, rest]) => (
              <li key={b} className="flex gap-3 text-[14.5px] leading-snug text-gb-muted">
                <span className="shrink-0 font-mono text-brassLight">→</span>
                <span><b className="font-semibold text-paper">{b}</b> — {rest}</span>
              </li>
            ))}
          </ul>

          <p className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-5 font-serif text-[17px] italic leading-snug">
            This is a genuinely rare skill set — verifiable compute, post-quantum crypto, on-chain anchoring
            and live standards work in one stack.{" "}
            <b className="font-display font-semibold not-italic text-brassLight">Price the outcome, not the hours.</b>
          </p>
        </section>

        {/* ── Footer / CTA ── */}
        <footer className="py-14 sm:py-16">
          <a
            href="mailto:contact@verticecriativo.pt?subject=Verifiable%20AI%20—%20scoping"
            className="inline-flex items-center gap-2.5 rounded-md bg-brassLight px-6 py-3.5 text-[17px] font-semibold tracking-tight text-deepink transition-opacity hover:opacity-90"
          >
            Request a scoped quote →
          </a>
          <p className="mt-6 max-w-[66ch] text-[12.5px] leading-relaxed text-gb-muted">
            Figures are indicative and subject to a scoping call — not a formal quotation. Ranges reflect
            typical scope, buyer profile and engagement model; the stack is self-hosted and free/open at its
            base, so cost tracks delivery effort and support, not licence fees.
          </p>
          <div className="mt-8 border-t border-white/10 pt-6 font-mono text-[11.5px] leading-loose tracking-wide text-gb-muted">
            <span className="text-paper/70">VÉRTICE CRIATIVO — UNIPESSOAL LDA</span> · NIPC 519525450 · Amadora, Portugal
            <br />
            contact@verticecriativo.pt · +351 967 836 438 · verticecriativo.pt · <span className="text-paper/70">Don't trust. Recompute.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
