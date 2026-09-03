import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

function packageVersionFromToml(path) {
  const source = readFileSync(path, "utf8");
  const start = source.indexOf("[package]");
  if (start === -1) throw new Error(`Kein [package]-Abschnitt in ${path} gefunden`);
  const rest = source.slice(start + "[package]".length);
  const nextSection = rest.search(/^\[/m);
  const section = nextSection === -1 ? rest : rest.slice(0, nextSection);
  const version = section?.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if (!version) throw new Error(`Keine Paketversion in ${path} gefunden`);
  return version;
}

function packageVersionFromLock(path, name) {
  const source = readFileSync(path, "utf8");
  const block = source
    .split("[[package]]")
    .find((part) => new RegExp(`^name\\s*=\\s*"${name}"$`, "m").test(part));
  const version = block?.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if (!version) throw new Error(`Keine Version für ${name} in ${path} gefunden`);
  return version;
}

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const tauriConfig = readJson("src-tauri/tauri.conf.json");
const expected = packageJson.version;
const versions = new Map([
  ["package.json", packageJson.version],
  ["package-lock.json", packageLock.version],
  ["package-lock.json packages root", packageLock.packages?.[""]?.version],
  ["src-tauri/tauri.conf.json", tauriConfig.version],
  ["src-tauri/Cargo.toml", packageVersionFromToml("src-tauri/Cargo.toml")],
  ["src-tauri/Cargo.lock", packageVersionFromLock("src-tauri/Cargo.lock", "rui")],
]);

const tagIndex = process.argv.indexOf("--tag");
if (tagIndex !== -1) {
  const tag = process.argv[tagIndex + 1];
  if (!tag) throw new Error("Nach --tag fehlt der Tagname");
  versions.set(`Tag ${tag}`, tag.replace(/^v/, ""));
}

const mismatches = [...versions].filter(([, version]) => version !== expected);
if (mismatches.length > 0) {
  for (const [source, version] of mismatches) {
    console.error(`${source}: ${version ?? "fehlt"} (erwartet ${expected})`);
  }
  process.exit(1);
}

console.log(`Alle Versionsangaben stimmen überein: ${expected}`);
