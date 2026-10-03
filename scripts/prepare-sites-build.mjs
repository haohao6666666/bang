#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {build} from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const index = path.join(dist, "client", "index.html");
const worker = path.join(root, "worker", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");

for (const file of [index, worker, hosting]) {
  if (!existsSync(file)) throw new Error("Missing Sites build input: " + file);
}

mkdirSync(path.join(dist, "server"), { recursive: true });
mkdirSync(path.join(dist, ".openai"), { recursive: true });
await build({entryPoints:[worker],outfile:path.join(dist,'server','index.js'),bundle:true,format:'esm',platform:'node',target:'es2022',external:['node:crypto','node:path','node:buffer'],plugins:[{name:'local-disk-is-unavailable-in-cloud',setup(build){build.onResolve({filter:/^node:fs\/promises$/},()=>({path:'local-fs',namespace:'cloud'}));build.onLoad({filter:/.*/,namespace:'cloud'},()=>({contents:"export default {readFile(){throw new Error('Local disk is unavailable in cloud')}}",loader:'js'}));}}]});
copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));

console.log("Prepared Sites build: dist/server/index.js and dist/.openai/hosting.json");
