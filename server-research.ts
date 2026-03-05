
import axios from 'axios';
import { GoogleGenAI, Type } from "@google/genai";
import { XMLParser } from "fast-xml-parser";

const PUBMED_JOURNALS = [
  { label: "Anesthesiology", ta: "Anesthesiology" },
  { label: "British Journal of Anaesthesia", ta: "Br J Anaesth" },
  { label: "Anesthesia & Analgesia", ta: "Anesth Analg" },
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

async function ncbiFetch(baseUrl: string, params: URLSearchParams) {
  const logParams = new URLSearchParams(params);
  if (logParams.has('api_key')) logParams.set('api_key', '***');
  console.log(`[NCBI] Fetching ${baseUrl} with params ${logParams.toString()}`);
  
  try {
    const response = await axios.get(baseUrl, {
      params: Object.fromEntries(params.entries()),
      headers: { 'User-Agent': 'AnesthesiaResearchHub/1.0.0' },
      timeout: 15000
    });
    // Axios handles XML/JSON parsing automatically if headers are correct, 
    // but NCBI sometimes returns text/xml. We want the raw data for XMLParser.
    return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  } catch (error: any) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error(`[NCBI] Error ${status}: ${typeof data === 'string' ? data.slice(0, 200) : 'JSON error'}`);
    throw new Error(`NCBI request failed (${status || 'Network Error'}): ${error.message}`);
  }
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

  // Add API Key if available and looks valid
  const ncbiKey = (process.env.NCBI_API_KEY || '').trim();
  if (ncbiKey && ncbiKey.length > 5) {
    searchParams.append('api_key', ncbiKey);
  }
  
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`;
  const searchTxt = await ncbiFetch(searchUrl, searchParams);
  const searchJson = JSON.parse(searchTxt);
  const pmids = (searchJson?.esearchresult?.idlist ?? []) as string[];
  
  if (pmids.length === 0) return [];

  // 2. Fetch Articles
  const fetchParams = new URLSearchParams({
    db: "pubmed",
    retmode: "xml",
    id: pmids.join(","),
  });

  if (ncbiKey && ncbiKey.length > 5) {
    fetchParams.append('api_key', ncbiKey);
  }

  const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi`;
  const xml = await ncbiFetch(fetchUrl, fetchParams);
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

export async function fetchKeywordAnalysis(apiKey: string) {
  console.log("Starting advanced keyword analysis (last 2 years)...");
  
  // 1. Search PMIDs for Original Articles in the last 2 years
  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - 2); 
  
  const term = `${buildJournalQuery()} AND ("${ymd(start)}"[dp] : "${ymd(end)}"[dp]) AND "Journal Article"[pt] NOT "Review"[pt] NOT "Letter"[pt]`;
  const searchParams = new URLSearchParams({
    db: "pubmed",
    retmode: "json",
    retmax: "300", // Reduced for maximum reliability and speed
    sort: "relevance", 
    term,
  });

  const ncbiKey = (process.env.NCBI_API_KEY || '').trim();
  if (ncbiKey && ncbiKey.length > 5) {
    searchParams.append('api_key', ncbiKey);
  }
  
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`;
  const searchTxt = await ncbiFetch(searchUrl, searchParams);
  const searchJson = JSON.parse(searchTxt);
  const pmids = (searchJson?.esearchresult?.idlist ?? []) as string[];
  
  if (pmids.length === 0) return [];

  // 2. Fetch Articles and Extract MeSH Major Topics in chunks
  const chunkSize = 200;
  const keywordCounts: Record<string, number> = {};
  const textForGemini: string[] = [];

  // Stop list for non-essential terms
  const STOP_LIST = new Set([
    'Humans', 'Male', 'Female', 'Adult', 'Middle Aged', 'Aged', 'Aged, 80 and over',
    'Retrospective Studies', 'Prospective Studies', 'Randomized Controlled Trial',
    'Case Reports', 'Comparative Study', 'Cohort Studies', 'Follow-Up Studies',
    'Treatment Outcome', 'Double-Blind Method', 'Single-Blind Method', 'Placebos',
    'Animals', 'Rats', 'Mice', 'Cross-Sectional Studies', 'Pilot Projects',
    'Statistics as Topic', 'Time Factors', 'Risk Factors', 'Quality of Life',
    'Anesthesia', 'Anesthesiology', 'Surgery', 'Patient Safety'
  ]);

  for (let i = 0; i < pmids.length; i += chunkSize) {
    const chunk = pmids.slice(i, i + chunkSize);
    const fetchParams = new URLSearchParams({
      db: "pubmed",
      retmode: "xml",
      id: chunk.join(","),
    });

    const ncbiKey = (process.env.NCBI_API_KEY || '').trim();
    if (ncbiKey && ncbiKey.length > 5) {
      fetchParams.append('api_key', ncbiKey);
    }

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi`;
    
    try {
      const xml = await ncbiFetch(fetchUrl, fetchParams);
      const obj = parser.parse(xml);
      const articles = ensureArray<any>(obj?.PubmedArticleSet?.PubmedArticle);

      articles.forEach((a: any) => {
        const medline = a?.MedlineCitation;
        const article = medline?.Article;
        const title = extractText(article?.ArticleTitle);
        const abstract = ensureArray<any>(article?.Abstract?.AbstractText)
          .map(p => typeof p === 'string' ? p : extractText(p))
          .join(' ');
        
        // Collect a subset for Gemini (first 50 articles with abstracts)
        if (title && textForGemini.length < 50) {
          textForGemini.push(`Title: ${title}\nAbstract: ${abstract.slice(0, 300)}...`);
        }

        // Extract MeSH Major Topics with Subheadings
        const meshHeadings = ensureArray<any>(medline?.MeshHeadingList?.MeshHeading);
        meshHeadings.forEach(mh => {
          const descriptor = mh.DescriptorName;
          const isMajor = descriptor?.["@_MajorTopicYN"] === "Y";
          const term = extractText(descriptor).trim();

          if (isMajor && term && !STOP_LIST.has(term)) {
            // Handle Subheadings
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
    } catch (err) {
      console.error(`Error fetching chunk ${i}:`, err);
      continue;
    }
  }

  // 3. Use Gemini for Title/Abstract based extraction (NLP approach)
  const genAI = new GoogleGenAI({ apiKey });
  const model = genAI.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Act as a bibliometric expert in anesthesiology. 
Analyze the following research titles and abstracts from the last 2 years.
Extract the top 15 most significant CLINICAL RESEARCH TOPICS.
Focus on:
- Drugs (e.g., Dexmedetomidine, Sugammadex)
- Techniques/Procedures (e.g., Regional Anesthesia, ERAS, Goal-directed therapy)
- Specific Outcomes (e.g., Opioid-sparing, PONV, Delirium)
- Devices (e.g., Videolaryngoscopy)

DO NOT include study designs (RCT, Retrospective), population tags (Adult, Male), or generic terms (Anesthesia, Surgery).

Articles:
${textForGemini.slice(0, 40).join('\n\n')}

Return a JSON array of objects with keys: "topic" (string) and "relevance_score" (number 1-10).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            relevance_score: { type: Type.NUMBER }
          },
          required: ["topic", "relevance_score"]
        }
      }
    }
  });

  try {
    const response = await model;
    const geminiTopics: any[] = JSON.parse(response.text || "[]");
    
    // Merge Gemini topics into keywordCounts
    geminiTopics.forEach(gt => {
      const topic = gt.topic;
      // Boost score based on relevance
      keywordCounts[topic] = (keywordCounts[topic] || 0) + (gt.relevance_score * 2);
    });
  } catch (e) {
    console.error("Gemini keyword extraction failed:", e);
  }

  // 4. Final Sort and Filter
  const topKeywords = Object.entries(keywordCounts)
    .map(([text, count]) => ({ text, count: Math.round(count) }))
    .filter(k => k.text.length > 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return topKeywords;
}
