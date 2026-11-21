#!/usr/bin/env node
// Rebuilds README.md, one README-<Category>.md per category, README-Closed.md and listings.json from the public feed(s).
//
//   node scripts/generate.mjs [--root DIR] [--feed-dir DIR] [--force]
//
// Needs Node 20+, no install, no keys. It fetches https://likeremote.com/feeds/internships-<region>.json
// (or reads them from --feed-dir for tests and previews), stops without writing anything when the
// rows are unchanged since the last run, and exits 1 (a red run, which e-mails the owner) on a
// broken feed instead of writing a worse list.

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FEED_BASE, loadFeed } from "./lib/feed.mjs";
import { checkNotShrunk, mergeRegion } from "./lib/merge.mjs";
import { renderCategories, renderClosed, renderReadme } from "./lib/render.mjs";

const readJson = async (path) => {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch (err) {
		if (err.code === "ENOENT") return null;
		throw err;
	}
};

async function writeAtomic(path, text) {
	const tmp = `${path}.tmp`;
	await writeFile(tmp, text);
	await rename(tmp, path);
}

/** The hash gate: the rows and counts only. `generated_at` changes hourly and is left out. */
export function hashFeeds(feeds) {
	const canon = feeds.map((f) => ({ region: f.region, count: f.count, jobs: f.jobs }));
	return createHash("sha256").update(JSON.stringify(canon)).digest("hex");
}

export async function run({ root, outDir = root, feedDir, base = FEED_BASE, force = false, allowShrink = false, fetchImpl, log = console.log } = {}) {
	const config = await readJson(join(root, "repo.config.json"));
	if (!config) throw new Error(`no repo.config.json in ${root}`);
	const prev = await readJson(join(outDir, "listings.json"));

	const feeds = [];
	for (const region of config.regions) feeds.push(await loadFeed(region.key, { base, dir: feedDir, fetchImpl }));

	const hash = hashFeeds(feeds);
	if (!force && prev?.meta?.hash === hash) {
		log("unchanged: the feed rows match the last run; nothing written");
		return { changed: false, hash };
	}

	const data = {};
	for (const feed of feeds) {
		const before = prev?.regions?.[feed.region];
		checkNotShrunk(feed.region, feed, before?.open ?? [], { allowShrink });
		data[feed.region] = mergeRegion(before, feed);
	}
	const generated_at = feeds.map((f) => f.generated_at).sort().at(-1);
	const meta = {
		repo: `${config.owner}/${config.repo}`,
		generated_at,
		hash,
		open_total: feeds.reduce((n, f) => n + f.count, 0),
		regions: Object.fromEntries(feeds.map((f) => [f.region, { feed_count: f.count, listed: data[f.region].open.length, closed: data[f.region].closed.length }])),
	};

	await mkdir(outDir, { recursive: true });
	await writeAtomic(join(outDir, "README.md"), renderReadme(config, data, meta));
	for (const [file, text] of Object.entries(renderCategories(config, data, meta))) await writeAtomic(join(outDir, file), text);
	await writeAtomic(join(outDir, "README-Closed.md"), renderClosed(config, data, meta));
	await writeAtomic(join(outDir, "listings.json"), `${JSON.stringify({ meta, regions: data }, null, "\t")}\n`);
	log(`changed: ${Object.entries(meta.regions).map(([k, v]) => `${k} ${v.listed} open / ${v.closed} closed`).join(", ")}`);
	return { changed: true, hash, meta };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
	const here = dirname(fileURLToPath(import.meta.url));
	const root = resolve(opt("--root") ?? join(here, ".."));
	run({
		root,
		feedDir: opt("--feed-dir") ?? process.env.FEED_DIR,
		base: process.env.FEED_BASE || FEED_BASE,
		force: args.includes("--force"),
		allowShrink: process.env.ALLOW_SHRINK === "1",
	}).catch((err) => {
		console.error(`error: ${err.message}`);
		process.exit(1);
	});
}
