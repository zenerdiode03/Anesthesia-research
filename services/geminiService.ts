
import { GoogleGenAI, Type } from "@google/genai";
import { Paper, JournalName } from "../types";
import { esearchPMIDsByEDAT, efetchArticles, normalizeJournalName, esearchGuidelines } from "./pubmedApi";

// Lazy initialization to prevent crash if API key is missing at load time
let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    // Try process.env first (injected by Vite define), then fallback to import.meta.env
    const apiKey = (process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY)?.trim();
    
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null' || apiKey.length < 10) {
      throw new Error("GEMINI_API_KEY is not configured or invalid. Please set a valid key in Vercel Environment Variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

/**
 * Core enrichment logic (usable on server or client)
 */
export async function enrichResearchData(rawArticles: any[]): Promise<Paper[]> {
  if (rawArticles.length === 0) return [];

  const prompt = `Act as an expert clinical research assistant in anesthesiology. 
I have a list of real research articles recently published on PubMed. 
Based on the provided titles and abstracts, generate:
1. A Study Category: "Review" or "Original Article".
2. A Clinical Impact statement: 1-2 powerful sentences summarizing why this matters at the bedside.
3. A High-level Summary: 2-3 concise sentences explaining the primary findings.
4. Keywords: 3-5 relevant medical keywords for indexing.

Articles:
${rawArticles.map((a, i) => `${i+1}. PMID: ${a.pmid}\nTitle: ${a.title}\nJournal: ${a.journal}\nAbstract: ${a.abstract}`).join('\n\n')}

Return your analysis as a JSON array of objects with keys: pmid, category, clinicalImpact, summary, keywords.`;

  const ai = getAI();
  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
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
              keywords: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
            },
            required: ["pmid", "category", "clinicalImpact", "summary", "keywords"]
          }
        }
      }
    });
  } catch (err: any) {
    if (err.message?.includes('fetch') || err.name === 'TypeError') {
      throw new Error("Google AI 서비스에 연결할 수 없습니다. 네트워크 방화벽이나 VPN 설정을 확인해 주세요. (Failed to fetch Gemini API)");
    }
    throw err;
  }

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  const enrichments: any[] = JSON.parse(text);

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
      journal: normalizeJournalName(raw.journalAbbrev || raw.journal),
      date: raw.date,
      url: raw.url,
      abstract: raw.abstract || undefined,
      category: enrichment.category as any,
      clinicalImpact: enrichment.clinicalImpact,
      summary: enrichment.summary,
      keywords: enrichment.keywords,
      tags: raw.tags
    };
  });
}

/**
 * Maps PubMed journal strings to our internal JournalName type.
 */
export async function fetchLatestResearch(journal?: JournalName, customRange?: { start: Date, end: Date }): Promise<Paper[]> {
  const isServer = typeof window === 'undefined';
  
  // Client-side fetch from server API to avoid rate limits
  if (!isServer) {
    const params = new URLSearchParams();
    if (journal) params.set('journal', journal);
    if (customRange) {
      params.set('start', customRange.start.toISOString());
      params.set('end', customRange.end.toISOString());
    }
    
    const res = await fetch(`/api/research?${params.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  // Server-side logic (direct fetch + enrich)
  const pmids = await esearchPMIDsByEDAT(journal, 7, 30, customRange);
  if (pmids.length === 0) return [];

  const rawArticles = await efetchArticles(pmids);
  return await enrichResearchData(rawArticles);
}

export async function generateDeepSummary(paper: Paper): Promise<string> {
    const isServer = typeof window === 'undefined';
    
    if (!isServer) {
        const res = await fetch('/api/deep-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paper })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        return data.summary;
    }

    const prompt = `As a world-class academic anesthesiologist and researcher, provide a "Deep Dive" clinical critique for the following article.
    
ARTICLE: ${paper.title}
JOURNAL: ${paper.journal}
AUTHORS: ${paper.authors.join(', ')}
ABSTRACT: ${paper.abstract || paper.summary}

Structure the response with high-impact professional formatting:
1. CLINICAL SIGNIFICANCE: What is the primary question and why does it matter?
2. METHODOLOGICAL RIGOR: Critique the design, sample size, and potential biases.
3. BEDSIDE APPLICATION: Exactly how should this change (or not change) current practice?
4. TAKE-HOME MESSAGE: The single most important takeaway.`;

    const ai = getAI();
    let response;
    try {
        response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 4000 }
            }
        });
    } catch (err: any) {
        if (err.message?.includes('fetch') || err.name === 'TypeError') {
            throw new Error("Google AI 서비스에 연결할 수 없습니다. (Failed to fetch Gemini API)");
        }
        throw err;
    }

    return response.text || "Summary generation failed. Please try again.";
}

export async function fetchGuidelines(): Promise<Paper[]> {
  const isServer = typeof window === 'undefined';
  
  if (!isServer) {
    const res = await fetch('/api/guidelines');
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  // Server-side logic
  const pmids = await esearchGuidelines(50);
  if (pmids.length === 0) return [];

  const rawArticles = await efetchArticles(pmids);
  
  return rawArticles.map((raw) => ({
    id: raw.pmid,
    title: raw.title,
    authors: raw.authors,
    journal: normalizeJournalName(raw.journalAbbrev || raw.journal),
    date: raw.date,
    url: raw.url,
    abstract: raw.abstract || undefined,
    category: 'Review' as const, // Guidelines are typically reviews
    clinicalImpact: 'Official clinical guideline or consensus statement.',
    summary: raw.abstract?.slice(0, 300) || 'Abstract not available.',
    keywords: raw.tags,
    tags: raw.tags
  }));
}
