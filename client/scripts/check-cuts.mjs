#!/usr/bin/env node
// 裁剪断言检查器（v2）：源码断言 + UI 文案断言 + 产物断言
// 用法: node check-cuts.mjs <A_DIR> [--artifacts]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const A_DIR = process.argv[2];
if (!A_DIR) { console.error("用法: node check-cuts.mjs <A_DIR> [--artifacts]"); process.exit(2); }
const manifest = JSON.parse(fs.readFileSync(new URL("./cut-manifest.json", import.meta.url), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(A_DIR, "client", "package.json"), "utf8"));
const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

let pass = 0, fail = 0, warn = 0;
const failList = [], warnList = [];
function report(ok, id, msg) {
  if (ok) { pass++; return; }
  fail++; failList.push(id + " :: " + msg);
}
function warnReport(id, msg) { warn++; warnList.push(id + " :: " + msg); }

// 1) 文件缺席断言
for (const rel of manifest.requireAbsentFiles) {
  report(!fs.existsSync(path.join(A_DIR, rel)), "absent:" + rel, "文件被重新引入");
}
const lit = (a) => (a && a.expectParts ? a.expectParts.join("") : a && a.expect);
// 2) package / 许可断言
for (const a of manifest.asserts) {
  if (a.kind === "pkgDepAbsent") report(!(a.target in allDeps), a.id, "依赖被重新引入: " + a.target);
  if (a.kind === "pkgBuildKeyAbsent") report(!(pkg.build && a.target in pkg.build), a.id, "build." + a.target + " 被重新引入");
  if (a.kind === "pkgBuildEquals") report(pkg.build && pkg.build[a.target] === a.expect, a.id, "期望 " + a.expect + " 实际 " + (pkg.build ? pkg.build[a.target] : "undefined"));
  if (a.kind === "pkgBuildContains") report(!!(pkg.build && String(pkg.build[a.target] || "").includes(lit(a))), a.id, "期望包含 " + a.expect);
  if (a.kind === "fileContains") {
    const p = path.join(A_DIR, a.target);
    report(fs.existsSync(p) && fs.readFileSync(p, "utf8").includes(lit(a)), a.id, "缺少 " + lit(a) + " (" + a.target + ")");
  }
  if (a.kind === "fileNotContains") {
    const p = path.join(A_DIR, a.target);
    report(fs.existsSync(p) && !fs.readFileSync(p, "utf8").includes(lit(a)), a.id, "不应出现 " + lit(a) + " (" + a.target + ")");
  }
}
// 3) 警告断言（不计阻断）
for (const w of manifest.warns) {
  const p = path.join(A_DIR, w.target);
  const ok = fs.existsSync(p) && fs.readFileSync(p, "utf8").includes(w.expect);
  if (!ok) warnReport(w.id, w.note || "缺少 " + w.expect);
}
// 4) UI 文案断言
if (manifest.forbidTextInFiles) {
  const ft = manifest.forbidTextInFiles;
  const hits = [];
  (function walkSrc(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walkSrc(p);
      else if (ft.extensions.includes(path.extname(e.name))) {
        const t = fs.readFileSync(p, "utf8");
        for (const pat of ft.patterns) if (t.includes(pat)) hits.push(path.relative(A_DIR, p) + " :: " + pat);
      }
    }
  })(path.join(A_DIR, ft.root));
  report(hits.length === 0, "ui.forbidden-text", "文案回流：" + hits.slice(0, 5).join(" | "));
}
// 4b) 仓库级品牌/归属禁用串扫描（仅跟踪文件，避免未跟踪脚本/构建产物误报）
if (manifest.repoScan) {
  const rs = manifest.repoScan;
  const allow = new Set((rs.allowFiles || []).map((x) => path.normalize(x)));
  const hits = [];
  const tracked = execFileSync("git", ["-C", A_DIR, "ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\0").filter(Boolean);
  for (const rel of tracked) {
    const norm = path.normalize(rel);
    if (allow.has(norm)) continue;
    const ext = path.extname(norm).toLowerCase();
    if ([".exe",".dll",".so",".dylib",".pyc",".png",".jpg",".jpeg",".gif",".webp",".ico",".pdf",".zip",".msi",".whl",".nupkg",".node",".bin",".pdb",".map",".lock"].includes(ext)) continue;
    let t = "";
    try { t = fs.readFileSync(path.join(A_DIR, rel), "utf8"); } catch { continue; }
    for (const pdef of rs.patterns) { const pat = Array.isArray(pdef) ? pdef.join("") : pdef; if (t.includes(pat)) hits.push(rel + " :: " + pat); }
  }
  report(hits.length === 0, "repo.forbidden-brand", "禁用串残留 " + hits.length + " 处：" + hits.slice(0, 8).join(" | "));
}

// 5) 产物断言（--artifacts）
const joinForbid = (x) => (Array.isArray(x) ? x.join("") : x);
if (process.argv.includes("--artifacts")) {
  const ac = manifest.artifactChecks;
  const dir = path.join(A_DIR, ac.dir);
  const expectProduct = pkg.build.productName;
  // MSI 受 WiX 代码页 1252 限制，使用 ASCII 产品名；NSIS/zip 仍用中文品牌。
  const expectProductFor = (file) => (String(file).toLowerCase().endsWith(".msi") ? (ac.msiProductName || expectProduct) : expectProduct);
  if (!fs.existsSync(dir)) {
    warnReport("artifacts.dir", "目录不存在，跳过：" + dir);
  } else {
    const arts = fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isFile() && /\.(exe|msi|zip)$/i.test(e.name))
      .map(e => path.join(dir, e.name));
    if (!arts.length) warnReport("artifacts.empty", "无顶层安装包（exe/msi/zip）");
    const bins = arts.filter(p => /\.(exe|msi)$/i.test(p));
    for (const p of arts) {
      const rel = path.relative(A_DIR, p).replace(/\\/g, "/");
      const buf = fs.readFileSync(p);
      for (const sdef of ac.forbidStrings) {
        const s = joinForbid(sdef);
        const hit = buf.includes(Buffer.from(s, "utf8")) || buf.includes(Buffer.from(s, "utf16le"));
        report(!hit, "artifact.string:" + rel, "产物含禁用串 " + s);
      }
    }
    if (bins.length) {
      const ps = ["$ErrorActionPreference='Stop'", "$out=@()"];
      for (const p of bins) {
        const name = path.basename(p);
        const q = p.replace(/'/g, "''");
        if (p.toLowerCase().endsWith(".msi")) {
          ps.push("$p='" + q + "'; try { $i=New-Object -ComObject WindowsInstaller.Installer; $db=$i.GetType().InvokeMember('OpenDatabase','InvokeMethod',$null,$i,@($p,0)); $v=$db.GetType().InvokeMember('OpenView','InvokeMethod',$null,$db,@('SELECT Property,Value FROM Property')); $v.GetType().InvokeMember('Execute','InvokeMethod',$null,$v,$null); while ($r=$v.GetType().InvokeMember('Fetch','InvokeMethod',$null,$v,$null)) { $out += [pscustomobject]@{file='" + name + "';k=$r.StringData(1);v=$r.StringData(2)} } } catch { $out += [pscustomobject]@{file='" + name + "';k='ERROR';v=$_.Exception.Message} }");
        } else {
          ps.push("$p='" + q + "'; $vi=(Get-Item $p).VersionInfo; $out += [pscustomobject]@{file='" + name + "';k='ProductName';v=$vi.ProductName}; $out += [pscustomobject]@{file='" + name + "';k='CompanyName';v=$vi.CompanyName}; $out += [pscustomobject]@{file='" + name + "';k='LegalCopyright';v=$vi.LegalCopyright}");
        }
      }
      ps.push("$out | ConvertTo-Json -Compress");
      try {
        const raw = execFileSync("pwsh", ["-NoProfile", "-Command", ps.join("; ")], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
        const info = JSON.parse(raw.trim() || "[]");
        const arr = Array.isArray(info) ? info : [info];
        for (const it of arr) {
          if (it.k === "ERROR") { warnReport("artifacts." + it.file, "属性读取失败：" + it.v); continue; }
          if (it.k === "ProductName") report(it.v === expectProductFor(it.file), "artifact.productName:" + it.file, "期望 " + expectProductFor(it.file) + " 实际 " + it.v);
          if (it.k === "Manufacturer" || it.k === "CompanyName") report(!ac.forbidAuthorExact.includes(it.v), "artifact.author:" + it.file, "作者字段为裸 mark（应为 NOTICE 归属 mark / yibiaoai）");
          if (it.k === "LegalCopyright") report(!ac.forbidCopyrightExact.includes(it.v), "artifact.copyright:" + it.file, "版权行仍为裸 mark");
        }
      } catch (e) { warnReport("artifacts.property", "属性读取失败：" + e.message); }
    }
  }
}

// 5b) Inno Setup 产物断言（--artifacts）
if (process.argv.includes("--artifacts") && manifest.innoChecks) {
  const ic = manifest.innoChecks;
  const dir = path.join(A_DIR, ic.dir);
  const arts = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".exe") && f.startsWith(ic.prefix))
    : [];
  report(arts.length === 1, "artifact.inno.existence", "期望 1 个 Inno 安装包，实际 " + arts.length + " 个");
  if (arts.length) {
    report(/^数据集团工具箱-Setup-\d+\.\d+\.\d+\.exe$/.test(arts[0]), "artifact.inno.name", "命名不符: " + arts[0]);
    const p = path.join(dir, arts[0]);
    const q = p.replace(/'/g, "''");
    try {
      const raw = execFileSync("pwsh", ["-NoProfile", "-Command", "$vi=(Get-Item '" + q + "').VersionInfo; $vi | ConvertTo-Json -Compress"], { encoding: "utf8" });
      const vi = JSON.parse(raw.trim() || "{}");
      const innoProduct = String(vi.ProductName || "").trim();
      report(innoProduct === ic.productName, "artifact.inno.productName", "期望 " + ic.productName + " 实际 " + innoProduct);
      const forbid = (manifest.artifactChecks && manifest.artifactChecks.forbidCopyrightExact) || [];
      const innoCopyright = String(vi.LegalCopyright || "").trim();
      report(!forbid.includes(innoCopyright), "artifact.inno.copyright", "版权违规: " + innoCopyright);
      report(/Copyright\s*(\(C\)|©)\s*2025-2026/.test(innoCopyright), "artifact.inno.copyright-present", "LegalCopyright 缺失或未含 2025-2026: " + innoCopyright);
    } catch (e) { warnReport("artifact.inno.metadata", "读取失败: " + e.message); }
  }
}

console.log("== 汇总: PASS " + pass + " / FAIL " + fail + " / WARN " + warn + " ==");
if (fail) { console.log("阻断项:"); failList.forEach(x => console.log("  - " + x)); }
if (warn) { console.log("警告:"); warnList.forEach(x => console.log("  - " + x)); }
process.exit(fail ? 1 : 0);
