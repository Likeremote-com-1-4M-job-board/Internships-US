#!/usr/bin/env node
// Runs when a maintainer adds the `approved` label to an issue. It records the submitted link in
// submissions/approved.jsonl so likeremote.com can pick it up. It never touches README.md,
// README-Closed.md or listings.json: this list is rebuilt from the board, not edited by hand.
// The issue text is read from the event file GitHub hands us, never put into a shell command.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

const KINDS = ["new-internship", "closed-internship", "wrong-data"];

/** The first https link in the issue body (forms render the answers under ### headings). */
export function linkFrom(body) {
	const m = /https:\/\/[^\s<>)"'\]]{4,500}/.exec(String(body ?? ""));
	if (!m) return null;
	try {
		const u = new URL(m[0]);
		u.hash = "";
		return u.protocol === "https:" && u.hostname.includes(".") ? u.toString() : null;
	} catch {
		return null;
	}
}

export function recordFor(event) {
	const issue = event?.issue;
	if (!issue || event.action !== "labeled" || event.label?.name !== "approved") return null;
	const labels = (issue.labels ?? []).map((l) => l.name);
	const titleKind = { "new internship:": "new-internship", "closed internship:": "closed-internship", "wrong data:": "wrong-data" };
	const byTitle = Object.entries(titleKind).find(([prefix]) => String(issue.title ?? "").toLowerCase().startsWith(prefix))?.[1];
	const kind = KINDS.find((k) => labels.includes(k)) ?? byTitle;
	const url = linkFrom(issue.body);
	if (!kind || !url) return null;
	return { issue: issue.number, kind, url, approved_at: new Date().toISOString().slice(0, 10) };
}

if (process.argv[1]?.endsWith("record-submission.mjs") && process.env.GITHUB_EVENT_PATH) {
	const record = recordFor(JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")));
	const FILE = "submissions/approved.jsonl";
	const seen = record && existsSync(FILE) && readFileSync(FILE, "utf8").split("\n").some((l) => l && JSON.parse(l).issue === record.issue);
	if (!record) {
		console.log("nothing to record: not an approved form issue with a link");
	} else if (seen) {
		console.log(`issue #${record.issue} is already recorded`);
	} else {
		mkdirSync("submissions", { recursive: true });
		appendFileSync(FILE, `${JSON.stringify(record)}\n`);
		console.log(`recorded issue #${record.issue} (${record.kind})`);
	}
}
