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
    start.setFullYear(end.getFullYear() - 2); 
    
    const term = `${buildJournalQuery()} AND ("${ymd(start)}"[dp] : "${ymd(end)}"[dp]) AND "Journal Article"[pt] NOT "Review"[pt] NOT "Letter"[pt]`;
    const searchParams = new URLSearchParams({
      db: "pubmed",
      retmode: "json",
      retmax: "300",
      sort: "relevance", 
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

    const keywordCounts: Record<string, number> = {};
    const STOP_LIST = new Set([
      'Humans', 'Male', 'Female', 'Adult', 'Middle Aged', 'Aged', 'Aged, 80 and over',
      'Retrospective Studies', 'Prospective Studies', 'Randomized Controlled Trial',
      'Case Reports', 'Comparative Study', 'Cohort Studies', 'Follow-Up Studies',
      'Treatment Outcome', 'Double-Blind Method', 'Single-Blind Method', 'Placebos',
      'Animals', 'Rats', 'Mice', 'Cross-Sectional Studies', 'Pilot Projects',
      'Statistics as Topic', 'Time Factors', 'Risk Factors', 'Quality of Life',
      'Anesthesia', 'Anesthesiology', 'Surgery', 'Patient Safety'
    ]);

    // Process in chunks to avoid Vercel timeout (max 10s for hobby)
    // We'll only process the first 150 PMIDs for speed on serverless
    const chunk = pmids.slice(0, 150);
    const fetchParams = new URLSearchParams({
      db: "pubmed",
      retmode: "xml",
      id: chunk.join(","),
    });
    
    if (process.env.NCBI_API_KEY) {
      fetchParams.set('api_key', process.env.NCBI_API_KEY);
    }

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${fetchParams.toString()}`;
    const fetchRes = await fetch(fetchUrl);
    const xml = await fetchRes.text();
    const obj = parser.parse(xml);
    const articles = ensureArray<any>(obj?.PubmedArticleSet?.PubmedArticle);

    articles.forEach((a: any) => {
      const medline = a?.MedlineCitation;
      const meshHeadings = ensureArray<any>(medline?.MeshHeadingList?.MeshHeading);
      meshHeadings.forEach(mh => {
        const descriptor = mh.DescriptorName;
        const isMajor = descriptor?.["@_MajorTopicYN"] === "Y";
        const term = extractText(descriptor).trim();

        if (isMajor && term && !STOP_LIST.has(term)) {
          const qualifiers = ensureArray<any>(mh.QualifierName);
          if (qualifiers.length > 0) {
            qualifiers.forEach(q => {
              const subTerm = extractText(q).trim();
              const fullTerm = `${term} / ${subTerm}`;
              keywordCounts[fullTerm] = (keywordCounts[fullTerm] || 0) + 1.5;
            });
          } else {
            keywordCounts[term] = (keywordCounts[term] || 0) + 1;
          }
        }
      });
    });

    const topKeywords = Object.entries(keywordCounts)
      .map(([text, count]) => ({ text, count: Math.round(count) }))
      .filter(k => k.text.length > 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.json(topKeywords);
  } catch (error) {
    console.error('Keyword analysis error:', error);
    res.status(500).json({ error: 'Failed to fetch keyword analysis' });
  }
}
