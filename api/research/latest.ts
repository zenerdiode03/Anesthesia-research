import type { VercelRequest, VercelResponse } from '@vercel/node';
import { XMLParser } from "fast-xml-parser";

const PUBMED_JOURNALS = [
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

const RULES = [
  { tag: "ERAS", patterns: [/\bERAS\b/i, /enhanced recovery/i, /fast\-track/i, /early recovery/i, /perioperative pathway/i] },
  { tag: "Regional", patterns: [/regional anesthesia/i, /\bnerve block\b/i, /peripheral nerve block/i, /epidural/i, /spinal anesthesia/i, /intrathecal/i, /fascial plane/i, /\bTAP\b/i, /\bESP\b/i, /\bPECS?\b/i, /\bQL\b/i] },
  { tag: "Opioid-sparing", patterns: [/opioid[-\s]?sparing/i, /opioid[-\s]?free/i, /OFA\b/i, /multimodal analges/i, /ketamine/i, /lidocaine/i, /dexmedetomidine/i, /magnesium/i, /NSAID/i, /acetaminophen/i] },
  { tag: "PONV", patterns: [/\bPONV\b/i, /postoperative nausea/i, /vomiting/i, /antiemetic/i, /ondansetron/i, /dexamethasone/i, /droperidol/i, /aprepitant/i] },
  { tag: "GI recovery", patterns: [/ileus/i, /gastrointestinal/i, /\bGI\b/i, /bowel function/i, /tolerance of diet/i, /feeding/i, /nasogastric/i] },
  { tag: "Airway", patterns: [/difficult airway/i, /videolaryng/i, /intubation/i, /supraglottic/i] },
  { tag: "ICU", patterns: [/critical care/i, /\bICU\b/i, /mechanical ventilation/i, /sepsis/i] },
  { tag: "Obstetric", patterns: [/obstetric/i, /cesarean/i, /\bC\-section\b/i, /labor analgesia/i] },
];

function inferTags(title: string, abstract: string | null | undefined): string[] {
  const text = `${title}\n${abstract ?? ""}`.toLowerCase();
  const tags: string[] = [];
  for (const r of RULES) {
    if (r.patterns.some((p) => p.test(text))) tags.push(r.tag);
  }
  return Array.from(new Set(tags));
}

function buildJournalQuery() {
  const joined = PUBMED_JOURNALS.map((j) => `"${j.ta}"[Journal]`).join(" OR ");
  return `(${joined})`;
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${da}`;
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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    
    const term = `${buildJournalQuery()} AND ("${ymd(start)}"[dp] : "${ymd(end)}"[dp]) NOT "Letter"[pt]`;
    const searchParams = new URLSearchParams({
      db: "pubmed",
      retmode: "json",
      retmax: "30",
      sort: "pub+date",
      term,
    });
    
    if (process.env.NCBI_API_KEY) {
      searchParams.set('api_key', process.env.NCBI_API_KEY);
    }

    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams.toString()}`;
    const searchRes = await fetch(searchUrl);
    const searchJson = await searchRes.json();
    const pmids = (searchJson?.esearchresult?.idlist ?? []) as string[];
    
    if (pmids.length === 0) return res.json([]);

    const fetchParams = new URLSearchParams({
      db: "pubmed",
      retmode: "xml",
      id: pmids.join(","),
    });
    
    if (process.env.NCBI_API_KEY) {
      fetchParams.set('api_key', process.env.NCBI_API_KEY);
    }

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${fetchParams.toString()}`;
    const fetchRes = await fetch(fetchUrl);
    const xml = await fetchRes.text();
    const obj = parser.parse(xml);
    const articles = ensureArray<any>(obj?.PubmedArticleSet?.PubmedArticle);

    const results = articles.map((a: any) => {
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
        id: pmid,
        title,
        abstract: abstractText || null,
        journal: journalAbbrev || journalTitle,
        authors,
        date: dateStr,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        tags: inferTags(title, abstractText)
      };
    });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.json(results);
  } catch (error) {
    console.error('Latest research error:', error);
    res.status(500).json({ error: 'Failed to fetch latest research' });
  }
}
