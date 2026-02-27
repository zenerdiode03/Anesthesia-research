
import { XMLParser } from "fast-xml-parser";

const getApiKey = () => {
  try {
    return (process.env as any).NCBI_API_KEY || null;
  } catch (e) {
    return null;
  }
};

const NCBI_API_KEY = getApiKey();

export type JournalSpec = { label: string; ta: string };

export const PUBMED_JOURNALS: JournalSpec[] = [
  { label: "Anesthesiology", ta: "Anesthesiology" },
  { label: "British Journal of Anaesthesia", ta: "Br J Anaesth" },
  { label: "Anaesthesia", ta: "Anaesthesia" },
  { label: "Anesthesia & Analgesia", ta: "Anesth Analg" },
  { label: "European Journal of Anaesthesiology", ta: "Eur J Anaesthesiol" },
  { label: "Regional Anesthesia & Pain Medicine", ta: "Reg Anesth Pain Med" },
  { label: "Canadian Journal of Anesthesia", ta: "Can J Anaesth" },
  { label: "Journal of Clinical Anesthesia", ta: "J Clin Anesth" },
  { label: "Korean Journal of Anesthesiology", ta: "Korean J Anesthesiol" },
  { label: "Journal of Anesthesia", ta: "J Anesth" },
  { label: "Pain", ta: "Pain" },
];

export function buildJournalQuery(specificJournalLabel?: string) {
  if (specificJournalLabel) {
    const found = PUBMED_JOURNALS.find(j => j.label === specificJournalLabel);
    if (found) return `(${found.ta}[ta])`;
  }
  const joined = PUBMED_JOURNALS.map((j) => `${j.ta}[ta]`).join(" OR ");
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

async function ncbiGET(url: string) {
  try {
    // Use a server-side proxy to avoid CORS issues
    const proxyUrl = `/api/pubmed?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { 
      cache: "no-store"
    });
    
    if (res.status === 429) {
      throw new Error("PubMed rate limit exceeded. Please wait a moment and try again.");
    }
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`NCBI request failed (${res.status}): ${res.statusText}. ${errorText}`);
    }
    return res.text();
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("Network error or CORS issue while accessing PubMed. Please check your internet connection or try a different browser.");
    }
    throw error;
  }
}

export async function esearchPMIDsByEDAT(journal?: string, days = 14, retmax = 10, customRange?: { start: Date, end: Date }) {
  const end = customRange?.end || new Date();
  const start = customRange?.start || new Date();
  if (!customRange) {
    start.setDate(end.getDate() - days);
  }
  
  const term = `${buildJournalQuery(journal)} AND ("${ymd(start)}"[edat] : "${ymd(end)}"[edat])`;

  const params = new URLSearchParams({
    db: "pubmed",
    retmode: "json",
    retmax: String(retmax),
    sort: "pub+date",
    term,
  });
  if (NCBI_API_KEY) params.set("api_key", NCBI_API_KEY);

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

export async function efetchArticles(pmids: string[]) {
  if (pmids.length === 0) return [];
  
  const params = new URLSearchParams({
    db: "pubmed",
    retmode: "xml",
    id: pmids.join(","),
  });
  if (NCBI_API_KEY) params.set("api_key", NCBI_API_KEY);

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
      journal: journalTitle,
      journalAbbrev: journalAbbrev,
      authors,
      date: dateStr,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      tags: inferTags(title, abstractText)
    };
  });
}
