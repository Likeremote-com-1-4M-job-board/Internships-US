#!/usr/bin/env node
// The gate before a commit: listings.json parses, has the shape, every README fits GitHub's 500 KB.
import { readFileSync, readdirSync, statSync } from "node:fs";

const data = JSON.parse(readFileSync("listings.json", "utf8"));
if (!data.meta?.hash || typeof data.regions !== "object") throw new Error("listings.json: no meta.hash or regions");
for (const [key, region] of Object.entries(data.regions)) {
	if (!Array.isArray(region.open) || !Array.isArray(region.closed)) throw new Error(`listings.json: region ${key} is malformed`);
}
for (const file of readdirSync(".").filter((f) => /^README(-[A-Za-z-]+)?\.md$/.test(f))) {
	const size = statSync(file).size;
	if (size > 500_000) throw new Error(`${file} is ${size} bytes; GitHub stops rendering at 500 KB`);
}
console.log("listings.json and the READMEs are fine");
