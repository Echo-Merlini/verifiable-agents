// _pin_sub.js — pin a per-subdomain or root CID from inside the container
// Usage: node /app/_pin_sub.js <sub|root> <pin-name>
// Env:   JWT=<pinata-jwt>
const fs = require("fs"), path = require("path"), https = require("https");

const jwt  = process.env.JWT;
const sub  = process.argv[2];
const name = process.argv[3];
const OUT  = "/app/out";
const SHARED = ["_next", "fonts", "logos", "favicon.svg"];

if (!jwt)  { process.stderr.write("JWT env var missing\n"); process.exit(1); }
if (!sub)  { process.stderr.write("Usage: node _pin_sub.js <sub|root> <name>\n"); process.exit(1); }

const allFiles = [];

function addPath(srcPath, relPath) {
  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    for (const e of fs.readdirSync(srcPath)) {
      if (e.startsWith(".")) continue;
      addPath(path.join(srcPath, e), path.join(relPath, e));
    }
  } else {
    allFiles.push({ full: srcPath, rel: relPath });
  }
}

if (sub === "root") {
  addPath(OUT, name);
} else {
  for (const asset of SHARED) {
    const p = path.join(OUT, asset);
    if (fs.existsSync(p)) addPath(p, path.join(name, asset));
  }
  const indexSrc = fs.existsSync(path.join(OUT, sub, "index.html"))
    ? path.join(OUT, sub, "index.html")
    : path.join(OUT, "index.html");
  allFiles.push({ full: indexSrc, rel: path.join(name, "index.html") });
}

const boundary = "----FB" + Math.random().toString(36).slice(2), CRLF = "\r\n";
let body = Buffer.alloc(0);
for (const { full, rel } of allFiles) {
  body = Buffer.concat([
    body,
    Buffer.from("--" + boundary + CRLF + "Content-Disposition: form-data; name=\"file\"; filename=\"" + rel + "\"" + CRLF + "Content-Type: application/octet-stream" + CRLF + CRLF),
    fs.readFileSync(full),
    Buffer.from(CRLF),
  ]);
}
body = Buffer.concat([
  body,
  Buffer.from("--" + boundary + CRLF + "Content-Disposition: form-data; name=\"pinataMetadata\"" + CRLF + CRLF + JSON.stringify({ name }) + CRLF),
  Buffer.from("--" + boundary + CRLF + "Content-Disposition: form-data; name=\"pinataOptions\"" + CRLF + CRLF + JSON.stringify({ cidVersion: 1 }) + CRLF),
  Buffer.from("--" + boundary + "--" + CRLF),
]);

const req = https.request({
  hostname: "api.pinata.cloud",
  path: "/pinning/pinFileToIPFS",
  method: "POST",
  headers: {
    Authorization: "Bearer " + jwt,
    "Content-Type": "multipart/form-data; boundary=" + boundary,
    "Content-Length": body.length,
  },
}, (res) => {
  let d = "";
  res.on("data", c => d += c);
  res.on("end", () => {
    try {
      const r = JSON.parse(d);
      if (r.IpfsHash) { console.log(r.IpfsHash); }
      else { process.stderr.write("Pinata error: " + d + "\n"); process.exit(1); }
    } catch (e) { process.stderr.write("Parse error: " + d + "\n"); process.exit(1); }
  });
});
req.on("error", e => { process.stderr.write("Network error: " + e.message + "\n"); process.exit(1); });
req.write(body);
req.end();
