// Which rows are open, which closed. The feed is the NEWEST rows only (at most 1,000 of
// the last 60 days), so "missing from the feed" is NOT "closed": the oldest rows fall off
// the bottom every day. A row counts as closed only when it was open last time, is
// missing now, and sits INSIDE the window the feed still covers (posted after the feed's
// oldest row, and within the 60 days). Anything else that vanished is dropped quietly.

import { daysBetween } from "./text.mjs";

export const WINDOW_DAYS = 60;
export const KEEP_LOCKED_DAYS = 60; // closed rows stay in the README this long
export const CLOSED_CAP = 3000; // closed history kept per region

export const day = (iso) => String(iso).slice(0, 10);

/** Throws if the new list looks like a broken feed rather than a real change. */
export function checkNotShrunk(region, feed, prevOpen, { allowShrink = false } = {}) {
	if (allowShrink || prevOpen.length < 20) return;
	if (feed.jobs.length === 0) throw new Error(`${region}: the feed is empty but ${prevOpen.length} rows are listed; refusing`);
	if (feed.jobs.length < prevOpen.length * 0.5) {
		throw new Error(`${region}: the feed shrank from ${prevOpen.length} to ${feed.jobs.length} rows; refusing (set ALLOW_SHRINK=1 to accept)`);
	}
}

export function mergeRegion(prev, feed) {
	const today = day(feed.generated_at);
	const prevOpen = prev?.open ?? [];
	const prevClosed = prev?.closed ?? [];
	const open = feed.jobs.filter((j) => !j.closed_at);
	const listedClosed = feed.jobs.filter((j) => j.closed_at);
	const openKeys = new Set(open.map((j) => j.slug));
	const truncated = feed.count > feed.jobs.length;
	const oldest = open.reduce((min, j) => (j.posted < min ? j.posted : min), "9999-12-31");

	const newlyClosed = prevOpen
		.filter((j) => !openKeys.has(j.slug))
		.filter((j) => daysBetween(j.posted, today) <= WINDOW_DAYS - 2)
		.filter((j) => !truncated || j.posted > oldest)
		.map((j) => ({ ...j, closed_at: today }));

	const byKey = new Map();
	for (const j of [...listedClosed, ...newlyClosed, ...prevClosed]) {
		if (!openKeys.has(j.slug) && !byKey.has(j.slug)) byKey.set(j.slug, j);
	}
	const closed = [...byKey.values()].sort((a, b) => (a.closed_at < b.closed_at ? 1 : a.closed_at > b.closed_at ? -1 : 0)).slice(0, CLOSED_CAP);
	return { open, closed };
}

/** Closed rows young enough to stay (with the lock) in the README, and the rest. */
export function splitClosed(closed, today) {
	const recent = [];
	const archived = [];
	for (const j of closed) (daysBetween(j.closed_at, today) <= KEEP_LOCKED_DAYS ? recent : archived).push(j);
	return { recent, archived };
}

/** Open rows (feed order, newest first) and recent closed rows, by posted date; open first on ties. */
export function listRows(open, recentClosed) {
	const rows = [...open.map((j) => ({ ...j, locked: false })), ...recentClosed.map((j) => ({ ...j, locked: true }))];
	return rows
		.map((r, i) => ({ r, i }))
		.sort((a, b) => (a.r.posted < b.r.posted ? 1 : a.r.posted > b.r.posted ? -1 : a.r.locked - b.r.locked || a.i - b.i))
		.map((x) => x.r);
}
