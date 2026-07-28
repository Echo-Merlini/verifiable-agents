// Browser dcap-qvl (core) — recompute the TDX quote's hardware root of trust, client-side.
// Verifies: the embedded PCK cert chain (leaf ← PCK Platform CA ← Intel SGX Root CA, root PINNED),
// the QE report signature (PCK leaf), the attestation-key↔QE binding (report_data), and the TD quote
// signature (attestation key). Together: the quote was produced by a genuine Intel-provisioned TDX part.
// TCB-status/CRL freshness (Intel PCS collateral) is out of scope here — that stays a documented residual.

const INTEL_SGX_ROOT_SHA256 = "44a0196b2b99f889b8e149e95b807a350e7424964399e885a7cbb8ccfab674d3";

const hexToBytes = (h: string) => { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; };
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const toHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

export type DcapResult = { ok: boolean; chain: boolean; rootPinned: boolean; qeSig: boolean; attBinding: boolean; quoteSig: boolean; rootFp: string };

export async function verifyDcapQuote(quoteHex: string): Promise<DcapResult> {
  await import("reflect-metadata");
  const x509 = await import("@peculiar/x509");
  x509.cryptoProvider.set(crypto as unknown as Crypto);
  const raw = hexToBytes(quoteHex);
  const sub = (a: number, b: number) => raw.subarray(a, b);
  const latin1 = Array.from(raw).map((c) => String.fromCharCode(c)).join("");
  const pems = [...latin1.matchAll(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)].map((m) => m[0]);
  const [leaf, inter, root] = pems.map((p) => new x509.X509Certificate(p));

  const chain = (await leaf.verify({ publicKey: inter.publicKey })) && (await inter.verify({ publicKey: root.publicKey })) && (await root.verify({ publicKey: root.publicKey }));
  const rootFp = toHex(await crypto.subtle.digest("SHA-256", root.rawData));
  const rootPinned = rootFp === INTEL_SGX_ROOT_SHA256;

  const leafKey = await crypto.subtle.importKey("spki", leaf.publicKey.rawData, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const qeSig = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, leafKey, sub(1154, 1218) as BufferSource, sub(770, 1154) as BufferSource);

  const authLen = new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getUint16(1218, true);
  const bind = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array([...sub(700, 764), ...sub(1220, 1220 + authLen)]) as BufferSource));
  const rd = sub(770 + 320, 770 + 320 + 32);   // QE report_data[0:32]
  const attBinding = bind.length === 32 && bind.every((v, i) => v === rd[i]);

  const attKey = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: b64u(sub(700, 732)), y: b64u(sub(732, 764)) }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const quoteSig = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, attKey, sub(636, 700) as BufferSource, sub(0, 632) as BufferSource);

  return { ok: chain && rootPinned && qeSig && attBinding && quoteSig, chain, rootPinned, qeSig, attBinding, quoteSig, rootFp };
}
