import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, copyFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "src-tauri", "icons");
const workDir = mkdtempSync(join(tmpdir(), "rui-icons-"));
const tauriCli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");

function render(source, output, sizes = []) {
  const args = [tauriCli, "icon", source, "-o", output];
  for (const size of sizes) args.push("-p", String(size));

  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`tauri icon failed for ${source} (exit ${result.status})`);
  }
}

function writeIco(entries, output) {
  const headerSize = 6 + entries.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let imageOffset = headerSize;
  entries.forEach(({ size, data }, index) => {
    const offset = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, offset);
    header.writeUInt8(size === 256 ? 0 : size, offset + 1);
    header.writeUInt8(0, offset + 2);
    header.writeUInt8(0, offset + 3);
    header.writeUInt16LE(1, offset + 4);
    header.writeUInt16LE(32, offset + 6);
    header.writeUInt32LE(data.length, offset + 8);
    header.writeUInt32LE(imageOffset, offset + 12);
    imageOffset += data.length;
  });

  writeFileSync(output, Buffer.concat([header, ...entries.map(({ data }) => data)]));
}

try {
  mkdirSync(iconsDir, { recursive: true });

  console.log("==> Rendering Tauri bundle assets");
  render("assets/logo/rui.svg", iconsDir);
  rmSync(join(iconsDir, "android"), { recursive: true, force: true });
  rmSync(join(iconsDir, "ios"), { recursive: true, force: true });

  console.log("==> Rendering size-specific Windows icons");
  const sizeGroups = [
    { source: "assets/logo/rui-tiny.svg", sizes: [16] },
    { source: "assets/logo/rui-small.svg", sizes: [24, 32] },
    { source: "assets/logo/rui.svg", sizes: [48, 64, 256] },
  ];
  for (const { source, sizes } of sizeGroups) render(source, workDir, sizes);

  copyFileSync(join(workDir, "32x32.png"), join(iconsDir, "32x32.png"));
  copyFileSync(join(workDir, "64x64.png"), join(iconsDir, "64x64.png"));

  const icoSizes = [16, 24, 32, 48, 64, 256];
  const entries = icoSizes.map((size) => ({
    size,
    data: readFileSync(join(workDir, `${size}x${size}.png`)),
  }));
  writeIco(entries, join(iconsDir, "icon.ico"));

  console.log(`==> Done. icon.ico contains: ${icoSizes.join(", ")} px`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
