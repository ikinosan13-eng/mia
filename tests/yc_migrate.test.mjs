import assert from "node:assert";
const { runBatch, privatIsPublic } = await import("./core.mjs");
const jobs = Array.from({ length: 45 }, (_, i) => ({ src: "originals", path: `p${i}.jpg`, dst: `originals/p${i}.jpg`, bucket: "privat" }));
const dst = new Map([["originals/p1.jpg", 10], ["originals/p2.jpg", 9]]); const copied = [];
const io = { srcSize: async j => j.path == "p3.jpg" ? null : 10, dstSize: async j => dst.get(j.dst) ?? null,
  copy: async j => { if (j.path == "p4.jpg") throw new Error("boom"); copied.push(j.dst); dst.set(j.dst, 10); } };
let r = await runBatch(jobs, 0, 20, io); assert.deepEqual([r.copied, r.skipped, r.failed.length, r.remaining, r.next], [18, 1, 1, 25, 20]);
r = await runBatch(jobs, 0, 20, io); assert.deepEqual([r.copied, r.skipped, r.failed.length], [1, 18, 1]); // повтор: всё пропущено, кроме упавшего p4 и p3 (нет размера → копируем)
r = await runBatch(jobs, 40, 20, io); assert.deepEqual([r.copied, r.remaining, r.next], [5, 0, 45]);
assert.equal(await privatIsPublic(async () => ({ status: 200, body: null })), true);
assert.equal(await privatIsPublic(async () => ({ status: 403, body: null })), false);
console.log("core tests OK");
