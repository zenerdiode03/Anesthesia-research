
import { XMLParser } from "fast-xml-parser";
import { JournalName } from "../types";

const NCBI_API_KEY = (process.env.NCBI_API_KEY || (import.meta as any).env?.VITE_NCBI_API_KEY)?.trim();

export type JournalSpec = { label: string; ta: string };

export const PUBMED_JOURNALS: JournalSpec[] = [
  { label: "Anaesthesia", ta: "Anaesthesia" },
  { label: "Anaesthesia Critical Care and Pain Medicine", ta: "Anaesth Crit Care Pain Med" },
  { label: "Anesthesia & Analgesia", ta: "Anesth Analg" },
  { label: "Anesthesiology", ta: "Anesthesiology" },
  { label: "BJA Education", ta: "BJA Educ" },
  { label: "British Journal of Anaesthesia", ta: "Br J Anaesth" },
  { label: "Canadian Journal of Anesthesia", ta: "Can J Anaesth" },
  { label: "European Journal of Anaesthesiology", ta: "Eur J Anaesthesiol" },
  { label: "Journal of Anesthesia", ta: "J Anesth" },
  { label: "Journal of Cardiothoracic and Vascular Anesthesia", ta: "J Cardiothorac Vasc Anesth" },
  { label: "Journal of Clinical Anesthesia", ta: "J Clin Anesth" },
  { label: "Journal of Neurosurgical Anesthesiology", ta: "J Neurosurg Anesthesiol" },
  { label: "Korean Journal of Anesthesiology", ta: "Korean J Anesthesiol" },
  { label: "Korean Journal of Pain", ta: "Korean J Pain" },
  { label: "Paediatric Anaesthesia", ta: "Paediatr Anaesth" },
  { label: "Pain", ta: "Pain" },
  { label: "Regional Anesthesia & Pain Medicine", ta: "Reg Anesth Pain Med" },
];

export function buildJournalQuery(specificJournalLabel?: string) {
  if (specificJournalLabel && specificJournalLabel !== 'All') {
    const found = PUBMED_JOURNALS.find(j => j.label === specificJournalLabel);
    if (found) return `("${found.ta}"[Journal])`;
  }
  const joined = PUBMED_JOURNALS.map((j) => `"${j.ta}"[Journal]`).join(" OR ");
  return `(${joined})`;
}

export type TagRule = {
  tag: string;
  patterns: RegExp[];
};

const RULES: TagRule[] = [
  {
    tag: "ERAS",
    patterns: [/\bERAS\b/i, /enhanced recovery/i, /fast\-track/i, /early recovery/i, /perioperative pathway/i],
  },
  {
    tag: "Regional",
    patterns: [/regional anesthesia/i, /\bnerve block\b/i, /peripheral nerve block/i, /epidural/i, /spinal anesthesia/i, /intrathecal/i, /fascial plane/i, /\bTAP\b/i, /\bESP\b/i, /\bPECS?\b/i, /\bQL\b/i],
  },
  {
    tag: "Opioid-sparing",
    patterns: [/opioid[-\s]?sparing/i, /opioid[-\s]?free/i, /OFA\b/i, /multimodal analges/i, /ketamine/i, /lidocaine/i, /dexmedetomidine/i, /magnesium/i, /NSAID/i, /acetaminophen/i],
  },
  {
    tag: "PONV",
    patterns: [/\bPONV\b/i, /postoperative nausea/i, /vomiting/i, /antiemetic/i, /ondansetron/i, /dexamethasone/i, /droperidol/i, /aprepitant/i],
  },
  {
    tag: "GI recovery",
    patterns: [/ileus/i, /gastrointestinal/i, /\bGI\b/i, /bowel function/i, /tolerance of diet/i, /feeding/i, /nasogastric/i],
  },
  {
    tag: "Airway",
    patterns: [/difficult airway/i, /videolaryng/i, /intubation/i, /supraglottic/i],
  },
  {
    tag: "ICU",
    patterns: [/critical care/i, /\bICU\b/i, /mechanical ventilation/i, /sepsis/i],
  },
  {
    tag: "Obstetric",
    patterns: [/obstetric/i, /cesarean/i, /\bC\-section\b/i, /labor analgesia/i],
  },
];

export function inferTags(title: string, abstract: string | null | undefined): string[] {
  const text = `${title}\n${abstract ?? ""}`.toLowerCase();
  const tags: string[] = [];
  for (const r of RULES) {
    if (r.patterns.some((p) => p.test(text))) tags.push(r.tag);
  }
  return Array.from(new Set(tags));
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${da}`;
}

async function ncbiGET(url: string, retries = 2, delay = 1000) {
  for (let i = 0; i <= retries; i++) {
    try {
      const finalUrl = new URL(url);
      if (NCBI_API_KEY) {
        finalUrl.searchParams.set('api_key', NCBI_API_KEY);
      }
      
      const res = await fetch(finalUrl.toString(), {
        headers: { 'User-Agent': 'AnesthesiaResearchHub/1.0.0' }
      });
      
      if (res.status === 429) {
        if (i < retries) {
          console.log(`Rate limited. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        throw new Error("PubMed rate limit exceeded. Please wait a moment and try again.");
      }
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        if (res.status >= 500 && i < retries) {
          console.log(`Server error ${res.status}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        throw new Error(`NCBI request failed (${res.status}): ${res.statusText}. ${errorText}`);
      }
      return await res.text();
    } catch (error: any) {
      if (i === retries) {
        throw error;
      }
      console.log(`Fetch error. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw new Error("Maximum retries reached for NCBI request.");
}

export async function esearchPMIDsByEDAT(journal?: string, days = 30, retmax = 20, customRange?: { start: Date, end: Date }) {
  const end = customRange?.end || new Date();
  const start = customRange?.start || new Date();
  if (!customRange) {
    start.setDate(end.getDate() - days);
  }
  
  // Use [edat] (Entrez Date) for the most recent additions to PubMed
  // Exclude Letters to focus on original research and reviews
  const term = `${buildJournalQuery(journal)} AND ("${ymd(start)}"[edat] : "${ymd(end)}"[edat]) NOT "Letter"[pt]`;

  console.log(`PubMed Search Term: ${term}`);

  const params = new URLSearchParams({
    db: "pubmed",
    retmode: "json",
    retmax: String(retmax),
    sort: "most+recent",
    term,
  });
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params.toString()}`;
  const txt = await ncbiGET(url);
  const json = JSON.parse(txt);
  return (json?.esearchresult?.idlist ?? []) as string[];
}

export async function esearchGuidelines(retmax = 50) {
  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - 1); // 1 year ago
  
  const journalQuery = buildJournalQuery();
  const guidelineTerms = '("guideline"[Title] OR "consensus statement"[Title] OR "Practice Guideline"[pt] OR "Consensus Development Conference"[pt]) AND "Review"[pt]';
  const term = `${journalQuery} AND ${guidelineTerms} AND ("${ymd(start)}"[dp] : "${ymd(end)}"[dp])`;

  console.log(`PubMed Guideline Search Term: ${term}`);

  const params = new URLSearchParams({
    db: "pubmed",
    retmode: "json",
    retmax: String(retmax),
    sort: "pub+date",
    term,
  });
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params.toString()}`;
  const txt = await ncbiGET(url);
  const json = JSON.parse(txt);
  return (json?.esearchresult?.idlist ?? []) as string[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function extractText(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (node["#text"]) return String(node["#text"]);
  return "";
}

function ensureArray<T>(x: any): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

export function normalizeJournalName(name: string): JournalName {
  const found = PUBMED_JOURNALS.find(j => 
    j.label.toLowerCase() === name.toLowerCase() || 
    j.ta.toLowerCase() === name.toLowerCase()
  );
  return (found ? found.label : name) as JournalName;
}

export async function efetchArticles(pmids: string[]) {
  if (pmids.length === 0) return [];
  
  const params = new URLSearchParams({
    db: "pubmed",
    retmode: "xml",
    id: pmids.join(","),
  });
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${params.toString()}`;
  const xml = await ncbiGET(url);
  const obj = parser.parse(xml);
  const set = obj?.PubmedArticleSet;
  const articles = ensureArray<any>(set?.PubmedArticle);

  return articles.map(a => {
    const medline = a?.MedlineCitation;
    const pmid = extractText(medline?.PMID).trim();
    const article = medline?.Article;
    const title = extractText(article?.ArticleTitle).trim();
    const journalTitle = extractText(article?.Journal?.Title).trim();
    const journalAbbrev = extractText(medline?.MedlineJournalInfo?.MedlineTA).trim();
    
    const abstractText = ensureArray<any>(article?.Abstract?.AbstractText)
      .map(p => typeof p === 'string' ? p : extractText(p))
      .join('\n');

    const authors = ensureArray<any>(article?.AuthorList?.Author)
      .map(auth => {
          const last = extractText(auth.LastName);
          const initials = extractText(auth.Initials);
          return last ? `${last} ${initials}` : extractText(auth.CollectiveName);
      })
      .filter(n => n && n.trim().length > 0);

    const pubDate = article?.Journal?.JournalIssue?.PubDate;
    const dateStr = [extractText(pubDate?.Year), extractText(pubDate?.Month), extractText(pubDate?.Day)]
      .filter(Boolean).join(' ');

    return {
      pmid,
      title,
      abstract: abstractText || null,
      journal: normalizeJournalName(journalAbbrev || journalTitle),
      journalAbbrev: journalAbbrev,
      authors,
      date: dateStr,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      tags: inferTags(title, abstractText)
    };
  });
}
