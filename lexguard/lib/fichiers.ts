// Lecture d'un fichier déposé dans l'outil : on reconnaît ce que c'est, sans rien demander.
//  - décisions du Conseil d'État (archive mensuelle CE_AAAAMM.zip ou fichier DCE_*.xml) → jurisprudence ;
//  - PDF, Word (.docx), texte, Markdown, autre XML → texte de l'acte à analyser.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { type CorpusRow, htmlToText, parseDecisionCE } from "./dila";

export type FichierLu = { kind: "acte"; text: string } | { kind: "jurisprudence"; rows: CorpusRow[] };

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
      if (text.trim().length < 20) throw new Error("Ce PDF ne contient pas de texte lisible (document scanné ?).");
      return { kind: "acte", text: text.trim() };
    }

    if (ext === ".docx") {
      const xml = execFileSync("unzip", ["-p", path, "word/document.xml"], { encoding: "utf8", maxBuffer: 1 << 26 });
      return { kind: "acte", text: htmlToText(xml.replace(/<\/w:p>/g, "</p>").replace(/<w:tab\/>/g, " ")) };
    }

    if ([".html", ".htm"].includes(ext)) return { kind: "acte", text: htmlToText(bytes.toString("utf8")) };
    if ([".txt", ".md", ""].includes(ext)) return { kind: "acte", text: bytes.toString("utf8").trim() };

    throw new Error(`Format ${ext} non pris en charge : PDF, Word (.docx), texte, XML ou archive .zip du Conseil d'État.`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
