import { resolve } from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const root = resolve(import.meta.dir, "..");
const navigation = `
import { useSyncExternalStore } from "react";
const subscribe = (callback) => { window.addEventListener("navigation", callback); return () => window.removeEventListener("navigation", callback); };
export function useSearchParams() { return new URLSearchParams(useSyncExternalStore(subscribe, () => location.search)); }
export function usePathname() { return useSyncExternalStore(subscribe, () => location.pathname); }
export function useRouter() { return { replace: (url) => { history.replaceState(null, "", url); window.dispatchEvent(new Event("navigation")); } }; }
`;
const link = `export default function Link({ href, children, ...props }) { return <a {...props} href={href} onClick={(event) => { event.preventDefault(); history.pushState(null, "", href); window.dispatchEvent(new Event("navigation")); }}>{children}</a>; }`;
const convex = `
import { useState, useSyncExternalStore } from "react";
import { getFunctionName } from "convex/server";
import { getOfferProgress, summarizeMaterials, needsReview } from ${JSON.stringify(resolve(root, "convex/oferte/review.ts"))};
let offer = JSON.parse(sessionStorage.getItem("preview-offer") || "null");
const listeners = new Set();
const user = { name: "Preview", email: "preview@example.test" };
window.__flowTest = { calls: [], pageRequests: [], offerCopies: 1, fail: null, seed: (value) => { offer = value; sessionStorage.setItem("preview-offer", JSON.stringify(offer)); for (const callback of listeners) callback(); } };
const subscribe = (callback) => { listeners.add(callback); return () => listeners.delete(callback); };
const publish = (patch) => { offer = { ...offer, ...patch }; sessionStorage.setItem("preview-offer", JSON.stringify(offer)); for (const callback of listeners) callback(); };
const material = { rand: 4, descriereOriginala: "Cablu electric 3x1 mm", descriereGasita: "Cablu electric 3x1 mm", cantitate: 10, unitate: "m", pretAchizitie: 10, pretVanzare: 15, manopera: 5, matchScore: 578730123456789000, requiresValidation: false };
export const useConvexAuth = () => ({ isAuthenticated: true, isLoading: false });
function summary(snapshot) {
  if (!snapshot) return null;
  const { materialeExtrase, materialePotrivite, ...rest } = snapshot;
  return { ...rest, ...getOfferProgress(snapshot), total: summarizeMaterials(materialePotrivite || []).total,
    hasExtracted: Boolean(materialeExtrase?.length), hasMatched: Boolean(materialePotrivite?.length), materialsReady: Boolean(snapshot.materialsReady) };
}
export function useQuery(reference, args) {
  const snapshot = useSyncExternalStore(subscribe, () => offer);
  if (getFunctionName(reference) === "auth:currentUser") return user;
  return args === "skip" ? undefined : args.idOferta && args.idOferta !== snapshot?._id ? null : summary(snapshot);
}
export function usePaginatedQuery(reference, args, options) {
  const snapshot = useSyncExternalStore(subscribe, () => offer);
  const [limit, setLimit] = useState(options.initialNumItems);
  const [loading, setLoading] = useState(false);
  const isMaterials = getFunctionName(reference).endsWith(":listMateriale");
  const rows = args === "skip" || !snapshot ? [] : isMaterials
    ? (snapshot.materialePotrivite || []).filter((row) => !args.pendingOnly || needsReview(row))
    : Array.from({length:window.__flowTest.offerCopies}, (_, index) => ({ _id: index ? 'offer-' + index : snapshot._id, _creationTime: snapshot._creationTime || 1784203200000, fileName: index ? 'Oferta ' + index + '.xlsx' : snapshot.excelInput.fileName, valuta: snapshot.excelMapping?.valuta, ...getOfferProgress(snapshot) }));
  return { results: rows.slice(0,limit), status: loading ? "LoadingMore" : rows.length > limit ? "CanLoadMore" : "Exhausted", loadMore: (count) => {
    if (loading) return;
    window.__flowTest.pageRequests.push({ query: isMaterials ? 'materials' : 'offers', count, pendingOnly: args.pendingOnly });
    setLoading(true);
    setTimeout(() => { setLimit((value) => value + count); setLoading(false); }, 100);
  } };
}
export const useConvex = () => ({ query: async () => summary(offer) });
const call = (reference) => async (args) => {
  const name = getFunctionName(reference).split(":")[1];
  window.__flowTest.calls.push(name);
  if (window.__flowTest.fail === name) { window.__flowTest.fail = null; throw new Error("Eroare de test. Reia procesarea."); }
  if (name === "generateUploadUrl") return location.origin + "/__upload";
  if (name === "uploadInputExcel") { publish({ _id: "preview-offer", revision: 0, excelInput: {fileName: args.fileName}, excelMapping: undefined, materialeExtrase: undefined, materialePotrivite: undefined, excelOutput: undefined, downloadUrl: null }); return "preview-offer"; }
  if (name === "analizaExcelInput") publish({ excelMapping: { valuta: "RON" }, revision: offer.revision + 1 });
  if (name === "extrageMateriale") publish({ materialeExtrase: [material], revision: offer.revision + 1 });
  if (name === "prepareMaterialPagination") publish({ materialsReady: true });
  if (name === "cautaSiPopuleazaPreturi") publish({ materialePotrivite: [material, { ...material, rand: 5, descriereOriginala: "Tub metalic 20 mm cu accesorii pentru montaj aparent", descriereGasita: "Tub PVC 20 mm", requiresValidation: true, matchScore: 1234 }], revision: offer.revision + 1 });
  if (name === "valideazaMaterial") publish({ materialePotrivite: offer.materialePotrivite.map((row) => row.rand === args.rand ? { ...row, cantitate: args.cantitate, pretAchizitie: args.pretAchizitie, pretVanzare: args.pretVanzare, manopera: args.manopera, validated: true } : row), revision: offer.revision + 1, excelOutput: undefined, downloadUrl: null });
  if (name === "genereazaExcelOutput") publish({ excelOutput: { fileName: "Oferta.xlsx" }, downloadUrl: "/__output.xlsx" });
};
export const useAction = call;
export const useMutation = call;
`;

const pagePath = resolve(root, "src/app/(main)/generare-ai/page.tsx");
const convexPath = Bun.resolveSync("convex/react", root);
const navigationPath = Bun.resolveSync("next/navigation", root);
const linkPath = Bun.resolveSync("next/link", root);
const bundle = await Bun.build({
  entrypoints: [pagePath],
  target: "browser",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{
    name: "isolated-preview",
    setup(builder) {
      builder.onResolve({ filter: /^(convex\/react|next\/navigation|next\/link)$/ }, ({ path }) => ({ path: path === "convex/react" ? convexPath : path === "next/link" ? linkPath : navigationPath }));
      builder.onLoad({ filter: /.*/ }, async ({ path }) => {
        if (path === convexPath) return { contents: convex, loader: "tsx", resolveDir: root };
        if (path === navigationPath) return { contents: navigation, loader: "tsx" };
        if (path === linkPath) return { contents: link, loader: "tsx" };
        if (path === pagePath) return {
          contents: await Bun.file(pagePath).text() + `
import { createRoot } from "react-dom/client";
import { usePathname } from "next/navigation";
import OfertePage from "../oferte/page";
function Preview() {
  const pathname = usePathname();
  if (pathname === "/oferte") return <OfertePage />;
  if (pathname.startsWith("/oferte/")) return <OfertaFlow key={pathname} detail idOferta={pathname.split("/")[2]} />;
  return <GenerareAIPage />;
}
createRoot(document.getElementById("root")).render(<Preview />);`,
          loader: "tsx",
        };
      });
    },
  }],
});
if (!bundle.success) throw new AggregateError(bundle.logs, "Preview bundle failed");
const stylesheet = await postcss([tailwindcss({ base: root })]).process(await Bun.file(resolve(root, "src/app/globals.css")).text(), {
  from: resolve(root, "src/app/globals.css"),
});
const script = await bundle.outputs[0].text();
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PREVIEW_PORT || 3418),
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/bundle.js") return new Response(script, { headers: { "Content-Type": "text/javascript" } });
    if (path === "/style.css") return new Response(stylesheet.css, { headers: { "Content-Type": "text/css" } });
    if (path === "/__upload") return Response.json({ storageId: "preview-storage" });
    return new Response('<!doctype html><html lang="ro"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><style>:root{--font-geist-sans:Arial,sans-serif}body{margin:0;background:var(--background);color:var(--foreground)}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>', {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
});
console.log(`Isolated UI preview (mock services): ${server.url}`);