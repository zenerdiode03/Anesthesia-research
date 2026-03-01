
import React, { useState, useEffect } from 'react';
import { Podcast } from '../types';
import { Mic, Play, Pause, Upload, Lock, X, Music, Calendar, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const PodcastSection: React.FC = () => {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audio] = useState(new Audio());

  const fetchPodcasts = async () => {
    try {
      const res = await fetch('/api/podcasts');
      const data = await res.json();
      setPodcasts(data);
    } catch (err) {
      console.error('Failed to fetch podcasts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPodcasts();
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const togglePlay = (podcast: Podcast) => {
    if (playingId === podcast.id) {
      audio.pause();
      setPlayingId(null);
    } else {
      audio.src = podcast.audioUrl;
      audio.play();
      setPlayingId(podcast.id);
    }
  };

  audio.onended = () => setPlayingId(null);

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <Mic className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">마취사냥꾼의 논문 픽!</h3>
          </div>
          <p className="text-slate-500 text-sm font-medium mt-2">마취통증의학 주요 논문을 음성으로 쉽고 빠르게 들어보세요.</p>
        </div>
        
        <button 
          onClick={() => setShowAdmin(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-black hover:bg-slate-200 transition-all"
        >
          <Lock className="w-4 h-4" />
          <span>관리자 업로드</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-slate-100 border-t-red-600 rounded-full animate-spin"></div>
        </div>
      ) : podcasts.length === 0 ? (
        <div className="bg-white rounded-[3rem] border-2 border-dashed border-slate-100 py-32 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
            <Music className="w-10 h-10 text-slate-200" />
          </div>
          <p className="text-slate-900 font-black text-xl">아직 등록된 팟캐스트가 없습니다.</p>
          <p className="text-slate-400 text-sm mt-2 font-medium">관리자가 첫 번째 에피소드를 업로드할 때까지 기다려주세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {podcasts.map((p) => (
            <motion.div 
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-200/80 transition-all group"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <Music className="w-7 h-7 text-red-500" />
                </div>
                <button 
                  onClick={() => togglePlay(p)}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                    playingId === p.id 
                    ? 'bg-red-600 text-white shadow-red-200' 
                    : 'bg-slate-900 text-white shadow-slate-200 hover:bg-red-600'
                  }`}
                >
                  {playingId === p.id ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                </button>
              </div>
              
              <h4 className="text-xl font-black text-slate-900 mb-3 line-clamp-2 leading-tight">{p.title}</h4>
              <p className="text-slate-500 text-sm font-medium mb-6 line-clamp-3 leading-relaxed">{p.description}</p>
              
              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <div className="flex items-center space-x-2 text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {new Date(p.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                {p.duration && (
                  <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-lg">
                    {p.duration}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAdmin && (
          <AdminUploadModal 
            onClose={() => setShowAdmin(false)} 
            onSuccess={() => {
              setShowAdmin(false);
              fetchPodcasts();
            }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminUploadModal: React.FC<{ onClose: () => void, onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError('음성 파일을 선택해주세요.');
    if (!password) return setError('비밀번호를 입력해주세요.');

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('audio', file);
    formData.append('password', password);
    formData.append('title', title);
    formData.append('description', description);

    try {
      const res = await fetch('/api/podcasts/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || '업로드 실패');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
      >
        <div className="bg-slate-900 p-8 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Upload className="w-6 h-6 text-red-500" />
            <h4 className="text-xl font-black">팟캐스트 에피소드 업로드</h4>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-10 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">에피소드 제목</label>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2024년 2월 4주차 주요 논문 요약"
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-red-500 transition-all"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">상세 설명</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="에피소드에 대한 간략한 설명을 입력하세요."
              rows={3}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-red-500 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">음성 파일 (MP3, WAV, M4A)</label>
              <div className="relative">
                <input 
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="audio-upload"
                  required
                />
                <label 
                  htmlFor="audio-upload"
                  className="flex items-center justify-center w-full px-6 py-4 bg-red-50 text-red-600 rounded-2xl font-black cursor-pointer hover:bg-red-100 transition-all border-2 border-dashed border-red-200"
                >
                  {file ? file.name.slice(0, 15) + '...' : '파일 선택'}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">관리자 비밀번호</label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-red-500 transition-all"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold flex items-center space-x-2">
              <Info className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit"
            disabled={uploading}
            className={`w-full py-5 rounded-2xl font-black text-lg shadow-xl transition-all ${
              uploading 
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
              : 'bg-red-600 text-white hover:bg-red-700 shadow-red-200'
            }`}
          >
            {uploading ? '업로드 중...' : '에피소드 발행하기'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default PodcastSection;
