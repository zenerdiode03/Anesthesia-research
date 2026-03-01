
import { GoogleGenAI, Type } from "@google/genai";
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

async function ncbiFetch(url: string) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'AnesthesiaResearchHub/1.0.0' }
  });
  if (!response.ok) throw new Error(`NCBI request failed: ${response.statusText}`);
  return await response.text();
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

export async function fetchAndProcessResearch(apiKey: string) {
  console.log("Starting daily research extraction...");
  
  // 1. Search PMIDs
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7); // Last 7 days
  
  const term = `${buildJournalQuery()} AND ("${ymd(start)}"[dp] : "${ymd(end)}"[dp]) NOT "Letter"[pt]`;
  const searchParams = new URLSearchParams({
    db: "pubmed",
    retmode: "json",
    retmax: "30",
    sort: "pub+date",
    term,
  });
  
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams.toString()}`;
  const searchTxt = await ncbiFetch(searchUrl);
  const searchJson = JSON.parse(searchTxt);
  const pmids = (searchJson?.esearchresult?.idlist ?? []) as string[];
  
  if (pmids.length === 0) return [];

  // 2. Fetch Articles
  const fetchParams = new URLSearchParams({
    db: "pubmed",
    retmode: "xml",
    id: pmids.join(","),
  });
  const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${fetchParams.toString()}`;
  const xml = await ncbiFetch(fetchUrl);
  const obj = parser.parse(xml);
  const articles = ensureArray<any>(obj?.PubmedArticleSet?.PubmedArticle);

  const rawArticles = articles.map((a: any) => {
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
      journal: journalAbbrev || journalTitle,
      authors,
      date: dateStr,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      tags: inferTags(title, abstractText)
    };
  });

  // 3. Enrich with Gemini
  const genAI = new GoogleGenAI({ apiKey });
  const model = genAI.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Act as an expert clinical research assistant in anesthesiology. 
I have a list of real research articles recently published on PubMed. 
Based on the provided titles and abstracts, generate:
1. A Study Category: "Review" or "Original Article".
2. A Clinical Impact statement: 1-2 powerful sentences summarizing why this matters at the bedside.
3. A High-level Summary: 2-3 concise sentences explaining the primary findings.
4. Keywords: 3-5 relevant medical keywords for indexing.

Articles:
${rawArticles.map((a, i) => `${i+1}. PMID: ${a.pmid}\nTitle: ${a.title}\nJournal: ${a.journal}\nAbstract: ${a.abstract}`).join('\n\n')}

Return your analysis as a JSON array of objects with keys: pmid, category, clinicalImpact, summary, keywords.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            pmid: { type: Type.STRING },
            category: { type: Type.STRING },
            clinicalImpact: { type: Type.STRING },
            summary: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["pmid", "category", "clinicalImpact", "summary", "keywords"]
        }
      }
    }
  });

  const response = await model;
  const enrichments: any[] = JSON.parse(response.text || "[]");

  // 4. Merge
  return rawArticles.map((raw) => {
    const enrichment = enrichments.find(e => e.pmid === raw.pmid) || { 
      category: 'Original Article', 
      clinicalImpact: 'Clinical analysis pending.', 
      summary: raw.abstract?.slice(0, 200) || 'Detailed abstract not available.',
      keywords: []
    };

    return {
      id: raw.pmid,
      title: raw.title,
      authors: raw.authors,
      journal: raw.journal,
      date: raw.date,
      url: raw.url,
      abstract: raw.abstract,
      category: enrichment.category,
      clinicalImpact: enrichment.clinicalImpact,
      summary: enrichment.summary,
      keywords: enrichment.keywords,
      tags: raw.tags
    };
  });
}
