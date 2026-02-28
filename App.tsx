
import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import Layout from './components/Layout';
import PaperCard from './components/PaperCard';
import { Paper, JournalName } from './types';
import { fetchLatestResearch, generateDeepSummary } from './services/geminiService';
import { JOURNALS } from './constants';

const App: React.FC = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJournal, setSelectedJournal] = useState<JournalName | 'All'>('All');
  
  const [viewMode, setViewMode] = useState<'live' | 'weeklyList'>('live');
  const [weeklyPapers, setWeeklyPapers] = useState<Paper[]>([]);
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);

  const getLastWeekRange = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
    
    const diffToLastMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + 7;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - diffToLastMonday);
    lastMonday.setHours(0, 0, 0, 0);
    
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);
    
    return { start: lastMonday, end: lastSunday };
  };

  const loadPapers = useCallback(async (journalName?: JournalName) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLatestResearch(journalName === 'All' as any ? undefined : journalName);
      setPapers(data);
    } catch (err: any) {
      console.error("Error loading research feed:", err);
      setError(err.message || "연구 데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWeeklyList = async () => {
    setIsWeeklyLoading(true);
    setError(null);
    try {
      const range = getLastWeekRange();
      const data = await fetchLatestResearch(undefined, range);
      setWeeklyPapers(data);
    } catch (err: any) {
      console.error("Error loading weekly list:", err);
      setError(err.message || "주간 리스트를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsWeeklyLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'live') {
      loadPapers();
    } else {
      loadWeeklyList();
    }
  }, [viewMode, loadPapers]);

  const handleJournalFilter = (journal: JournalName | 'All') => {
    if (selectedJournal === journal) return;
    setSelectedJournal(journal);
    loadPapers(journal === 'All' ? undefined : journal);
  };

  const weekRange = getLastWeekRange();

  return (
    <Layout>
      {/* Hero Section */}
      <div className="relative mb-16 overflow-hidden rounded-[2.5rem] bg-slate-900 px-8 py-16 md:px-16 md:py-24 shadow-2xl shadow-blue-900/20">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-slate-600/20 blur-3xl"></div>
        
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            <span>RESEARCH TRACKING</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-white leading-[1.1] tracking-tight mb-6">
            마취통증의학의 <br/>
            최신 연구를 <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">사냥</span>하세요
          </h2>
          <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-2xl">
            수많은 논문의 홍수 속에서 마취통증의학 연구자에게 꼭 필요한 핵심 정보만 골라냅니다. 
            Gemini AI가 제공하는 실시간 임상 요약으로 지식 습득의 효율을 극대화하세요.
          </p>
        </div>
      </div>

      {/* View Mode Switcher */}
      <div className="flex items-center justify-center mb-12">
        <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center shadow-inner">
          <button 
            onClick={() => setViewMode('live')}
            className={`px-8 py-3 rounded-xl text-sm font-black transition-all ${viewMode === 'live' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            실시간 피드
          </button>
          <button 
            onClick={() => setViewMode('weeklyList')}
            className={`px-8 py-3 rounded-xl text-sm font-black transition-all ${viewMode === 'weeklyList' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            주간 출간 리스트
          </button>
        </div>
      </div>

      {viewMode === 'live' ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">실시간 연구 피드</h3>
                <div className="group relative">
                  <svg className="w-4 h-4 text-slate-300 cursor-help hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-800 text-white text-[11px] rounded-xl shadow-xl z-50 leading-relaxed">
                    <p className="font-bold text-blue-400 mb-1">업데이트 안내</p>
                    최근 14일간 주요 저널에 등재된 신규 논문을 보여줍니다. 데이터는 24시간마다 자동으로 갱신되어 최신 상태를 유지합니다.
                  </div>
                </div>
              </div>
              <p className="text-slate-500 text-sm font-medium">주요 저널에 최근 등재된 논문 목록입니다.</p>
            </div>
            
            <div className="flex items-center space-x-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto custom-scrollbar no-scrollbar-firefox">
              <button
                onClick={() => handleJournalFilter('All')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                  selectedJournal === 'All' 
                    ? 'bg-slate-900 text-white shadow-lg' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                모든 저널
              </button>
              {(Object.keys(JOURNALS) as JournalName[]).map((name) => (
                <button
                  key={name}
                  onClick={() => handleJournalFilter(name)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                    selectedJournal === name 
                      ? 'text-white shadow-lg' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                  style={selectedJournal === name ? { backgroundColor: JOURNALS[name].color } : {}}
                >
                  {JOURNALS[name].shortName}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-12 p-6 bg-red-50 border border-red-100 rounded-[2rem] flex items-center space-x-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-grow">
                <h4 className="text-red-900 font-black text-sm uppercase tracking-widest">Access Error</h4>
                <p className="text-red-700 text-sm font-medium mt-1">{error}</p>
                <div className="mt-2 text-[10px] text-red-500 font-mono opacity-50 flex flex-col space-y-1">
                  <div>{new Date().toLocaleTimeString()} | {window.location.hostname}</div>
                  {error.includes('API key') && (
                    <div className="bg-red-100/50 p-1 rounded">
                      Detected Key: {process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.slice(0, 4)}...${process.env.GEMINI_API_KEY.slice(-4)}` : 'Not Found'}
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={() => viewMode === 'live' ? loadPapers(selectedJournal === 'All' ? undefined : selectedJournal) : loadWeeklyList()}
                className="px-6 py-2 bg-red-600 text-white text-[10px] font-black rounded-xl hover:bg-red-700 transition-all uppercase tracking-widest"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-40 space-y-8">
              <div className="relative">
                <div className="w-24 h-24 border-8 border-slate-100 rounded-full"></div>
                <div className="absolute top-0 left-0 w-24 h-24 border-8 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="text-center animate-pulse">
                <p className="text-slate-900 font-black text-2xl tracking-tight">PubMed 라이브 동기화 중...</p>
                <p className="text-slate-400 text-sm mt-2 font-medium">상위 저널의 신규 논문을 AI가 분석하고 있습니다.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {papers.map((paper) => (
                  <PaperCard 
                    key={paper.id} 
                    paper={paper} 
                  />
                ))}
              </div>

              {papers.length === 0 && (
                <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                      <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                  </div>
                  <p className="text-slate-900 font-black text-2xl">검색된 연구가 없습니다.</p>
                  <p className="text-slate-400 text-sm mt-2 font-medium">최근 14일간 해당 저널에 등재된 신규 논문이 없습니다.</p>
                  <button 
                    onClick={() => handleJournalFilter('All')}
                    className="mt-10 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
                  >
                    모든 소스 확인하기
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="bg-slate-900 px-8 py-12 md:px-16 text-white text-center relative">
              <h3 className="text-3xl font-black mb-4">주간 출간 리스트</h3>
              <p className="text-slate-400 font-medium">
                {weekRange.start.toLocaleDateString()} ~ {weekRange.end.toLocaleDateString()}
              </p>
              <div className="mt-6 flex flex-col items-center space-y-3">
                <div className="inline-flex items-center px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-full text-blue-400 text-xs font-black uppercase tracking-widest">
                  Last 7 Days Research
                </div>
                <p className="text-[10px] text-slate-500 font-bold">
                  * 매주 월요일에 지난 한 주(월-일)의 전체 리스트가 확정되어 업데이트됩니다.
                </p>
              </div>
            </div>
            
            <div className="p-8 md:p-12">
              {error && (
                <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-[2rem] flex items-center space-x-4">
                  <div className="flex-grow">
                    <h4 className="text-red-900 font-black text-sm uppercase tracking-widest">Access Error</h4>
                    <p className="text-red-700 text-sm font-medium mt-1">{error}</p>
                    <div className="mt-2 text-[10px] text-red-500 font-mono opacity-50 flex flex-col space-y-1">
                      <div>{new Date().toLocaleTimeString()} | {window.location.hostname}</div>
                      {error.includes('API key') && (
                        <div className="bg-red-100/50 p-1 rounded">
                          Detected Key: {process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.slice(0, 4)}...${process.env.GEMINI_API_KEY.slice(-4)}` : 'Not Found'}
                        </div>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={loadWeeklyList}
                    className="px-6 py-2 bg-red-600 text-white text-[10px] font-black rounded-xl hover:bg-red-700 transition-all uppercase tracking-widest"
                  >
                    Retry
                  </button>
                </div>
              )}
              
              {isWeeklyLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-8">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-900 font-black text-xl">지난 한 주간의 데이터를 수집 중입니다...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Journal</th>
                        <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Title</th>
                        <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyPapers.map((paper) => (
                        <tr key={paper.id} className="group hover:bg-slate-50 transition-colors border-b border-slate-50">
                          <td className="py-6 px-4">
                            <span 
                              className="inline-block px-3 py-1 rounded-lg text-[10px] font-black text-white whitespace-nowrap"
                              style={{ backgroundColor: JOURNALS[paper.journal]?.color || '#64748b' }}
                            >
                              {JOURNALS[paper.journal]?.shortName || paper.journal}
                            </span>
                          </td>
                          <td className="py-6 px-4">
                            <a 
                              href={paper.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-slate-900 font-bold text-sm hover:text-blue-600 transition-colors line-clamp-2 leading-snug"
                            >
                              {paper.title}
                            </a>
                            <div className="mt-1 text-[10px] text-slate-400 font-medium">
                              {paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ' et al.' : ''}
                            </div>
                          </td>
                          <td className="py-6 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 uppercase tracking-wider">
                              {paper.category}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {weeklyPapers.length === 0 && !isWeeklyLoading && (
                        <tr>
                          <td colSpan={3} className="py-20 text-center text-slate-400 font-medium">
                            지난 한 주간 발표된 연구가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
