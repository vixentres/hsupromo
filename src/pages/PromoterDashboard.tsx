import React, { useState, useEffect } from 'react';
import { Copy, Folder, CheckCircle, ExternalLink, ShieldCheck, ToggleLeft, ToggleRight, LogOut, Clock } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase, getCountdown, type Tarea, type Revision, type EstadoColor } from '../lib/supabase';

const STATUS_STYLE: Record<EstadoColor, { card: string; badge: string; label: string }> = {
  rojo:    { card: 'bg-red-900/20 border-red-500/30',     badge: 'bg-red-500',    label: 'Misión Pendiente' },
  amarillo:{ card: 'bg-yellow-900/20 border-yellow-500/30', badge: 'bg-yellow-500', label: 'Esperando Confirmación' },
  verde:   { card: 'bg-green-900/20 border-green-500/30',  badge: 'bg-green-500',  label: '✓ Misión Aprobada' },
  morado:  { card: 'bg-purple-900/20 border-purple-500/30',badge: 'bg-purple-500', label: 'Auditor Leal' },
  naranja: { card: 'bg-orange-900/20 border-orange-500/30',badge: 'bg-orange-400', label: 'Justificado' },
};

export default function PromoterDashboard() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [asignados, setAsignados] = useState<any[]>([]);
  const [linkMode, setLinkMode] = useState<'perfil' | 'historias'>('historias');
  const [loadingData, setLoadingData] = useState(true);
  const [countdown, setCountdown] = useState('');
  const [copied, setCopied] = useState(false);
  const [materialUrl, setMaterialUrl] = useState('');

  useEffect(() => {
    if (!loading && !user) navigate('/promotor/login');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user]);

  // Cuenta regresiva de la tarea (24h desde created_at)
  useEffect(() => {
    if (!tarea) return;
    const deadline = new Date(new Date(tarea.created_at!).getTime() + tarea.horas_duracion * 3600000);
    const tick = () => setCountdown(getCountdown(deadline));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [tarea]);

  const loadDashboard = async () => {
    setLoadingData(true);
    const today = new Date().toISOString().split('T')[0];

    // Config para material RRSS
    const { data: cfg } = await supabase.from('config').select('material_nuevo_url').eq('id', 1).single();
    if (cfg) setMaterialUrl(cfg.material_nuevo_url || '');

    // Tarea activa del día
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
      const uid = (user as any).id;

      // Mi submission (self row)
      const { data: myRev } = await supabase
        .from('revisiones')
        .select('*')
        .eq('tarea_id', tareaData.id)
        .eq('promotor_id', uid)
        .eq('auditor_id', uid)
        .maybeSingle();

      setRevision(myRev);

      // A quién audito yo (filas donde soy auditor pero no es self)
      const { data: revAuditor } = await supabase
        .from('revisiones')
        .select('*, promotores!revisiones_promotor_id_fkey(id, nombre, instagram)')
        .eq('tarea_id', tareaData.id)
        .eq('auditor_id', uid)
        .neq('promotor_id', uid);

      setAsignados(revAuditor || []);
    }
    setLoadingData(false);
  };

  const marcarPublicado = async () => {
    if (!tarea || !user) return;
    const uid = (user as any).id;
    const { data } = await supabase
      .from('revisiones')
      .update({ submission_status: 'amarillo' })
      .eq('tarea_id', tarea.id)
      .eq('promotor_id', uid)
      .eq('auditor_id', uid)
      .select().single();
    if (data) setRevision(data);
  };

  const votar = async (revisionId: string, voto: 'SI' | 'NO' | 'JUSTIFICADO') => {
    await supabase.from('revisiones').update({ voto }).eq('id', revisionId);
    loadDashboard();
  };

  const handleLogout = () => { logout(); navigate('/promotor/login'); };

  const copyLink = async () => {
    if (!user) return;
    const url = `${window.location.origin}/?ref=${(user as any).instagram}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getInstagramUrl = (ig: string) =>
    linkMode === 'historias'
      ? `https://www.instagram.com/stories/${ig}/`
      : `https://www.instagram.com/${ig}/`;

  const myStatus: EstadoColor = revision?.admin_override || revision?.submission_status || 'rojo';
  const style = STATUS_STYLE[myStatus];
  const isExpired = countdown === 'Expirado';

  if (loading || !user) return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950">
      <div className="flex gap-2 items-center text-gray-500 text-sm">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        Cargando perfil...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Nav */}
      <nav className="border-b border-white/8 bg-neutral-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between">
          <div>
            <span className="font-black text-sm">HSU Promotores</span>
            <span className="text-gray-600 text-xs ml-2">/ {(user as any).nombre}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={copyLink}
              className="bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/8">
              <Copy size={12} /> {copied ? '✓ Copiado' : 'Mi Link'}
            </button>
            <button onClick={handleLogout}
              className="bg-red-900/40 hover:bg-red-800/50 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-red-500/20">
              <LogOut size={12} /> Salir
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-5 py-8">
        <div className="mb-7">
          <h1 className="text-2xl font-black tracking-tight">Panel de Misiones</h1>
          <p className="text-gray-500 text-sm mt-1">Hola, <span className="text-white font-semibold">{(user as any).nombre}</span> — aquí están tus tareas del día</p>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-20 text-gray-600 text-sm">Cargando datos del día...</div>
        ) : !tarea ? (
          <div className="bg-neutral-900 border border-white/8 rounded-2xl p-12 text-center">
            <Clock size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 font-semibold">No hay tarea activa para hoy</p>
            <p className="text-gray-600 text-xs mt-1">El administrador publicará la misión pronto.</p>
          </div>
        ) : (
          <>
            {/* ── MI TAREA ────────────────────────────────────────── */}
            <div className={`border rounded-2xl p-6 mb-6 transition-all ${style.card}`}>
              <div className="flex justify-between items-start gap-4 mb-5">
                <div className="flex-1">
                  <span className={`text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full mb-3 inline-block ${style.badge}`}>
                    {style.label}
                  </span>
                  <h2 className="text-xl font-bold mt-1 leading-snug">{tarea.titulo}</h2>

                  {/* Cuenta regresiva */}
                  <div className="flex items-center gap-2 mt-3">
                    <Clock size={14} className={isExpired ? 'text-red-400' : 'text-gray-400'} />
                    <span className="text-xs text-gray-500">Tiempo restante:</span>
                    <span className={`font-mono font-bold text-sm ${isExpired ? 'text-red-400' : myStatus === 'rojo' ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {countdown || '...'}
                    </span>
                  </div>
                </div>

                {/* Botón publicar */}
                {myStatus === 'rojo' && !isExpired && (
                  <button
                    onClick={marcarPublicado}
                    className="flex-shrink-0 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 text-sm transition-all shadow-lg shadow-red-900/30"
                  >
                    <CheckCircle size={16} />
                    Ya lo subí a mis Stories
                  </button>
                )}
                {myStatus === 'amarillo' && (
                  <div className="flex-shrink-0 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold px-4 py-2 rounded-xl">
                    Publicado ✓<br />
                    <span className="text-[10px] font-normal text-yellow-600">Esperando auditores</span>
                  </div>
                )}
                {(myStatus === 'verde' || myStatus === 'morado' || myStatus === 'naranja') && (
                  <div className="flex-shrink-0 text-center">
                    <span className={`text-2xl`}>{myStatus === 'verde' ? '🟢' : myStatus === 'morado' ? '🟣' : '🟠'}</span>
                  </div>
                )}
              </div>

              {/* Botón material RRSS */}
              {materialUrl && (
                <a
                  href={materialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold py-3 rounded-xl text-sm transition-all"
                >
                  <Folder size={16} />
                  Ver Material RRSS
                </a>
              )}
            </div>

            {/* ── EXPLICACIÓN DEL ESTADO ──────────────────────────── */}
            <div className="bg-neutral-900/60 border border-white/5 rounded-xl px-5 py-4 mb-6 text-xs text-gray-500 leading-relaxed">
              {myStatus === 'rojo' && '🔴 Todavía no has marcado tu publicación como realizada. Sube el banner en tus Stories y presiona "Ya lo subí a mis Stories" para avanzar.'}
              {myStatus === 'amarillo' && '🟡 Marcaste tu publicación como realizada. Tus auditores asignados aún no han verificado si realmente está en tu Instagram. Una vez que voten "SÍ", pasarás a Verde.'}
              {myStatus === 'verde' && '🟢 ¡Misión cumplida! Publicaste y tus auditores confirmaron que está en tu Instagram. ¡Excelente!'}
              {myStatus === 'morado' && '🟣 Hiciste tu publicación correctamente y cumpliste auditando a tus compañeros. Si uno de ellos no publicó y votaste "NO", estás protegido — eres un Auditor Leal.'}
              {myStatus === 'naranja' && '🟠 Tu caso fue marcado como Justificado internamente. No se aplica penalización.'}
            </div>

            {/* ── AUDITORÍAS ──────────────────────────────────────── */}
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
                  {linkMode === 'historias' ? 'Ver Stories' : 'Ver Perfil'}
                </button>
              </div>

              {asignados.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-6">No tienes asignaciones de auditoría para esta tarea.</p>
              ) : (
                <div className="space-y-3">
                  {asignados.map((asig) => {
                    const promotor = asig.promotores;
                    return (
                      <div key={asig.id} className="bg-neutral-950 border border-white/8 p-4 rounded-xl">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-bold mb-1">Debes revisar a:</p>
                            <a
                              href={getInstagramUrl(promotor?.instagram)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-white hover:text-blue-400 flex items-center gap-1.5 transition-colors"
                            >
                              @{promotor?.instagram} <ExternalLink size={12} />
                            </a>
                            <p className="text-gray-600 text-xs mt-0.5">{promotor?.nombre}</p>
                          </div>
                          <div className="flex bg-neutral-900 rounded-xl p-1 border border-white/8 gap-0.5">
                            {(['SI', 'NO', 'JUSTIFICADO'] as const).map(v => {
                              const active = asig.voto === v;
                              const styles: Record<string, string> = {
                                SI: active ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/50' : 'text-gray-400 hover:text-green-400',
                                NO: active ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/50' : 'text-gray-400 hover:text-red-400',
                                JUSTIFICADO: active ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/50' : 'text-gray-400 hover:text-orange-400',
                              };
                              const labels: Record<string, string> = { SI: '✅ SÍ', NO: '❌ NO', JUSTIFICADO: '⏸ Just.' };
                              return (
                                <button key={v} onClick={() => votar(asig.id, v)}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${styles[v]}`}>
                                  {labels[v]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {asig.voto !== 'PENDIENTE' && (
                          <p className="text-[10px] text-gray-600 mt-2">
                            Votaste: <span className="font-bold text-gray-400">{asig.voto}</span> — podés cambiar tu voto antes de que expire la tarea.
                          </p>
                        )}
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
