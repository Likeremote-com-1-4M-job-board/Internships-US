// Reads one public feed (https://likeremote.com/feeds/internships-<region>.json) and keeps
// ONLY the whitelisted fields. The feed is already free of employer links, but this is the
// second lock: whatever else it carries is dropped here, never copied into the repo.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { categoryKey } from "./categories.mjs";
import { plain } from "./text.mjs";

export const FEED_BASE = "https://likeremote.com/feeds/";
const JOB_URL = /^https:\/\/likeremote\.com\/jobs\/([^\s/?#"'`<>()[\]\\|*]{1,200})\/?(?:[?#].*)?$/;
const MODES = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" };
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/** One feed row to the stored shape, or null when it is not a usable likeremote.com job. */
export function cleanJob(raw) {
	if (!raw || typeof raw !== "object") return null;
	const m = JOB_URL.exec(String(raw.url ?? ""));
	const company = plain(raw.company, 80);
	const title = plain(raw.title, 140);
	const posted = String(raw.posted_at ?? "").slice(0, 10);
	if (!m || !company || !title || !ISO_DAY.test(posted)) return null;
	const cc = /^[A-Z]{2}$/.test(raw.country_code ?? "") ? raw.country_code : null;
	const job = {
		slug: m[1],
		company,
		title,
		city: plain(raw.city, 60) || null,
		country_code: cc,
		work_mode: MODES[raw.work_arrangement] ?? null,
		salary: plain(raw.salary, 40) || null,
		posted,
		category: categoryKey(raw.category),
	};
	if (raw.status === "closed" && ISO_DAY.test(String(raw.closed_at ?? ""))) job.closed_at = String(raw.closed_at).slice(0, 10);
	return job;
}

/** Whole-feed validation. Refuses (throws) rather than return a partial list. */
export function parseFeed(body, region) {
	if (!body || typeof body !== "object" || !Array.isArray(body.jobs)) throw new Error(`feed ${region}: no jobs array`);
	if (body.region !== undefined && body.region !== region) throw new Error(`feed ${region}: says region ${body.region}`);
	if (!ISO_DAY.test(String(body.generated_at ?? ""))) throw new Error(`feed ${region}: no generated_at`);
	const jobs = [];
	const seen = new Set();
	for (const raw of body.jobs) {
		const job = cleanJob(raw);
		if (job && !seen.has(job.slug)) {
			seen.add(job.slug);
			jobs.push(job);
		}
	}
	if (body.jobs.length > 0 && jobs.length < body.jobs.length / 2) {
		throw new Error(`feed ${region}: only ${jobs.length} of ${body.jobs.length} rows are usable; refusing it`);
	}
	const count = Number.isInteger(body.count) && body.count >= jobs.length ? body.count : jobs.length;
	return { region, generated_at: String(body.generated_at), count, jobs };
}

/** Download (or, with `dir`, read from disk) one region's feed. */
export async function loadFeed(region, { base = FEED_BASE, dir, fetchImpl = fetch, retries = 3 }) {
	if (dir) return parseFeed(JSON.parse(await readFile(join(dir, `internships-${region}.json`), "utf8")), region);
	const url = `${base}internships-${region}.json`;
	let last;
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			const res = await fetchImpl(url, { headers: { accept: "application/json", "user-agent": "likeremote-github-lists" }, signal: AbortSignal.timeout(30_000) });
			if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
			return parseFeed(JSON.parse(await res.text()), region);
		} catch (err) {
			last = err;
			if (attempt < retries) await new Promise((r) => setTimeout(r, 2000 * attempt));
		}
	}
	throw last;
}
