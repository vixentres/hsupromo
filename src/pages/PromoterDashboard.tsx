import React, { useState, useEffect } from 'react';
import { Copy, Folder, FolderOpen, CheckCircle, ExternalLink, ShieldCheck, ToggleLeft, ToggleRight, LogOut } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase, type Tarea, type Revision } from '../lib/supabase';

export default function PromoterDashboard() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [asignados, setAsignados] = useState<any[]>([]);
  const [linkMode, setLinkMode] = useState<'perfil' | 'historias'>('historias');
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate('/promotor/login');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    setLoadingData(true);
    const today = new Date().toISOString().split('T')[0];

    // Cargar tarea activa del día
    const { data: tareaData } = await supabase
      .from('tareas')
      .select('*')
      .eq('activa', true)
      .eq('fecha_tarea', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setTarea(tareaData);

    if (tareaData && user) {
      // Cargar mi revisión (como promotor que tiene que entregar)
      const { data: myRev } = await supabase
        .from('revisiones')
        .select('*')
        .eq('tarea_id', tareaData.id)
        .eq('promotor_id', (user as any).id)
        .maybeSingle();

      setRevision(myRev);

      // Cargar a quién me tocó auditar (donde soy el auditor)
      const { data: revAuditor } = await supabase
        .from('revisiones')
        .select('*, promotores!revisiones_promotor_id_fkey(id, nombre, instagram)')
        .eq('tarea_id', tareaData.id)
        .eq('auditor_id', (user as any).id);

      setAsignados(revAuditor || []);
    }
    setLoadingData(false);
  };

  const marcarPublicado = async () => {
    if (!tarea || !user) return;
    const { data } = await supabase
      .from('revisiones')
      .update({ submission_status: 'amarillo' })
      .eq('tarea_id', tarea.id)
      .eq('promotor_id', (user as any).id)
      .select()
      .single();
    if (data) setRevision(data);
  };

  const votar = async (revisionId: string, voto: 'SI' | 'NO' | 'JUSTIFICADO') => {
    await supabase.from('revisiones').update({ voto }).eq('id', revisionId);
    loadDashboard();
  };

  const handleLogout = () => { logout(); navigate('/promotor/login'); };

  const getInstagramUrl = (ig: string) =>
    linkMode === 'historias' ? `https://www.instagram.com/stories/${ig}/` : `https://www.instagram.com/${ig}/`;

  const copyLink = () => {
    if (!user) return;
    const url = `${window.location.origin}/?ref=${(user as any).instagram}`;
    navigator.clipboard.writeText(url);
  };

  const statusColor: Record<string, string> = {
    rojo: 'bg-red-500/20 border-red-500/30',
    amarillo: 'bg-yellow-500/20 border-yellow-500/30',
    verde: 'bg-green-500/20 border-green-500/30',
    morado: 'bg-purple-500/20 border-purple-500/30',
    naranja: 'bg-orange-500/20 border-orange-500/30',
  };

  const statusBadge: Record<string, string> = {
    rojo: 'bg-red-500',
    amarillo: 'bg-yellow-500',
    verde: 'bg-green-500',
    morado: 'bg-purple-500',
    naranja: 'bg-orange-500',
  };

  const statusLabel: Record<string, string> = {
    rojo: 'Misión Pendiente',
    amarillo: 'Esperando Confirmación',
    verde: 'Misión Aprobada ✓',
    morado: 'Auditor Leal',
    naranja: 'Justificado',
  };

  const myStatus = revision?.admin_override || revision?.submission_status || 'rojo';

  if (loading || !user) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex gap-2 items-center text-gray-400">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        Cargando perfil...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Top Nav */}
      <nav className="border-b border-white/8 bg-neutral-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <span className="font-black text-sm tracking-tight">HSU Promotores</span>
            <span className="text-gray-500 text-xs ml-2">/ {(user as any).nombre}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={copyLink} className="bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/8">
              <Copy size={13} /> Mi Link
            </button>
            <button onClick={handleLogout} className="bg-red-900/40 hover:bg-red-800/50 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-red-500/20">
              <LogOut size={13} /> Salir
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-tight">Panel de Misiones</h1>
          <p className="text-gray-500 text-sm mt-1">Sigue tu progreso y audita a tus compañeros</p>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-20 text-gray-600">Cargando datos del día...</div>
        ) : !tarea ? (
          <div className="bg-neutral-900 border border-white/8 rounded-2xl p-12 text-center">
            <p className="text-gray-500 text-sm">No hay tarea activa para hoy.</p>
            <p className="text-gray-600 text-xs mt-1">El administrador publicará la misión del día pronto.</p>
          </div>
        ) : (
          <>
            {/* MI TAREA */}
            <div className={`border rounded-2xl p-6 mb-6 transition-all ${statusColor[myStatus] || statusColor.rojo}`}>
              <div className="flex justify-between items-start mb-5">
                <div className="flex-1">
                  <span className={`text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full mb-3 inline-block ${statusBadge[myStatus]}`}>
                    {statusLabel[myStatus]}
                  </span>
                  <h2 className="text-xl font-bold mt-1">{tarea.titulo}</h2>
                  <p className="text-gray-400 text-sm mt-1.5">
                    Duración: <span className="text-white font-mono">{tarea.horas_duracion}h</span>
                  </p>
                </div>
                <button
                  onClick={marcarPublicado}
                  disabled={myStatus !== 'rojo'}
                  className={`ml-4 font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 text-sm transition-all ${
                    myStatus === 'rojo'
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30'
                      : 'bg-neutral-800 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle size={16} />
                  {myStatus === 'rojo' ? 'Marcar Publicado' : 'Publicado'}
                </button>
              </div>

              <div className="flex gap-3">
                {tarea.material_nuevo && (
                  <a href={tarea.material_nuevo} target="_blank" rel="noopener noreferrer"
                    className="flex-1 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors">
                    <Folder size={16} /> Material Nuevo
                  </a>
                )}
                {tarea.material_historico && (
                  <a href={tarea.material_historico} target="_blank" rel="noopener noreferrer"
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors">
                    <FolderOpen size={16} /> Histórico
                  </a>
                )}
              </div>
            </div>

            {/* AUDITORÍAS */}
            <div className="bg-neutral-900 border border-white/8 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h2 className="font-black flex items-center gap-2 text-lg">
                    <ShieldCheck size={18} className="text-blue-400" /> Auditorías Asignadas
                  </h2>
                  <p className="text-gray-500 text-xs mt-0.5">Revisa a tus compañeros para completar la misión al 100%</p>
                </div>
                <button
                  onClick={() => setLinkMode(p => p === 'perfil' ? 'historias' : 'perfil')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                >
                  {linkMode === 'historias' ? <ToggleRight size={18} className="text-blue-400" /> : <ToggleLeft size={18} className="text-gray-600" />}
                  {linkMode === 'historias' ? 'Historias' : 'Perfil'}
                </button>
              </div>

              {asignados.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-6">No tienes asignaciones de auditoría aún.</p>
              ) : (
                <div className="space-y-3">
                  {asignados.map((asig) => {
                    const promotor = asig.promotores;
                    return (
                      <div key={asig.id} className="bg-neutral-950 border border-white/8 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-bold mb-1">Asignado</p>
                          <a href={getInstagramUrl(promotor?.instagram)} target="_blank" rel="noopener noreferrer"
                            className="font-bold text-white hover:text-blue-400 flex items-center gap-1.5 transition-colors">
                            @{promotor?.instagram} <ExternalLink size={12} />
                          </a>
                        </div>
                        <div className="flex bg-neutral-900 rounded-xl p-1 border border-white/8 gap-0.5">
                          <button
                            onClick={() => votar(asig.id, 'SI')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${asig.voto === 'SI' ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-green-400'}`}>
                            ✅ SÍ
                          </button>
                          <button
                            onClick={() => votar(asig.id, 'NO')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${asig.voto === 'NO' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-red-400'}`}>
                            ❌ NO
                          </button>
                          <button
                            onClick={() => votar(asig.id, 'JUSTIFICADO')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${asig.voto === 'JUSTIFICADO' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-orange-400'}`}>
                            ⏸️ Justificado
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
