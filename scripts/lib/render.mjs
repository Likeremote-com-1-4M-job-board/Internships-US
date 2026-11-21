// listings -> README.md and README-Closed.md. Pure functions: no clock, no network, no files.
// GitHub strips `style` and `class`, so the design's pills are two small committed images
// (assets/apply.svg, with our app icon on it) and an emoji (🆕); everything else is plain markdown.
// One main README (the newest rows of every category), one README per category, and README-Closed.md.

import { countryName, daysBetween, esc, escAttr, flag, number, shortDate } from "./text.mjs";
import { day, listRows, splitClosed } from "./merge.mjs";
import { CATEGORIES, categoryKey } from "./categories.mjs";
import { FAQ } from "./faq.mjs";

export const README_BUDGET = 480_000; // GitHub stops rendering a README at 500 KB
const ROW_NOTE_RESERVE = 400;
const BOARD = "https://likeremote.com";

export const trackedUrl = (config, path) => `${BOARD}${path}?utm_source=github&utm_medium=readme&utm_campaign=${config.campaign}`;
const repoUrl = (config, name = config.repo) => `https://github.com/${config.owner}/${name}`;

function location(job) {
	const f = flag(job.country_code);
	const place = job.city ?? (job.work_mode === "Remote" ? "Remote" : job.country_code ? countryName(job.country_code) : "—");
	return `${f ? `${f} ` : ""}${esc(place)}`.trim();
}

/** Long names wrap onto short lines (about 18 characters), so the column stays narrow and Role and Apply get the room. */
export function companyCell(name, width = 18) {
	const lines = [];
	for (const word of String(name).split(" ")) {
		const last = lines.at(-1);
		if (last !== undefined && (last + " " + word).length <= width) lines[lines.length - 1] = `${last} ${word}`;
		else lines.push(word);
	}
	return `**${lines.map(esc).join("<br>")}**`;
}

const UNITS = { hour: "/hr", month: "/mo", year: "/yr", week: "/wk", day: "/day" };
const k = (n) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(Math.round(n / 100) / 10).toString()}k` : Number.isInteger(n) ? String(n) : n.toFixed(2));

/** "$94,320 – $106,110" -> "$94k–106k", "$13.57 – $18.55 / hour" -> "$13.57–18.55/hr". Anything else stays as it is. */
export function shortSalary(text) {
	const m = /^(From |Up to )?([^\d\s]*?|[A-Z]{3} )(\d[\d,]*(?:\.\d+)?)(?: – \2?(\d[\d,]*(?:\.\d+)?))?(?: \/ (hour|month|year|week|day))?$/.exec(String(text).trim());
	if (!m) return text;
	const num = (v) => k(Number(v.replace(/,/g, "")));
	const cur = m[2];
	const range = m[4] ? `${num(m[3])}–${num(m[4])}` : num(m[3]);
	return `${m[1] ?? ""}${cur}${range}${m[5] ? UNITS[m[5]] : ""}`;
}

/** One table row. `today` is the feed's own date, so output depends on the data only. */
export function rowFor(config, job, today, { withApply = true } = {}) {
	const isNew = !job.locked && daysBetween(job.posted, today) <= 1;
	const apply = job.locked
		? "🔒"
		: `[<img src="assets/apply.svg" alt="Apply" width="118" height="36">](${trackedUrl(config, `/jobs/${job.slug}`)})`;
	const cells = [
		companyCell(job.company),
		`${isNew ? "🆕 " : ""}${esc(job.title)}`,
		location(job),
		job.salary ? esc(shortSalary(job.salary)) : "—",
		job.work_mode ?? "—",
		shortDate(job.posted, today),
	];
	if (withApply) cells.push(apply);
	return `| ${cells.join(" | ")} |`;
}

const HEAD = "| Company | Role | Location | Salary | Work mode | Posted | Apply |\n| --- | --- | --- | --- | --- | --- | --- |";
const HEAD_CLOSED = "| Company | Role | Location | Salary | Work mode | Posted | Closed |\n| --- | --- | --- | --- | --- | --- | --- |";
const bytes = (s) => Buffer.byteLength(s, "utf8");

/** Trim each region's rows (oldest last) so the whole file fits; small regions keep everything. */
export function allocate(regionRows, budget) {
	const totals = regionRows.map((rows) => rows.reduce((n, r) => n + bytes(r) + 1, 0));
	const order = totals.map((t, i) => i).sort((a, b) => totals[a] - totals[b]);
	let left = budget - ROW_NOTE_RESERVE * regionRows.length;
	const keep = new Array(regionRows.length).fill(0);
	order.forEach((i, n) => {
		const share = Math.floor(left / (regionRows.length - n));
		let used = 0;
		let k = 0;
		for (const r of regionRows[i]) {
			const b = bytes(r) + 1;
			if (used + b > share) break;
			used += b;
			k++;
		}
		keep[i] = k;
		left -= used;
	});
	return keep;
}

function badges(config, meta) {
	const board = trackedUrl(config, "/internships");
	const repo = `${config.owner}/${config.repo}`;
	return [
		`[![open internships](https://img.shields.io/badge/open_internships-${encodeURIComponent(number(meta.open_total)).replace(/-/g, "--")}-1d5a91)](${board})`,
		`[![updated](https://img.shields.io/github/last-commit/${repo}?label=updated&color=1f7a3a)](${board})`,
		`[![stars](https://img.shields.io/github/stars/${repo}?label=stars&color=2b3b48)](${board})`,
	].join(" ");
}

function top(config, counts) {
	const board = trackedUrl(config, "/internships");
	const ext = config.extension;
	const store = trackedExt(ext.storeUrl, config);
	return [
		`<h2 align="center"><a href="${escAttr(board)}"><img src="assets/likeremote.svg" alt="" width="56" height="56" align="absmiddle"> Likeremote</a></h2>`,
		"",
		`<h1 align="center">Find your next internship</h1>`,
		"",
		`<p align="center"><a href="${escAttr(store)}"><img src="assets/chrome-web-store.png" alt="Available in the Chrome Web Store" width="248" height="75"></a></p>`,
		"",
		`<p align="center"><a href="${escAttr(store)}"><img src="assets/extension.png" alt="${escAttr(ext.alt)}" width="720"></a></p>`,
		"",
		`<p align="center">${ext.line}<br><a href="${escAttr(board)}">likeremote.com</a></p>`,
		"",
		linkRow(config),
		"",
		...categoryBlock(counts),
	];
}

/** Open rows per category, over every region: { total, <key>: n }. Locked (closed) rows are not counted. */
export function categoryCounts(config, data) {
	const counts = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0]));
	let total = 0;
	for (const r of config.regions) {
		for (const job of data[r.key]?.open ?? []) {
			counts[categoryKey(job.category)]++;
			total++;
		}
	}
	return { total, ...counts };
}

/** "Browse N internships by category": one line per category, its emoji, its own file and its count. */
function categoryBlock(counts) {
	return [
		`## Browse ${number(counts.total)} internships by category`,
		"",
		...CATEGORIES.map((c) => `- ${c.emoji} [**${c.label}**](${c.file}) (${number(counts[c.key])})`),
		"",
	];
}

/** The short row of plain-word links under the header. */
function linkRow(config) {
	const board = (query) => escAttr(`${BOARD}/jobs?internships=1${query}&utm_source=github&utm_medium=readme&utm_campaign=${config.campaign}`);
	const store = escAttr(trackedExt(config.extension.storeUrl, config));
	const link = (href, text) => `<a href="${href}"><b>${text}</b></a>`;
	const items = [
		link(board(""), "Browse all internships"),
		link(board("&work_arrangement=Remote"), "Remote internships"),
		...(config.countries ?? []).map((c) => link(board(`&country=${c.country}`), `${c.flag} ${escAttr(c.label)}`)),
		link(escAttr(trackedUrl(config, "/sign-up")), "Get new internships by email"),
		link(store, "Add the Chrome extension"),
		link(escAttr(repoUrl(config, config.sibling.repo)), escAttr(config.sibling.label)),
	];
	return `<p align="center">${items.join(" &nbsp;·&nbsp; ")}</p>`;
}

const trackedExt = (url, config) => `${url}?utm_source=github&utm_medium=readme&utm_campaign=${config.campaign}`;

function header(config, meta, counts) {
	const sib = config.sibling;
	return [
		...top(config, counts),
		`## ${config.title}`,
		"",
		badges(config, meta),
		"",
		config.intro,
		"",
		`Press **Apply** to open the job on likeremote.com. ${sib.prompt} [${sib.repo}](${repoUrl(config, sib.repo)}).`,
		"",
		...(config.regions.length > 1
			? [config.regions.map((r) => `${r.flag} [${r.heading}](#-${r.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")})`).join(" · "), ""]
			: []),
	].join("\n");
}

function faq() {
	return ["## Frequently asked questions", "", ...FAQ.flatMap(({ q, a }) => [`<details>`, `<summary><b>${esc(q)}</b></summary>`, "", a, "", `</details>`, ""])];
}

function footer(config) {
	const lines = [
		...faq(),
		"## Legend",
		"",
		"- 🆕 posted in the last 24 hours",
		"- **Salary** is shown when the employer lists it, otherwise **—**",
		"- **Work mode**: On-site, Hybrid or Remote",
		"- **Apply** opens the job page on likeremote.com",
		"- 🔒 closed in the last 60 days; older closed rows are in [README-Closed.md](README-Closed.md)",
		"",
	];
	const issue = (t) => `${repoUrl(config)}/issues/new?template=${t}`;
	lines.push(
		"## Add a role, report a closed one, fix a row",
		"",
		`- [New internship](${issue("new-internship.yml")})`,
		`- [Closed internship](${issue("closed-internship.yml")})`,
		`- [Wrong data](${issue("wrong-data.yml")})`,
		"",
		"A maintainer who approves an issue only records the link for us. It does not edit a row: this list is rebuilt from the likeremote.com board every 6 hours, so a role shows up here once the board has it.",
		"",
		"---",
		"",
		`Built by [Likeremote](${trackedUrl(config, "")}). Company names belong to their owners and are used only to show who is hiring.`,
		"",
	);
	return lines.join("\n");
}

function sectionTop(region, rows, total) {
	const shown = rows.length;
	if (shown >= total) return `## ${region.flag} ${region.heading}\n`;
	return `## ${region.flag} ${region.heading}\n\nShowing the newest ${number(shown)} of ${number(total)}; the full list is in [listings.json](listings.json).\n`;
}

/** The whole README. `data` = { <regionKey>: { open, closed } }, `meta` = { generated_at, open_total }. */
export function renderReadme(config, data, meta) {
	const today = day(meta.generated_at);
	const perRegion = config.regions.map((r) => {
		const { recent } = splitClosed(data[r.key]?.closed ?? [], today);
		const rows = listRows(data[r.key]?.open ?? [], recent);
		return rows;
	});
	const lines = perRegion.map((rows) => rows.map((job) => rowFor(config, job, today)));
	const counts = categoryCounts(config, data);
	const fixed = bytes(header(config, meta, counts)) + bytes(footer(config)) + 2000;
	const keep = allocate(lines, README_BUDGET - fixed);
	const sections = config.regions.map((region, i) => {
		const shown = lines[i].slice(0, keep[i]);
		const top = sectionTop(region, shown, perRegion[i].length);
		if (perRegion[i].length === 0) return `${top.split("\n")[0]}\n\nThe first update runs within 6 hours.\n`;
		return `${top}\n${HEAD}\n${shown.join("\n")}\n`;
	});
	const note = config.note ? `> ${config.note}\n` : "";
	return `${header(config, meta, counts)}\n${note ? `${note}\n` : ""}${sections.join("\n")}\n${footer(config)}`;
}

/** README-Closed.md: closed rows older than the 60 days the main README keeps. */
export function renderClosed(config, data, meta) {
	const today = day(meta.generated_at);
	const head = `# Closed internships\n\nRows that closed more than 60 days ago, newest first. [Back to the list](README.md).\n`;
	const parts = [head];
	let used = bytes(head);
	for (const region of config.regions) {
		const { archived } = splitClosed(data[region.key]?.closed ?? [], today);
		if (archived.length === 0) continue;
		const rows = [];
		for (const job of archived) {
			const row = rowFor(config, { ...job, locked: true }, today).replace(/ 🔒 \|$/, ` ${shortDate(job.closed_at, today)} |`);
			used += bytes(row) + 1;
			if (used > README_BUDGET) break;
			rows.push(row);
		}
		parts.push(`## ${region.flag} ${region.heading}\n\n${HEAD_CLOSED}\n${rows.join("\n")}\n`);
	}
	if (parts.length === 1) parts.push("Nothing here yet.\n");
	return parts.join("\n");
}

/** The row of links to every category (this one in bold), under a category file's title. */
function categoryNav(current) {
	return CATEGORIES.map((c) => (c.key === current.key ? `${c.emoji} **${c.label}**` : `${c.emoji} [${c.label}](${c.file})`)).join(" · ");
}

/**
 * One category's README: the same table as the main README, only this category's rows, one section per region.
 * `data` and `meta` are the same as for `renderReadme`. Returns the file text.
 */
export function renderCategory(config, category, data, meta) {
	const today = day(meta.generated_at);
	const perRegion = config.regions.map((r) => {
		const { recent } = splitClosed(data[r.key]?.closed ?? [], today);
		return listRows(data[r.key]?.open ?? [], recent).filter((job) => categoryKey(job.category) === category.key);
	});
	const open = perRegion.reduce((n, rows) => n + rows.filter((j) => !j.locked).length, 0);
	const head = [
		`# ${category.emoji} ${category.label} ${config.title.replace(/^Internships/, "internships")}`,
		"",
		`[Back to all categories](README.md) · [${config.title} on likeremote.com](${trackedUrl(config, "/internships")}) · [${config.sibling.label}](${repoUrl(config, config.sibling.repo)})`,
		"",
		categoryNav(category),
		"",
		`${number(open)} open ${open === 1 ? "internship" : "internships"} in this category. Press **Apply** to open the job on likeremote.com. This list updates by itself every 6 hours.`,
		"",
	].join("\n");
	const tail = [
		`Not what you are looking for? [See every category](README.md), or [browse all internships on likeremote.com](${trackedUrl(config, "/internships")}).`,
		"",
	].join("\n");
	const lines = perRegion.map((rows) => rows.map((job) => rowFor(config, job, today)));
	const keep = allocate(lines, README_BUDGET - bytes(head) - bytes(tail) - 2000);
	const sections = config.regions.map((region, i) => {
		const shown = lines[i].slice(0, keep[i]);
		const total = perRegion[i].length;
		if (total === 0) return `## ${region.flag} ${region.heading}\n\nNo open internships in this category right now.\n`;
		return `${sectionTop(region, shown, total)}\n${HEAD}\n${shown.join("\n")}\n`;
	});
	return `${head}\n${sections.join("\n")}\n${tail}`;
}

/** Every category file: { "README-Software-Engineering.md": text, ... }. */
export function renderCategories(config, data, meta) {
	return Object.fromEntries(CATEGORIES.map((c) => [c.file, renderCategory(config, c, data, meta)]));
}
