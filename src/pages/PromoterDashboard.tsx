import React, { useState, useEffect } from 'react';
import { Copy, Folder, ExternalLink, ShieldCheck, ToggleLeft, ToggleRight, LogOut, Clock, Link as LinkIcon, RefreshCw, Megaphone } from 'lucide-react';
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

export default function PromoterDashboard({ impersonatedUser, onExitImpersonation, allowSwitchEdit }: {
  impersonatedUser?: any;
  onExitImpersonation?: () => void;
  allowSwitchEdit?: boolean;
}) {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  const actualUser = impersonatedUser || user;
  const isVendedor = (actualUser as any)?.rol === 'vendedor';
  const isAdminViewingAs = !!impersonatedUser;

  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [asignados, setAsignados] = useState<any[]>([]);
  const [incomingAudits, setIncomingAudits] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [linkMode, setLinkMode] = useState<'perfil' | 'historias'>('historias');
  const [loadingData, setLoadingData] = useState(true);
  const [countdown, setCountdown] = useState('');
  const [revCountdown, setRevCountdown] = useState('');
  const [copied, setCopied] = useState(false);
  const [materialUrl, setMaterialUrl] = useState('');

  useEffect(() => {
    if (!loading && !user) navigate('/promotor/login');
  }, [user, loading, navigate]);

  const TODAY = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(TODAY);

  useEffect(() => {
    if (actualUser) loadInitialData();
  }, [actualUser]);

  useEffect(() => {
    if (actualUser) loadTaskForDate(selectedDate);
  }, [selectedDate, actualUser]);

  // Doble cuenta regresiva
  useEffect(() => {
    if (!tarea) { setCountdown(''); setRevCountdown(''); return; }
    const created = new Date(tarea.created_at || tarea.fecha_tarea + 'T10:00:00Z');
    const deadline = new Date(created.getTime() + (tarea.horas_duracion || 24) * 3600000);
    const revHours = tarea.horas_revision || 0;
    const revStart = revHours > 0 ? new Date(deadline.getTime() - revHours * 3600000) : null;

    const tick = () => {
      const now = Date.now();
      // Main countdown
      const diff = deadline.getTime() - now;
      if (diff <= 0) { setCountdown('Expirado'); }
      else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      }
      // Rev window countdown
      if (revStart) {
        const rd = revStart.getTime() - now;
        if (rd <= 0) {
          // Revision window is open — show time until task expires
          const left = deadline.getTime() - now;
          if (left <= 0) setRevCountdown('Cerrado');
          else {
            const h = Math.floor(left / 3600000);
            const m = Math.floor((left % 3600000) / 60000);
            const s = Math.floor((left % 60000) / 1000);
            setRevCountdown(`Revisando — ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
          }
        } else {
          const h = Math.floor(rd / 3600000);
          const m = Math.floor((rd % 3600000) / 60000);
          const s = Math.floor((rd % 60000) / 1000);
          setRevCountdown(`Revisión en ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
        }
      } else { setRevCountdown(''); }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [tarea]);

  const loadInitialData = async () => {
    const { data: cfg } = await supabase.from('config').select('material_nuevo_url').eq('id', 1).single();
    if (cfg) setMaterialUrl(cfg.material_nuevo_url || '');

    if (actualUser) {
      const uid = (actualUser as any).id;
      const { data: hist } = await supabase
        .from('revisiones')
        .select('submission_status, admin_override, tareas!inner(fecha_tarea, activa)')
        .eq('promotor_id', uid).eq('auditor_id', uid)
        .order('tareas(fecha_tarea)', { ascending: true });
      setHistory(hist || []);
    }
  };

  const loadTaskForDate = async (date: string) => {
    setLoadingData(true);
    const { data: tareaData } = await supabase
      .from('tareas').select('*').eq('fecha_tarea', date)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    setTarea(tareaData);

    if (tareaData && actualUser) {
      const uid = (actualUser as any).id;

      // My submission
      const { data: myRev } = await supabase
        .from('revisiones').select('*')
        .eq('tarea_id', tareaData.id).eq('promotor_id', uid).eq('auditor_id', uid).maybeSingle();
      setRevision(myRev);

      if (!isVendedor) {
        // A quién audito yo (solo promotores)
        const { data: revAuditor } = await supabase
          .from('revisiones')
          .select('*, promotores!revisiones_promotor_id_fkey(id, nombre, instagram)')
          .eq('tarea_id', tareaData.id).eq('auditor_id', uid).neq('promotor_id', uid);

        if (revAuditor && revAuditor.length > 0) {
          const targetIds = revAuditor.map(r => r.promotor_id);
          const { data: selfRows } = await supabase
            .from('revisiones').select('promotor_id, auditor_id, submission_status')
            .eq('tarea_id', tareaData.id).in('promotor_id', targetIds);
          const selfStatusMap = new Map();
          selfRows?.forEach(r => { if (r.promotor_id === r.auditor_id) selfStatusMap.set(r.promotor_id, r.submission_status); });
          setAsignados(revAuditor.map(r => ({ ...r, target_published: selfStatusMap.get(r.promotor_id) !== 'rojo' })));
        } else { setAsignados([]); }

        // Quién me audita a mí
        const { data: incAud } = await supabase
          .from('revisiones').select('voto')
          .eq('tarea_id', tareaData.id).eq('promotor_id', uid).neq('auditor_id', uid);
        setIncomingAudits(incAud || []);
      } else {
        setAsignados([]);
        setIncomingAudits([]);
      }
    } else {
      setRevision(null); setAsignados([]); setIncomingAudits([]);
    }
    setLoadingData(false);
  };

  const loadDashboard = async () => { await loadInitialData(); await loadTaskForDate(selectedDate); };

  // Auto-verde: si es promotor con todos auditores SI; si es vendedor basta con amarillo
  const allAuditsSI = !isVendedor && incomingAudits.length > 0 && incomingAudits.every((a: any) => a.voto === 'SI');
  const rawStatus = (revision?.submission_status || 'rojo') as EstadoColor;
  const autoVerde = rawStatus === 'amarillo' && (isVendedor || allAuditsSI);
  const adminOverride = revision?.admin_override as EstadoColor | null;
  const myStatus: EstadoColor = adminOverride || (autoVerde ? 'verde' : rawStatus);
  const isPublished = rawStatus !== 'rojo';
  const isExpired = countdown === 'Expirado';
  const isRevClosed = revCountdown === 'Cerrado';
  const isAdminRole = (user as any)?.rol === 'admin';
  // Switch editable: normal user, or admin in espectador mode with allowSwitchEdit
  const canToggleSwitch = !isExpired || isAdminRole;
  const wasAdminReviewed = !!adminOverride;

  const togglePublicado = async () => {
    if (!tarea || !user) return;
    if (!canToggleSwitch) return;
    if (myStatus === 'verde' || myStatus === 'morado' || myStatus === 'naranja') return;
    // In impersonation mode only allow if allowSwitchEdit is set
    if (isAdminViewingAs && !allowSwitchEdit) return;

    const uid = (actualUser as any).id;
    const newStatus = isPublished ? 'rojo' : 'amarillo';
    setRevision(prev => prev ? { ...prev, submission_status: newStatus } : null);
    const { data } = await supabase.from('revisiones')
      .update({ submission_status: newStatus })
      .eq('tarea_id', tarea.id).eq('promotor_id', uid).eq('auditor_id', uid)
      .select().single();
    if (data) setRevision(data);
  };

  const votar = async (revisionId: string, voto: 'SI' | 'NO' | 'JUSTIFICADO') => {
    if ((isExpired || isRevClosed) && !isAdminRole) return alert('El tiempo de revisión ha terminado.');
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

  const handleVerMaterial = async () => {
    await copyLink();
    if (materialUrl) window.open(materialUrl, '_blank', 'noopener,noreferrer');
  };

  const handleLinkPublicitario = async () => {
    if (!tarea?.link_publicitario) return;
    await copyLink();
    window.open(tarea.link_publicitario, '_blank', 'noopener,noreferrer');
  };

  const getInstagramUrl = (ig: string) =>
    linkMode === 'historias' ? `https://www.instagram.com/stories/${ig}/` : `https://www.instagram.com/${ig}/`;

  const style = STATUS_STYLE[myStatus];

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
      {impersonatedUser && (
        <div className="bg-red-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-between sticky top-0 z-50">
          <span className="flex items-center gap-2">
            <span className="animate-pulse">🔴</span> MODO ESPECTADOR: Viendo el panel de {actualUser.nombre}
          </span>
          <button onClick={onExitImpersonation} className="bg-black/20 hover:bg-black/40 px-3 py-1 rounded transition-colors">
            Volver al Admin
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="border-b border-white/8 bg-neutral-900/80 backdrop-blur sticky top-0 z-10" style={impersonatedUser ? { top: '32px' } : {}}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="font-black text-sm">HSU</span>
            <span className="text-gray-600 text-xs ml-1.5 hidden sm:inline">/ {actualUser.nombre}</span>
            {isVendedor && <span className="ml-2 text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full uppercase">Vendedor</span>}
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={loadDashboard}
              className="bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-white/8 text-gray-300 hover:text-white">
              <RefreshCw size={11} /> <span className="hidden sm:inline">Refrescar</span>
            </button>
            <button onClick={copyLink}
              className="bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-white/8 text-white">
              <Copy size={11} /> {copied ? '✓' : 'Mi Link'}
            </button>
            {!isAdminViewingAs && (
              <button onClick={handleLogout}
                className="bg-red-900/40 hover:bg-red-800/50 text-red-400 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-red-500/20">
                <LogOut size={11} /> <span className="hidden sm:inline">Salir</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">Panel de Misiones</h1>
          <p className="text-gray-500 text-sm mt-1">Hola, <span className="text-white font-semibold">{(user as any).nombre}</span> — aquí están tus tareas del día</p>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-20 text-gray-600 text-sm">Cargando datos del día...</div>
        ) : !tarea ? (
          <div className="bg-neutral-900 border border-white/8 rounded-2xl p-10 sm:p-12 text-center">
            <Clock size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 font-semibold">No hay tarea activa para hoy</p>
            <p className="text-gray-600 text-xs mt-1">El administrador publicará la misión pronto.</p>
          </div>
        ) : (
          <>
            {/* ── MI TAREA ──────────────────────────────────────── */}
            <div className={`border rounded-2xl p-4 sm:p-6 mb-6 transition-all ${style.card}`}>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-6 mb-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full inline-block ${style.badge}`}>
                      {style.label}
                    </span>
                    {wasAdminReviewed && <span title="Revisado por Admin" className="text-lg leading-none">👑</span>}
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold leading-snug">{tarea.titulo}</h2>

                  {/* Doble cuenta regresiva */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Clock size={13} className={isExpired ? 'text-red-400' : 'text-gray-400'} />
                      <span className="text-xs text-gray-500">Tiempo restante:</span>
                      <span className={`font-mono font-bold text-sm ${isExpired ? 'text-red-400' : 'text-gray-300'}`}>
                        {countdown || '...'}
                      </span>
                    </div>
                    {revCountdown && (
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={13} className={revCountdown.startsWith('Revisando') ? 'text-green-400' : revCountdown === 'Cerrado' ? 'text-red-400' : 'text-yellow-400'} />
                        <span className="text-xs text-gray-500">Admin revisa:</span>
                        <span className={`font-mono font-bold text-xs ${revCountdown.startsWith('Revisando') ? 'text-green-400' : revCountdown === 'Cerrado' ? 'text-red-400' : 'text-yellow-400'}`}>
                          {revCountdown}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Switch de Estado */}
                <div className="w-full sm:w-auto flex-shrink-0 bg-neutral-950/50 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center min-w-[160px]">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Estado de tu publicación</p>

                  {(myStatus === 'verde' || myStatus === 'morado' || myStatus === 'naranja') ? (
                    <div className="text-center py-1">
                      <span className="text-3xl">{myStatus === 'verde' ? '🟢' : myStatus === 'morado' ? '🟣' : '🟠'}</span>
                      <p className="text-xs font-bold text-white mt-2">Misión Cerrada</p>
                    </div>
                  ) : (
                    <button
                      onClick={togglePublicado}
                      disabled={!canToggleSwitch || (isAdminViewingAs && !allowSwitchEdit)}
                      className={`relative flex items-center w-20 h-10 rounded-full transition-all duration-300 border-2 ${isPublished ? 'bg-yellow-500/20 border-yellow-500' : 'bg-neutral-800 border-neutral-600'} ${(!canToggleSwitch || (isAdminViewingAs && !allowSwitchEdit)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-white/50'}`}
                    >
                      <div className={`absolute left-1 top-1 w-7 h-7 rounded-full shadow-lg transition-transform duration-300 flex items-center justify-center ${isPublished ? 'transform translate-x-10 bg-yellow-400' : 'bg-neutral-400'}`}>
                        {isPublished && <ShieldCheck size={14} className="text-yellow-900" />}
                      </div>
                    </button>
                  )}
                  {myStatus === 'rojo' && !isExpired && <p className="text-[10px] text-gray-500 mt-2 font-medium">Toca para activar</p>}
                  {myStatus === 'amarillo' && !isVendedor && (
                    <div className="mt-3 w-full">
                      <p className="text-[10px] text-yellow-500 font-medium text-center mb-1.5">Revisiones:</p>
                      <div className="flex justify-center gap-1.5">
                        {incomingAudits.map((aud, i) => (
                          <span key={i} title={`Revisión ${i+1}: ${aud.voto}`} className="text-sm bg-neutral-900 border border-white/5 w-6 h-6 flex items-center justify-center rounded-full">
                            {aud.voto === 'PENDIENTE' ? '⌛' : aud.voto === 'SI' ? '✅' : '❌'}
                          </span>
                        ))}
                        {incomingAudits.length === 0 && <span className="text-[10px] text-gray-500">Sin auditores</span>}
                      </div>
                    </div>
                  )}
                  {isVendedor && myStatus === 'amarillo' && (
                    <p className="text-[10px] text-yellow-500 mt-2 font-medium text-center">Registrado ✓</p>
                  )}
                </div>
              </div>

              {/* Botones de acción */}
              <div className="space-y-2">
                {materialUrl && (
                  <button
                    onClick={handleVerMaterial}
                    className="relative overflow-hidden flex items-center justify-center gap-2 w-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold py-3.5 rounded-xl text-sm transition-all group cursor-pointer"
                  >
                    <Folder size={16} className="group-hover:scale-110 transition-transform flex-shrink-0" />
                    Descargar Material RRSS
                    <div className="absolute right-4 flex items-center gap-1 text-[10px] bg-neutral-950/40 px-2 py-1 rounded border border-white/10 text-gray-400">
                      <LinkIcon size={10} /> Copia tu link
                    </div>
                  </button>
                )}
                {tarea.link_publicitario && (
                  <button
                    onClick={handleLinkPublicitario}
                    className="relative overflow-hidden flex items-center justify-center gap-2 w-full bg-purple-900/20 hover:bg-purple-900/30 border border-purple-500/20 text-purple-300 font-bold py-3.5 rounded-xl text-sm transition-all group cursor-pointer"
                  >
                    <Megaphone size={16} className="group-hover:scale-110 transition-transform flex-shrink-0" />
                    Ver Publicación Oficial
                    <div className="absolute right-4 flex items-center gap-1 text-[10px] bg-neutral-950/40 px-2 py-1 rounded border border-white/10 text-gray-400">
                      <LinkIcon size={10} /> Copia tu link
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* ── EXPLICACIÓN DEL ESTADO ────────────────────────── */}
            <div className="bg-neutral-900/60 border border-white/5 rounded-xl px-4 py-3 mb-6 text-xs text-gray-500 leading-relaxed">
              {myStatus === 'rojo' && '🔴 Aún no has activado tu publicación. Descarga el material, súbelo a tus Stories con tu link, y activa el switch.'}
              {myStatus === 'amarillo' && !isVendedor && '🟡 Switch activado. Tus auditores verificarán tu perfil. Si confirman, pasarás a Verde automáticamente.'}
              {myStatus === 'amarillo' && isVendedor && '🟡 Publicación registrada correctamente.'}
              {myStatus === 'verde' && '🟢 ¡Misión cumplida! Tu publicación fue confirmada.'}
              {myStatus === 'morado' && '🟣 Cumpliste auditando con honestidad. Eres un Auditor Leal.'}
              {myStatus === 'naranja' && '🟠 Tu caso fue justificado por el administrador.'}
            </div>

            {/* ── AUDITORÍAS (solo promotores) ─────────────────── */}
            {!isVendedor && (
              <div className="bg-neutral-900 border border-white/8 rounded-2xl p-4 sm:p-6">
                <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
                  <div>
                    <h2 className="font-black flex items-center gap-2 text-base sm:text-lg">
                      <ShieldCheck size={18} className="text-blue-400 flex-shrink-0" /> Auditorías Asignadas
                    </h2>
                    <p className="text-gray-500 text-xs mt-0.5">Revisa a tus compañeros para completar la misión al 100%</p>
                  </div>
                  <button
                    onClick={() => setLinkMode(p => p === 'perfil' ? 'historias' : 'perfil')}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                  >
                    {linkMode === 'historias' ? <ToggleRight size={18} className="text-blue-400" /> : <ToggleLeft size={18} className="text-gray-600" />}
                    {linkMode === 'historias' ? 'Stories' : 'Perfil'}
                  </button>
                </div>

                {asignados.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-6">No tienes asignaciones de auditoría para esta tarea.</p>
                ) : (
                  <div className="space-y-3">
                    {asignados.map((asig) => {
                      const promotor = asig.promotores;
                      return (
                        <div key={asig.id} className="bg-neutral-950 border border-white/8 p-3 sm:p-4 rounded-xl">
                          <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="text-xs text-gray-500 uppercase font-bold">Revisar a:</p>
                                {asig.target_published ? (
                                  <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                                    🔔 Switch ON
                                  </span>
                                ) : (
                                  <span className="bg-neutral-800 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    ⏳ Sin publicar
                                  </span>
                                )}
                              </div>
                              <a href={getInstagramUrl(promotor?.instagram)} target="_blank" rel="noopener noreferrer"
                                className="font-bold text-white hover:text-blue-400 flex items-center gap-1.5 transition-colors text-sm">
                                @{promotor?.instagram} <ExternalLink size={12} />
                              </a>
                              <p className="text-gray-600 text-xs mt-0.5">{promotor?.nombre}</p>
                            </div>

                            <div className="flex bg-neutral-900 rounded-xl p-1 border border-white/8 gap-0.5 flex-shrink-0">
                              {(['SI', 'NO', 'JUSTIFICADO'] as const).map(v => {
                                const active = asig.voto === v;
                                const styles: Record<string, string> = {
                                  SI: active ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/50' : 'text-gray-400 hover:text-green-400 hover:bg-white/5',
                                  NO: active ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/50' : 'text-gray-400 hover:text-red-400 hover:bg-white/5',
                                  JUSTIFICADO: active ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/50' : 'text-gray-400 hover:text-orange-400 hover:bg-white/5',
                                };
                                const labels: Record<string, string> = { SI: '✅ SÍ', NO: '❌ NO', JUSTIFICADO: '⏸ Just.' };
                                return (
                                  <button key={v} onClick={() => votar(asig.id, v)}
                                    disabled={(isExpired || isRevClosed) && !isAdminRole}
                                    className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${styles[v]} disabled:opacity-40 disabled:cursor-not-allowed`}>
                                    {labels[v]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {asig.voto !== 'PENDIENTE' && (
                            <p className="text-[10px] text-gray-600 mt-2">
                              Votaste: <span className="font-bold text-gray-400">{asig.voto}</span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── MI HISTORIAL ──────────────────────────────────────── */}
            {history.length > 0 && (
              <div className="mt-8 border-t border-white/8 pt-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Clock size={16} /> Tu Historial de Misiones
                </h3>
                <div className="bg-neutral-900 border border-white/8 rounded-2xl p-4 sm:p-6 overflow-x-auto">
                  <div className="flex gap-2 min-w-max">
                    {history.map((h, i) => {
                      const st = h.admin_override || h.submission_status || 'rojo';
                      let colorClass = 'bg-red-500';
                      if (st === 'amarillo') colorClass = 'bg-yellow-400';
                      if (st === 'verde') colorClass = 'bg-green-500';
                      if (st === 'morado') colorClass = 'bg-purple-500';
                      if (st === 'naranja') colorClass = 'bg-orange-400';

                      const dateObj = h.tareas?.fecha_tarea ? new Date(h.tareas.fecha_tarea + 'T12:00:00') : new Date();
                      const dateLabel = dateObj.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });

                      return (
                        <button key={i} onClick={() => h.tareas?.fecha_tarea && setSelectedDate(h.tareas.fecha_tarea)} className="flex flex-col items-center gap-2 group outline-none">
                          <div title={`Día: ${dateLabel} | Estado: ${st}`}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${colorClass} ${h.tareas?.fecha_tarea === selectedDate ? 'ring-4 ring-white ring-offset-2 ring-offset-neutral-900 scale-110' : 'opacity-60 group-hover:opacity-100'}`}>
                            {st === 'verde' && <ShieldCheck size={16} className="text-green-900" />}
                            {st === 'morado' && <span className="text-[10px] font-black text-purple-900">PRO</span>}
                            {st === 'rojo' && <span className="text-[10px] font-black text-red-900">X</span>}
                            {st === 'amarillo' && <span className="text-[10px] font-black text-yellow-900">...</span>}
                          </div>
                          <span className={`text-[10px] font-semibold ${h.tareas?.fecha_tarea === selectedDate ? 'text-white' : 'text-gray-500'}`}>{dateLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
