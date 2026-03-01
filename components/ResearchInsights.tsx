
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchKeywordInsights } from '../services/geminiService';
import { TrendingUp, Info, RefreshCw, BarChart3 } from 'lucide-react';

const ResearchInsights: React.FC = () => {
  const [data, setData] = useState<{ keyword: string, count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (force) localStorage.removeItem('keyword_insights_cache_v2_3months');
      const insights = await fetchKeywordInsights();
      setData(insights.slice(0, 10)); // Top 10
    } catch (err: any) {
      setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const COLORS = [
    '#1e3a8a', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', 
    '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff', '#f8fafc'
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">연구 트렌드 인사이트</h3>
          </div>
          <p className="text-slate-500 text-sm font-medium mt-2">지난 3개월간 17개 주요 저널에서 출간된 전체 논문을 분석한 핵심 키워드 Top 10입니다.</p>
        </div>
        
        <button 
          onClick={() => loadInsights(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-black hover:bg-slate-200 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>데이터 갱신</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-[3rem] border border-slate-100 p-20 flex flex-col items-center justify-center space-y-6 shadow-xl shadow-slate-200/50">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-center">
            <p className="text-slate-900 font-black text-xl">지난 3개월간의 전체 연구 데이터를 분석 중입니다...</p>
            <p className="text-slate-400 text-sm mt-2 font-medium">PubMed에서 수백 개의 논문을 수집하여 트렌드를 도출합니다.</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-[3rem] p-12 text-center">
          <Info className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h4 className="text-red-900 font-black text-xl mb-2">분석 오류</h4>
          <p className="text-red-700 font-medium">{error}</p>
          <button 
            onClick={() => loadInsights(true)}
            className="mt-6 px-8 py-3 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition-all"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                <h4 className="text-xl font-black text-slate-900">키워드 빈도 분석</h4>
              </div>
              <div className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest">
                Top 10 Keywords
              </div>
            </div>
            
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="keyword" 
                    type="category" 
                    axisLine={false}
                    tickLine={false}
                    width={150}
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      padding: '12px 16px'
                    }}
                    itemStyle={{ fontWeight: 800, color: '#1e3a8a' }}
                  />
                  <Bar 
                    dataKey="count" 
                    radius={[0, 8, 8, 0]} 
                    barSize={32}
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-xl shadow-slate-900/20">
              <h4 className="text-xl font-black mb-6">인사이트 요약</h4>
              <ul className="space-y-6">
                {data.slice(0, 3).map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 font-black text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-black text-lg leading-tight">{item.keyword}</p>
                      <p className="text-slate-400 text-xs mt-1 font-medium">
                        분석된 논문 중 {item.count}건에서 주요 주제로 다뤄졌습니다.
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-10 pt-8 border-t border-white/10">
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  * 이 데이터는 최근 3개월간 모니터링 중인 17개 저널의 전체 출간 논문을 기반으로 AI가 분석한 결과입니다. 
                  임상 현장의 최신 관심사를 반영합니다.
                </p>
              </div>
            </div>

            <div className="bg-blue-50 rounded-[3rem] p-10 border border-blue-100">
              <h4 className="text-lg font-black text-blue-900 mb-4">데이터 수집 범위</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700 font-bold">분석 기간</span>
                  <span className="text-blue-900 font-black">최근 90일</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700 font-bold">대상 저널</span>
                  <span className="text-blue-900 font-black">17개 주요 저널</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700 font-bold">샘플 규모</span>
                  <span className="text-blue-900 font-black">전체 출간 논문</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchInsights;
