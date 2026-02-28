
import { GoogleGenAI, Type } from "@google/genai";
import { Paper, JournalName } from "../types";
import { esearchPMIDsByEDAT, efetchArticles } from "./pubmedApi";

// Lazy initialization to prevent crash if API key is missing at load time
let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    // Try process.env first (injected by Vite define), then fallback to import.meta.env
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      throw new Error("GEMINI_API_KEY is not configured. Please set it in your Vercel Environment Variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

/**
 * Maps PubMed journal strings to our internal JournalName type.
 */
function mapJournalToType(jt: string, ja: string): JournalName {
  jt = jt.toLowerCase();
  ja = ja.toLowerCase();

  if (ja === 'br j anaesth' || jt.includes('british journal')) return 'British Journal of Anaesthesia';
  if (ja === 'anesth analg' || jt.includes('anesthesia and analgesia') || jt.includes('anesthesia & analgesia')) return 'Anesthesia & Analgesia';
  if (ja === 'eur j anaesthesiol' || jt.includes('european journal')) return 'European Journal of Anaesthesiology';
  if (ja === 'reg anesth pain med' || jt.includes('regional anesthesia')) return 'Regional Anesthesia & Pain Medicine';
  if (ja === 'anaesthesia' || jt === 'anaesthesia') return 'Anaesthesia';
  if (ja === 'can j anaesth' || jt.includes('canadian journal')) return 'Canadian Journal of Anesthesia';
  if (ja === 'j clin anesth' || jt.includes('clinical anesthesia')) return 'Journal of Clinical Anesthesia';
  if (ja === 'korean j anesthesiol' || jt.includes('korean journal')) return 'Korean Journal of Anesthesiology';
  if (ja === 'j anesth' || jt.includes('journal of anesthesia')) return 'Journal of Anesthesia';
  if (ja === 'pain' || jt === 'pain') return 'Pain';
  if (ja === 'anesthesiology' || jt === 'anesthesiology') return 'Anesthesiology';
  
  return 'Anesthesiology'; // Default fallback
}

export async function fetchLatestResearch(journal?: JournalName, customRange?: { start: Date, end: Date }): Promise<Paper[]> {
  try {
    // 1. Get real PMIDs from PubMed
    const pmids = await esearchPMIDsByEDAT(journal, 14, 15, customRange);
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

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }
    const enrichments: any[] = JSON.parse(text);

    // 4. Merge real data with AI enrichments
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
        journal: mapJournalToType(raw.journal, raw.journalAbbrev),
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
  } catch (error) {
    console.error("Failed to process research feed:", error);
    throw error; // Throw error to be handled by UI
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
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 4000 }
        }
    });

    return response.text || "Summary generation failed. Please try again.";
}

export async function generateWeeklyReport(papers: Paper[], startDate: Date, endDate: Date): Promise<string> {
    if (papers.length === 0) return "지난 한 주간 발표된 주요 논문이 없습니다.";

    const journalGroups = papers.reduce((acc, paper) => {
        if (!acc[paper.journal]) acc[paper.journal] = [];
        acc[paper.journal].push(paper);
        return acc;
    }, {} as Record<string, Paper[]>);

    const prompt = `Act as a senior medical editor for an anesthesiology research briefing.
I have a list of research articles published between ${startDate.toLocaleDateString()} and ${endDate.toLocaleDateString()}.
Please provide a "Weekly Research Briefing" in Korean.

Structure & Formatting Rules:
1. 주간 개요 (Weekly Overview): 이번 주 연구 동향에 대한 짧은 요약 (2-3문장).
2. 저널별 주요 연구 (Key Research by Journal): 
   - 각 저널명은 반드시 "### **저널명**" 형식으로 작성하세요. (이 형식은 파란색으로 표시됩니다).
   - 저널 섹션 사이에는 반드시 빈 줄을 추가하여 가독성을 높이세요.
   - 각 연구는 반드시 한 줄에 하나씩만 작성하세요.
   - 형식: 📄 [연구 제목](URL) (PMID: 번호)
   - 별도의 상세 설명이나 요약 없이 목록 형태로만 작성하여 간결함을 유지하세요.
3. 임상적 시사점 (Clinical Implications): 이번 주 연구들이 전체적으로 마취과 임상 현장에 주는 메시지.

데이터:
${Object.entries(journalGroups).map(([journal, journalPapers]) => `
[${journal}]
${journalPapers.map(p => `- 📄 [${p.title}](${p.url}) (PMID: ${p.id})`).join('\n')}
`).join('\n')}

출력은 마크다운 형식을 사용하고, 전문적이고 신뢰감 있는 어조를 유지하세요.`;

    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 4000 }
        }
    });

    return response.text || "리포트 생성에 실패했습니다.";
}
