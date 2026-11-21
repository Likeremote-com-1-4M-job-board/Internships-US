// Text safety for markdown table cells. Feed text is employer-written, so it is
// never trusted: URLs are removed (a title must not smuggle a job-system link into
// the README), markdown and HTML are escaped, whitespace is collapsed.

const URL_LIKE = /(?:https?:\/\/|www\.)\S+/gi;

/** Plain text: no control characters, no URLs, no angle brackets, one line, trimmed, at most `max` chars. */
export function plain(value, max) {
	if (typeof value !== "string") return "";
	let s = value
		.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, " ")
		.replace(URL_LIKE, " ")
		.replace(/[<>]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (s.length > max) s = `${s.slice(0, max - 1).trimEnd()}…`;
	return s;
}

/** Escape for one markdown table cell (or any inline text). */
export function esc(text) {
	return String(text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/([\\`*_[\]|~])/g, "\\$1");
}

/** Escape a value placed inside an HTML attribute in double quotes. */
export function escAttr(text) {
	return String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Two-letter country code to a flag emoji. UK is stored as `UK` on the board, the flag is GB. */
export function flag(countryCode) {
	const cc = countryCode === "UK" ? "GB" : countryCode;
	if (typeof cc !== "string" || !/^[A-Z]{2}$/.test(cc)) return "";
	return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const NAMES = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(countryCode) {
	const cc = countryCode === "UK" ? "GB" : countryCode;
	try {
		return NAMES.of(cc) ?? cc;
	} catch {
		return cc;
	}
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-20" -> "Nov 20"; a different year than `refDate` adds the year. Never reads the clock. */
export function shortDate(iso, refDate) {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
	if (!m) return "—";
	const label = `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
	const ref = /^(\d{4})/.exec(refDate ?? "");
	return ref && ref[1] !== m[1] ? `${label}, ${m[1]}` : label;
}

/** Whole days from date `a` to date `b` (both ISO, date part only). */
export function daysBetween(a, b) {
	const t = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
	return Math.round((t(b) - t(a)) / 86_400_000);
}

export const number = (n) => new Intl.NumberFormat("en-US").format(n);
