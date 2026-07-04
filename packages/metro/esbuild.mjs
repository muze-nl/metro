import { build } from "esbuild";

build({
	entryPoints: ["src/browser.mjs"],
	bundle: true,
	minify: true,
	sourcemap: false,
	outfile: "dist/browser.js"
},{
	entryPoints: ["src/everything.mjs"],
	bundle: true,
	minify: true,
	sourcemap: false,
	outfile: "dist/everything.js"
},{
	entryPoints: ["src/browser.mjs"],
	bundle: true,
	minify: false,
	sourcemap: true,
	outfile: "dist/browser-dev.js"
},{
	entryPoints: ["src/everything.mjs"],
	bundle: true,
	minify: false,
	sourcemap: true,
	outfile: "dist/everything-dev.js"
});