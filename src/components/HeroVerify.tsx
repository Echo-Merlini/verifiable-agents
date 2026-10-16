"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";
import VoicePlayer from "@/components/VoicePlayer";

// The artifact. Real bytes, small enough to show in full — the point of this panel is that what
// gets hashed is exactly what is on screen, so a visitor can check the claim instead of taking it.
const CLEAN: Record<string, unknown> = {
  action: "swap",
  agent: "0x8b5AF3A59f81c7e16617E8Eb824BC6FfB792A2C3",
  amount_in: "0.002 ETH",
  amount_out: "3.686 USDC",
  chain_id: 1,
  venue: "uniswap-v3",
};
const TAMPERED_FIELD = "amount_out";
const TAMPERED_VALUE = "3.687 USDC";   // one digit. That is the whole demonstration.

// JCS-ish: sorted keys, no insignificant whitespace. Two independent implementations have to land
// on byte-identical input before their digests mean anything to each other.
const canon = (o: Record<string, unknown>) => JSON.stringify(o, Object.keys(o).sort());

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return "0x" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const short = (h: string) => h.slice(0, 10) + "…" + h.slice(-6);

export function HeroVerify() {
  const [tampered, setTampered] = useState(false);
  const [auto, setAuto] = useState(true);
  const [expected, setExpected] = useState<string | null>(null);
  const [got, setGot] = useState<string | null>(null);
  const markRef = useRef<HTMLSpanElement | null>(null);

  const obj = tampered ? { ...CLEAN, [TAMPERED_FIELD]: TAMPERED_VALUE } : CLEAN;
  const source = canon(obj);
  const tamperAt = tampered ? source.indexOf(TAMPERED_VALUE.slice(0, 5)) + 4 : -1;

  // Hash on every change. crypto.subtle is browser-only and needs a secure context, so this can
  // never run during SSR — hence an effect rather than a render-time call.
  useEffect(() => {
    let alive = true;
    sha256(source).then((h) => {
      if (!alive) return;
      setGot(h);
      setExpected((prev) => prev ?? h);   // the first paint is the reference digest
    });
    return () => { alive = false; };
  }, [source]);

  // Auto loop. Lingers slightly longer on the passing state so the failure reads as the event.
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => setTampered((v) => !v), tampered ? 2600 : 3400);
    return () => clearTimeout(t);
  }, [auto, tampered]);

  // Pointer parallax on the mark. Fine pointers only — on touch there is no hover, and listening
  // to pointermove there makes the mark lurch on every tap. Writes are coalesced to one per frame.
  useEffect(() => {
    const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
    const still = matchMedia("(prefers-reduced-motion:reduce)").matches;
    const el = markRef.current;
    if (!fine || still || !el) return;
    let raf = 0;
    const MAX = 16;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        el.style.setProperty("--px", (nx * MAX).toFixed(1) + "px");
        el.style.setProperty("--py", (ny * MAX * 0.7).toFixed(1) + "px");
      });
    };
    addEventListener("pointermove", onMove, { passive: true });
    return () => { removeEventListener("pointermove", onMove); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const ok = got !== null && expected !== null && got === expected;
  const settled = got !== null && expected !== null;
  const mk = (good: boolean) => (good ? "✓" : "✕");

  return (
    <section className="mx-auto max-w-6xl px-6 pt-14 pb-12 md:px-10 sm:pt-20 sm:pb-16">
      <style>{`
        /* Two elements: the wrapper takes the pointer parallax, the image takes the idle float.
           Both want the transform property, so on one element the JS write stamps the animation flat. */
        .hv-markwrap{transform:translate3d(var(--px,0px),var(--py,0px),0);
                     transition:transform .45s cubic-bezier(.2,.7,.3,1);will-change:transform}
        .hv-mark{animation:hv-float 7s ease-in-out infinite}
        @keyframes hv-float{
          0%,100%{transform:translateY(0) rotate(0deg)}
          50%    {transform:translateY(-11px) rotate(-1.4deg)}
        }
        /* rotateY is NEGATIVE here where semantic-abi's card is positive: that card sits on the
           left and faces right; this one sits on the right, so the same angle would face it away
           from the page instead of into it. */
        .hv-card{transform-style:preserve-3d;transform:rotateX(2deg) rotateY(-7deg)}
        /* A 7deg tilt reads as depth beside a text column and as a rendering fault once the card
           is nearly the full screen. */
        @media(max-width:899px){.hv-card{transform:none}}
        @media(prefers-reduced-motion:reduce){
          .hv-mark{animation:none}
          .hv-markwrap{transform:none!important;transition:none}
        }
      `}</style>

      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* ── left: the claim ───────────────────────────────────────────── */}
        <div className="min-w-0">
          {/* block-level flex, not inline-flex: inline-level here shares a line with the headline
              and shoves it (and the mark overhanging it) sideways under the card. */}
          <p className="flex w-max max-w-full items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-brassLight/80">
            <span aria-hidden="true" className="h-px w-6 bg-brass/50" /> Live on Ethereum
          </p>

          <h1 className="mt-5 block max-w-full font-display font-medium tracking-tightest text-5xl sm:text-7xl leading-[0.95]">
            Don&apos;t trust.{" "}
            <span className="relative brass-text">
              Recompute.
              {/* anchored to the end of the WORD, not the h1 box: the two lines differ in width, so
                  an offset from the box lands on the shorter one. Absolute so it can overhang. */}
              <span
                ref={markRef}
                aria-hidden="true"
                className="hv-markwrap pointer-events-none absolute left-full bottom-[-14px] ml-1.5 hidden aspect-square w-[clamp(150px,17vw,208px)] lg:block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mark.webp" alt="" className="hv-mark h-full w-full object-contain drop-shadow-[0_14px_34px_rgba(0,0,0,0.62)]" />
              </span>
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-gb-muted">
            You can have an agent that acts on-chain — and{" "}
            <span className="text-paper">anyone can verify what it did</span>. Not{" "}
            <span className="text-paper">&ldquo;believe my agent.&rdquo;</span> Re-derive its evidence
            yourself, in your own browser, straight off the chain.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/verify"
              className="inline-flex items-center gap-2 rounded-full bg-brass px-6 py-3 text-sm font-display font-medium text-deepink transition-colors hover:bg-brassLight"
            >
              <ShieldCheck className="h-4 w-4" /> Verify a real action
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-full border border-hairline/15 px-6 py-3 text-sm text-paper/80 transition-colors hover:border-brassLight/40 hover:text-paper"
            >
              Talk to a live agent <ArrowRight className="h-4 w-4" />
            </Link>
            <VoicePlayer label="Hear the why · 2:59" />
          </div>
        </div>

        {/* ── right: the proof, recomputed here ─────────────────────────── */}
        <div className="min-w-0 [perspective:1300px]">
          <div className="hv-card min-w-0 rounded-2xl border border-hairline/15 bg-gb-surface/60 p-5 font-mono text-[12.5px] shadow-[0_30px_50px_-24px_rgba(224,162,76,0.22),0_18px_40px_-20px_rgba(0,0,0,0.8)]">
            <div className="mb-3.5 flex items-center justify-between gap-3 border-b border-hairline/10 pb-3.5">
              <span className="text-[10px] uppercase tracking-[0.2em] text-gb-muted">Recomputing in your browser</span>
              <span
                className={
                  "rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors " +
                  (!settled
                    ? "border-hairline/15 text-gb-muted"
                    : ok
                      ? "border-[#68c08c]/45 bg-[#68c08c]/10 text-[#68c08c]"
                      : "border-[#e2574f]/45 bg-[#e2574f]/10 text-[#e2574f]")
                }
              >
                {!settled ? "checking" : ok ? "recomputed · matches" : "does not match"}
              </span>
            </div>

            <div className="mb-3.5 max-h-[116px] min-w-0 overflow-auto break-all rounded-lg border border-hairline/10 bg-black/25 p-3 leading-[1.7] text-gb-muted [overflow-wrap:anywhere]">
              {tamperAt >= 0 ? (
                <>
                  {source.slice(0, tamperAt)}
                  <span className="rounded-sm bg-[#e2574f]/20 px-0.5 text-[#e2574f]">{source[tamperAt]}</span>
                  {source.slice(tamperAt + 1)}
                </>
              ) : (
                source
              )}
            </div>

            {[
              { k: "canonicalise", v: "JCS, sorted keys", good: true },
              { k: "sha-256", v: got ? short(got) : "…", good: ok },
              { k: "expected", v: expected ? short(expected) : "…", good: true },
              { k: "match", v: !settled ? "…" : ok ? "identical" : "differs", good: ok },
            ].map((r) => (
              <div key={r.k} className="flex items-baseline justify-between gap-2.5 py-1.5">
                <span className="whitespace-nowrap text-gb-muted">
                  <span className={"mr-1.5 inline-block w-3 text-center " + (r.good ? "text-[#68c08c]" : "text-[#e2574f]")}>
                    {settled ? mk(r.good) : "·"}
                  </span>
                  {r.k}
                </span>
                <span className={"break-all text-right transition-colors " + (r.good ? "text-[#68c08c]" : "text-[#e2574f]")}>
                  {r.v}
                </span>
              </div>
            ))}

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { l: "tamper a byte", on: () => { setAuto(false); setTampered(true); } },
                { l: "restore", on: () => { setAuto(false); setTampered(false); } },
                { l: auto ? "pause loop" : "resume loop", on: () => setAuto((v) => !v) },
              ].map((b) => (
                <button
                  key={b.l}
                  onClick={b.on}
                  className="rounded-full border border-hairline/15 px-3.5 py-1.5 font-mono text-[11px] text-paper/75 transition-colors hover:border-brassLight/45 hover:text-paper"
                >
                  {b.l}
                </button>
              ))}
            </div>

            <p className="mt-3.5 border-t border-hairline/10 pt-3 text-[10.5px] leading-relaxed text-gb-muted">
              A real SHA&#8209;256, computed by your browser over the bytes above — no server is asked.
              Change one character and the digest stops matching. The full check (on-chain anchor +
              signature recovery) runs on <Link href="/verify" className="text-brassLight">/verify</Link>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
