// Lecture d'un fichier déposé dans l'outil : on reconnaît ce que c'est, sans rien demander.
//  - décisions du Conseil d'État (archive mensuelle CE_AAAAMM.zip ou fichier DCE_*.xml) → jurisprudence ;
//  - PDF, Word (.docx), texte, Markdown, autre XML → texte de l'acte à analyser ;
//  - photo ou scan (JPEG, PNG, HEIC, WEBP, TIFF, PDF sans texte) → recopié par le modèle, puis analysé.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { transcribe } from "./agents/llm";
import { type CorpusRow, htmlToText, parseDecisionCE } from "./dila";

export type FichierLu = { kind: "acte"; text: string } | { kind: "jurisprudence"; rows: CorpusRow[] };

const IMAGES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
const A_CONVERTIR = [".heic", ".heif", ".tif", ".tiff", ".bmp"]; // formats que le modèle ne lit pas : convertis en JPEG
const MAX_PAGES_SCAN = 10;

/** Image prête pour le modèle : convertie en JPEG si besoin et réduite à 2000 px (sips, natif macOS). */
function imageFor(path: string, ext: string, dir: string): { mime: string; base64: string } {
  const out = join(dir, `page-${Math.random().toString(36).slice(2)}.jpg`);
  if (A_CONVERTIR.includes(ext) || readFileSync(path).length > 3_000_000) {
    execFileSync("sips", ["-s", "format", "jpeg", "-Z", "2000", path, "--out", out], { stdio: "pipe" });
    return { mime: "image/jpeg", base64: readFileSync(out).toString("base64") };
  }
  return { mime: IMAGES[ext], base64: readFileSync(path).toString("base64") };
}

async function lireImages(images: Array<{ mime: string; base64: string }>) {
  // Le modèle reproduit la mise en page avec des espaces (dont l'espace idéographique U+3000) : on les resserre.
  const text = (await transcribe(images))
    .split("\n")
    .map((l) => l.replace(/[　\t ]+/g, " ").trim())
    .join("\n");
  if (text.length < 20) throw new Error("Aucun texte lisible sur l'image.");
  return text;
}

const MAX_DEZIPPE = 500 * 1024 * 1024; // une archive mensuelle du CE fait ~10 Mo une fois décompressée

export async function lireFichier(name: string, bytes: Buffer): Promise<FichierLu> {
  const ext = extname(name).toLowerCase();
  const dir = mkdtempSync(join(tmpdir(), "lexguard-"));
  try {
    const path = join(dir, `fichier${ext}`);
    writeFileSync(path, bytes);

    if (ext === ".zip") {
      // Taille décompressée annoncée (dernière ligne de `unzip -l`) : on refuse les archives piégées.
      const total = Number(execFileSync("unzip", ["-l", path], { encoding: "utf8" }).trim().split("\n").at(-1)?.trim().split(/\s+/)[0]);
      if (!(total <= MAX_DEZIPPE)) throw new Error("Archive trop volumineuse une fois décompressée.");
      execFileSync("unzip", ["-o", "-q", path, "-d", join(dir, "zip")]);
      const rows = readdirSync(join(dir, "zip"), { recursive: true })
        .map(String)
        .filter((f) => f.endsWith(".xml"))
        .map((f) => parseDecisionCE(readFileSync(join(dir, "zip", f), "utf8")))
        .filter((r) => r !== null);
      if (!rows.length) throw new Error("Cette archive ne contient pas de décisions du Conseil d'État reconnues.");
      return { kind: "jurisprudence", rows };
    }

    if (ext === ".xml") {
      const xml = bytes.toString("utf8");
      const decision = parseDecisionCE(xml);
      return decision ? { kind: "jurisprudence", rows: [decision] } : { kind: "acte", text: htmlToText(xml) };
    }

    if (ext === ".pdf") {
      const text = execFileSync("pdftotext", ["-layout", path, "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
      if (text.trim().length >= 50) return { kind: "acte", text: text.trim() };
      // PDF scanné (pages en images) : on photographie les pages et le modèle les recopie.
      execFileSync("pdftoppm", ["-jpeg", "-r", "110", "-l", String(MAX_PAGES_SCAN), path, join(dir, "scan")]);
      const pages = readdirSync(dir).filter((f) => f.startsWith("scan")).sort().map((f) => imageFor(join(dir, f), ".jpg", dir));
      return { kind: "acte", text: await lireImages(pages) };
    }

    if (ext in IMAGES || A_CONVERTIR.includes(ext)) {
      return { kind: "acte", text: await lireImages([imageFor(path, ext, dir)]) };
    }

    if (ext === ".docx") {
      const xml = execFileSync("unzip", ["-p", path, "word/document.xml"], { encoding: "utf8", maxBuffer: 1 << 26 });
      return { kind: "acte", text: htmlToText(xml.replace(/<\/w:p>/g, "</p>").replace(/<w:tab\/>/g, " ")) };
    }

    if ([".html", ".htm"].includes(ext)) return { kind: "acte", text: htmlToText(bytes.toString("utf8")) };
    if ([".txt", ".md", ""].includes(ext)) return { kind: "acte", text: bytes.toString("utf8").trim() };

    throw new Error(`Format ${ext} non pris en charge : PDF, Word (.docx), image (JPEG, PNG, HEIC…), texte, XML ou archive .zip du Conseil d'État.`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
