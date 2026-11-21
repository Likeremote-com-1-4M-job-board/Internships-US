// The internship categories: the five biggest groups in our data, named the way Simplify names theirs, and Other.
// The keys are the feed's `category` values (`packages/contracts/src/internshipCategories.ts`; a test reads that
// file and fails if this list and the contract differ). The order is the order of the "Browse by category" block.
// `file` is the group's own README in each repo. Counts and the choice: docs/research/internship-groups-2026-11-21.md.

export const CATEGORIES = [
	{ key: "software-engineering", emoji: "💻", label: "Software Engineering", file: "README-Software-Engineering.md" },
	{ key: "operations", emoji: "⚙️", label: "Operations & Management", file: "README-Operations-Management.md" },
	{ key: "marketing", emoji: "📣", label: "Marketing & Content", file: "README-Marketing-Content.md" },
	{ key: "hardware-engineering", emoji: "🔧", label: "Hardware Engineering", file: "README-Hardware-Engineering.md" },
	{ key: "finance", emoji: "💰", label: "Finance & Accounting", file: "README-Finance-Accounting.md" },
	{ key: "other", emoji: "🗂", label: "Other", file: "README-Other.md" },
];

export const CATEGORY_KEYS = new Set(CATEGORIES.map((c) => c.key));

/** A feed value to a known key; anything else (a new key, a typo, nothing) is "other". */
export const categoryKey = (value) => (CATEGORY_KEYS.has(value) ? value : "other");
