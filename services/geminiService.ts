
import { GoogleGenAI, Type } from "@google/genai";
import { Paper, JournalName } from "../types";
import { esearchPMIDsByEDAT, efetchArticles, normalizeJournalName } from "./pubmedApi";

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
 * Maps PubMed journal strings to our internal JournalName type.
 */
export async function fetchLatestResearch(journal?: JournalName, customRange?: { start: Date, end: Date }): Promise<Paper[]> {
  const rangeSuffix = customRange 
    ? `${customRange.start.toISOString().split('T')[0]}_${customRange.end.toISOString().split('T')[0]}`
    : 'default';
  const cacheKey = `research_cache_v7_${journal || 'all'}_${rangeSuffix}`;
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  try {
    // 0. Check Cache
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        console.log(`Using cached data for ${journal || 'all'} (${rangeSuffix})`);
        return data;
      }
    }

    // 1. Get real PMIDs from PubMed
    const pmids = await esearchPMIDsByEDAT(journal, 7, 30, customRange);
    if (pmids.length === 0) return [];

    // 2. Fetch real article metadata (Title, Authors, Abstract)
    const rawArticles = await efetchArticles(pmids);

    // 3. Use Gemini to enrich this real data with clinical insights
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

    // 4. Merge real data with AI enrichments
    const processedArticles = rawArticles.map((raw) => {
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

    // 5. Save to Cache
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      data: processedArticles
    }));

    return processedArticles;
  } catch (error) {
    console.error("Failed to process research feed:", error);
    throw error; // Throw error to be handled by UI
  }
}

export async function fetchKeywordInsights(): Promise<{ keyword: string, count: number }[]> {
  const cacheKey = `keyword_insights_cache_v2_3months`;
  const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }

    // Fetch PMIDs for the last 3 months (90 days)
    // Increase retmax to 1000 to capture "all" typical output for 17 journals in 3 months
    const pmids = await esearchPMIDsByEDAT(undefined, 90, 1000);
    if (pmids.length === 0) return [];

    const rawArticles = await efetchArticles(pmids);
    
    // Use Gemini to extract and normalize keywords from the full batch
    const prompt = `Analyze the following titles of ${rawArticles.length} recent anesthesiology research papers published in the last 3 months. 
    Identify the top 20 most frequent and significant medical keywords/topics across ALL these papers. 
    Focus on clinical topics, drugs, techniques, or conditions.
    
    Articles:
    ${rawArticles.map((a, i) => `${i+1}. ${a.title}`).join('\n')}
    
    Return a JSON array of objects with keys: keyword, count. 
    The count should represent how many of the provided articles relate to that keyword.
    Sort by count descending.`;

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              keyword: { type: Type.STRING },
              count: { type: Type.NUMBER }
            },
            required: ["keyword", "count"]
          }
        }
      }
    });

    const insights = JSON.parse(response.text || "[]");
    
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      data: insights
    }));

    return insights;
  } catch (error) {
    console.error("Failed to fetch keyword insights:", error);
    return [];
  }
}

export async function generateDeepSummary(paper: Paper): Promise<string> {
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
