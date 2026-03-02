
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Hash, Info } from 'lucide-react';

interface KeywordData {
  text: string;
  count: number;
}

const KeywordAnalysisSection: React.FC = () => {
  const [data, setData] = useState<KeywordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchKeywords = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/research/keywords');
        if (response.ok) {
          const result = await response.json();
          setData(result);
        } else {
          setError('데이터를 불러오는 중 오류가 발생했습니다. (HTTP ' + response.status + ')');
        }
      } catch (err) {
        console.error('Failed to fetch keyword analysis:', err);
        setError('서버와 통신하는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchKeywords();
  }, []);

  const COLORS = [
    '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a',
    '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff'
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 font-bold">지난 2년간의 대규모 연구 트렌드를 분석 중입니다...</p>
        <p className="text-slate-300 text-xs">약 30~60초 정도 소요될 수 있습니다.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <Info className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-slate-600 font-bold">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
        >
          다시 시도하기
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
          <Hash className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-slate-400 font-bold">분석된 키워드가 없습니다.</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
        >
          새로고침
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Hash className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">연구 키워드 트렌드</h3>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-black text-blue-700 uppercase tracking-widest flex items-center">
            <Info className="w-4 h-4 mr-2" />
            분석 방법론 (Advanced Bibliometric Analysis)
          </h4>
          <ul className="text-[13px] text-blue-900/70 font-medium space-y-1.5 list-disc list-inside">
            <li><span className="font-bold text-blue-900">1단계:</span> 비본질적 MeSH 용어(Humans, Adult, Study Design 등) 필터링 및 제거</li>
            <li><span className="font-bold text-blue-900">2단계:</span> MeSH Major Topic(핵심 주제어) 및 Subheading(세부 맥락) 가중치 분석</li>
            <li><span className="font-bold text-blue-900">3단계:</span> Gemini AI를 이용한 제목/초록 기반 최신 임상 키워드(약물, 기법, 결과) 추출 병행</li>
            <li><span className="font-bold text-blue-900">업데이트:</span> 6개월마다 갱신 (지난 2년간의 Original Article 300+건 전수 분석)</li>
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm overflow-hidden">
        <div className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="text" 
                type="category" 
                width={220} // Increased width for single-line labels
                tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  padding: '12px'
                }}
                labelStyle={{ fontWeight: 800, marginBottom: '4px', color: '#1e293b' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={32}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
                <LabelList 
                  dataKey="count" 
                  position="right" 
                  style={{ fill: '#64748b', fontSize: '11px', fontWeight: 800 }} 
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {data.map((item, index) => (
          <div key={index} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col items-center text-center space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rank {index + 1}</span>
            <span className="text-sm font-black text-slate-900 line-clamp-1">{item.text}</span>
            <span className="text-xs font-bold text-blue-600">{item.count} articles</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeywordAnalysisSection;
