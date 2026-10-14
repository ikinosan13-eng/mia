import puppeteer from "puppeteer-core"; import { AwsClient } from "aws4fetch"; import { readFileSync } from "fs";
const yc = new AwsClient({ accessKeyId: process.env.YC_KEY_ID, secretAccessKey: process.env.YC_SECRET, service: "s3", region: "ru-central1" });
const MAP = { originals: { bucket: "privat", prefix: "originals/", pub: false }, previews: { bucket: "mia-previews", prefix: "", pub: true }, media: { bucket: "mia-previews", prefix: "media/", pub: true } };
const EXP = { put: 600, get: 600, delete: 300 };
async function ycUpload({ action, items }) { const urls = []; for (const it of items) { const m = MAP[it.bucket]; const key = (m.prefix + it.path).split("/").map(encodeURIComponent).join("/"); const headers = {};
  if (action == "put") { headers["content-type"] = it.contentType || "application/octet-stream"; if (m.pub) headers["cache-control"] = "public,max-age=31536000,immutable"; }
  const s = await yc.sign(`https://storage.yandexcloud.net/${m.bucket}/${key}?X-Amz-Expires=${EXP[action]}`, { method: action.toUpperCase(), headers, aws: { signQuery: true } }); urls.push({ url: s.url, headers }); } return { urls }; }
// helper из admin.js (вырезаем как есть)
const src = readFileSync("/workspace/mia/admin.js", "utf8"); const helper = src.slice(src.indexOf("const ycSign"), src.indexOf("\n});\n", src.indexOf("const ys = bucket")) + 5);
const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const p = await b.newPage(); const errs = []; p.on("console", m => m.type() == "error" && errs.push(m.text()));
await p.setRequestInterception(true);
p.on("request", r => r.url() == "https://ikinosan13-eng.github.io/mia/__yc_mock.html" ? r.respond({ status: 200, contentType: "text/html", body: "<!doctype html><title>mock</title>" }) : r.continue());
await p.exposeFunction("__ycUpload", ycUpload);
await p.goto("https://ikinosan13-eng.github.io/mia/__yc_mock.html");
const out = await p.evaluate(async helper => {
  const sbRemoved = [];
  window.Mia = { sb: { functions: { invoke: async (n, { body }) => ({ data: await window.__ycUpload(body), error: null }) }, storage: { from: b => ({ remove: async ps => (sbRemoved.push(b + ":" + ps), {}), download: async () => ({ data: null, error: new Error("sb") }) }) } } };
  const M = () => window.Mia; eval(helper + "; window.ys = ys;");
  const res = {}; const blob = new Blob([new Uint8Array([255, 216, 255, 217, 1, 2, 3])], { type: "image/jpeg" });
  for (const [bk, path] of [["originals", "_mock/a.jpg"], ["previews", "_mock/t.jpg"], ["media", "_mock/x.mp3"]]) {
    const up = await ys(bk).upload(path, blob, { contentType: bk == "media" ? "audio/mpeg" : "image/jpeg" });
    const dl = await ys(bk).download(path);
    const rm = await ys(bk).remove([path]);
    const dl2 = await ys(bk).download(path);
    res[bk] = { upload: up.error ? String(up.error) : "ok", downloadBytes: dl.data?.size ?? String(dl.error), remove: rm.error ? String(rm.error) : "ok", afterRemove: dl2.data ? "still there" : "gone" };
  }
  res.sbLegacyRemoveCalls = sbRemoved; return res;
}, helper);
console.log(JSON.stringify(out, null, 1)); console.log("console errors", errs);
await b.close();
