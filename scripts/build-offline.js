import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const root = "dist";
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((f) =>
      f.isDirectory()
        ? files(path.join(dir, f.name))
        : [path.join(dir, f.name)],
    );
}
const assets = files(root)
  .filter(
    (f) =>
      !path.basename(f).startsWith("_") &&
      !f.endsWith("sw.js") &&
      !f.endsWith(".map"),
  )
  .sort();
const version = createHash("sha256");
version.update(fs.readFileSync(new URL(import.meta.url)));
for (const file of assets) version.update(file).update(fs.readFileSync(file));
const cache = `pearl-${version.digest("hex").slice(0, 16)}`;
const urls = assets.map(
  (f) => "/" + path.relative(root, f).split(path.sep).join("/"),
);
fs.writeFileSync(
  path.join(root, "sw.js"),
  `// Generated from the complete production asset list. Do not edit.
const CACHE=${JSON.stringify(cache)};
const ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  // No skipWaiting: a new release must not replace an active reading session.
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('pearl-')&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  const supported=['/','/play','/card','/words','/necklace'].includes(url.pathname);
  if(event.request.mode==='navigate'&&supported){
    // Pages redirects /index.html to /. Navigation requests can reject a cached
    // redirected response, so return a fresh response with the same body/headers.
    event.respondWith(caches.open(CACHE).then(cache=>cache.match('/index.html')).then(hit=>hit?new Response(hit.body,{status:hit.status,statusText:hit.statusText,headers:hit.headers}):fetch(event.request)));
    return;
  }
  if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname)).then(hit=>hit||fetch(event.request)));
});
`,
);
console.log(`Offline bundle ${cache}: ${urls.length} precached assets.`);
