import { chromium } from "playwright-core";
const B = process.env.BASE ?? "http://localhost:3100";
const br = await chromium.launch();
async function masoara(eticheta) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("autopas_cookies", "necesare"); } catch {} });
  const p = await ctx.newPage();
  let poze = 0, octeti = 0;
  p.on("response", async (r) => {
    if (/poze-piese/.test(r.url())) { poze++; try { octeti += Number(r.headers()["content-length"] ?? 0); } catch {} }
  });
  await p.goto(B + "/piese", { waitUntil: "load" });
  const laLoad = poze;
  await p.waitForTimeout(4000);
  console.log(`  ${eticheta.padEnd(22)} la 'load': ${String(laLoad).padStart(2)} poze · după 4s: ${String(poze).padStart(2)} poze · ${(octeti/1024).toFixed(0)} KB`);
  await ctx.close();
}
await masoara(process.argv[2] ?? "curent");
await br.close();
