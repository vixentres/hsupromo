import React, { useState, useEffect } from 'react';
import { Copy, Folder, ExternalLink, ShieldCheck, ToggleLeft, ToggleRight, LogOut, Clock, Link as LinkIcon, RefreshCw, Megaphone, PieChart, User, PlayCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase, getCountdown, type Tarea, type Revision, type EstadoColor } from '../lib/supabase';
import FlowchartViewer from '../components/FlowchartViewer';
import { formatRut, formatPhone, formatIg } from '../lib/utils';

const STATUS_STYLE: Record<EstadoColor, { card: string; badge: string; label: string }> = {
  rojo:    { card: 'bg-red-900/20 border-red-500/30',     badge: 'bg-red-500',    label: 'Misión Pendiente' },
  amarillo:{ card: 'bg-yellow-900/20 border-yellow-500/30', badge: 'bg-yellow-500', label: 'Esperando Confirmación' },
  verde:   { card: 'bg-green-900/20 border-green-500/30',  badge: 'bg-green-500',  label: '✓ Misión Aprobada' },
  morado:  { card: 'bg-teal-900/20 border-teal-500/30',    badge: 'bg-teal-500',   label: '✓ Aprobado (Revisión Temprana)' },
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
  const isVendedor = (actualUser as any)?.rol === 'vendedor' || (actualUser as any)?.rol === 'vendedor_revisor';
  const isAdminViewingAs = !!impersonatedUser;

  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [asignados, setAsignados] = useState<any[]>([]);
  const [incomingAudits, setIncomingAudits] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [countdown, setCountdown] = useState('');
  const [revCountdown, setRevCountdown] = useState('');
  const [copied, setCopied] = useState(false);
  const [materialUrl, setMaterialUrl] = useState('');
  const [globalTmUrl, setGlobalTmUrl] = useState('');
  const [globalStats, setGlobalStats] = useState({ verde: 0, amarillo: 0, rojo: 0, naranja: 0, morado: 0, total: 0 });

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
    const { data: cfg } = await supabase.from('config').select('material_nuevo_url, ticketmaster_url').eq('id', 1).single();
    if (cfg) {
      setMaterialUrl(cfg.material_nuevo_url || '');
      setGlobalTmUrl(cfg.ticketmaster_url || '');
    }

    if (actualUser) {
      const uid = (actualUser as any).id;
      const { data: hist } = await supabase
        .from('revisiones')
        .select('submission_status, admin_override, tareas!inner(fecha_tarea, activa)')
        .eq('promotor_id', uid).eq('auditor_id', uid)
        .order('tareas(fecha_tarea)', { ascending: false });
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
            .from('revisiones').select('promotor_id, auditor_id, submission_status, admin_override')
            .eq('tarea_id', tareaData.id).in('promotor_id', targetIds);
          const selfStatusMap = new Map();
          selfRows?.forEach(r => { 
            if (r.promotor_id === r.auditor_id) {
              selfStatusMap.set(r.promotor_id, { 
                published: r.submission_status !== 'rojo',
                finalStatus: r.admin_override || r.submission_status || 'rojo' 
              });
            }
          });
          setAsignados(revAuditor.map(r => {
            const st = selfStatusMap.get(r.promotor_id) || { published: false, finalStatus: 'rojo' };
            return { ...r, target_published: st.published, target_final_status: st.finalStatus };
          }));
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

      // Fetch Global Stats
      const { data: totalProms } = await supabase.from('promotores').select('id', { count: 'exact' }).in('rol', ['promotor', 'vendedor']);
      const total = totalProms?.length || 0;
      
      const { data: allRevs } = await supabase.from('revisiones')
        .select('submission_status, admin_override, promotor_id, auditor_id')
        .eq('tarea_id', tareaData.id);

      let v = 0, a = 0, r = 0, n = 0, m = 0;
      allRevs?.filter(rev => rev.promotor_id === rev.auditor_id).forEach(rev => {
        const st = rev.admin_override || rev.submission_status || 'rojo';
        if (st === 'verde') v++;
        else if (st === 'amarillo') a++;
        else if (st === 'rojo') r++;
        else if (st === 'naranja') n++;
        else if (st === 'morado') m++;
      });
      
      const totalActive = v + a + r + n + m;
      setGlobalStats({ verde: v, amarillo: a, rojo: r + Math.max(0, total - totalActive), naranja: n, morado: m, total: Math.max(total, totalActive) });
      
    } else {
      setRevision(null); setAsignados([]); setIncomingAudits([]); setGlobalStats({ verde: 0, amarillo: 0, rojo: 0, naranja: 0, morado: 0, total: 0 });
    }
    setLoadingData(false);
  };

  const loadDashboard = async () => { await loadInitialData(); await loadTaskForDate(selectedDate); };

  // Auto-verde: si es promotor con todos auditores SI; si es vendedor basta con amarillo
  const allAuditsSI = !isVendedor && incomingAudits.length > 0 && incomingAudits.every((a: any) => a.voto === 'SI');
  const isSimpleTask = !isVendedor && incomingAudits.length === 0 && asignados.length === 0;
  
  const rawStatus = (revision?.submission_status || 'rojo') as EstadoColor;
  const adminOverride = revision?.admin_override as EstadoColor | null;
  
  const pendingAudits = asignados.filter((a: any) => a.voto === 'PENDIENTE').length;
  // If we voted NO on someone who ended up being approved (Verde), we lied.
  const caughtLying = asignados.some((a: any) => a.voto === 'NO' && a.target_final_status === 'verde');
  // If we voted NO on someone who ended up actually failing (Rojo/Amarillo), we are loyal.
  const truthfulLoyal = asignados.some((a: any) => a.voto === 'NO' && a.target_final_status !== 'verde');
  
  const anyJustificado = !isVendedor && incomingAudits.some((a: any) => a.voto === 'JUSTIFICADO');

  let computedStatus = rawStatus;
  if (rawStatus === 'amarillo' && (isVendedor || allAuditsSI || isSimpleTask)) {
    if (caughtLying) {
      computedStatus = 'rojo'; // Penalized for lying!
    } else if (isVendedor || pendingAudits === 0 || isSimpleTask) {
      computedStatus = truthfulLoyal ? 'morado' : 'verde';
    } else {
      computedStatus = 'amarillo'; // Aprobado pero debe auditar para que se ponga verde
    }
  } else if (rawStatus === 'amarillo' && anyJustificado) {
    computedStatus = 'naranja';
  }

  const myStatus: EstadoColor = adminOverride || computedStatus;
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
    
    // Update local state optimistic
    setRevision(prev => prev ? { ...prev, submission_status: newStatus } : { submission_status: newStatus, admin_override: null } as any);
    
    // Si el usuario es nuevo y no tiene fila de revisión en esta tarea (late joiner)
    const { data: existing } = await supabase.from('revisiones')
      .select('id').eq('tarea_id', tarea.id).eq('promotor_id', uid).eq('auditor_id', uid).maybeSingle();
      
    if (existing) {
      const { data } = await supabase.from('revisiones')
        .update({ submission_status: newStatus })
        .eq('id', existing.id)
        .select().single();
      if (data) setRevision(data);
    } else {
      const { data } = await supabase.from('revisiones')
        .insert({
          tarea_id: tarea.id,
          promotor_id: uid,
          auditor_id: uid,
          submission_status: newStatus,
          voto: 'SI'
        }).select().single();
      if (data) setRevision(data);
    }
  };

  const votar = async (revisionId: string, voto: 'SI' | 'NO' | 'JUSTIFICADO') => {
    if ((isExpired || isRevClosed) && !isAdminRole) return alert('El tiempo de revisión ha terminado.');
    await supabase.from('revisiones').update({ voto }).eq('id', revisionId);
    loadDashboard();
  };

  const handleLogout = () => { logout(); navigate('/promotor/login'); };

  const [viewMode, setViewMode] = useState<'panel' | 'flow' | 'perfil'>('panel');
  const [profileData, setProfileData] = useState({
    nombre: '', instagram: '', telefono: '', rut: '', clave: '', ticketmaster_url: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (actualUser) {
      setProfileData({
        nombre: (actualUser as any).nombre || '',
        instagram: (actualUser as any).instagram || '',
        telefono: (actualUser as any).telefono || '',
        rut: (actualUser as any).rut || '',
        clave: (actualUser as any).clave || '',
        ticketmaster_url: (actualUser as any).ticketmaster_url || ''
      });
    }
  }, [actualUser]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    await supabase.from('promotores').update(profileData).eq('id', (actualUser as any).id);
    setSavingProfile(false);
    alert('Datos guardados exitosamente. (Recarga la página si cambiaste la clave y necesitas reloguear)');
  };

  const copyLink = async () => {
    const instagram = (actualUser as any)?.instagram;
    const tmUrl = profileData.ticketmaster_url;
    if (!instagram && !tmUrl && !globalTmUrl) return;
    const url = tmUrl ? tmUrl : (globalTmUrl ? globalTmUrl : `${window.location.origin}/?ref=${instagram}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      // Clipboard puede fallar en algunos contextos — ignoramos el error pero igual abrimos el link
    }
  };

  const style = STATUS_STYLE[myStatus];

  let conicGradient = 'bg-neutral-800';
  const { verde, amarillo, naranja, morado, rojo, total } = globalStats;
  if (total > 0) {
    const getPct = (val: number) => (val / total) * 100;
    const pV = getPct(verde), pA = getPct(amarillo), pN = getPct(naranja), pM = getPct(morado), pR = getPct(rojo);
    let current = 0;
    const segments = [];
    if (pV > 0) { segments.push(`#22c55e ${current}% ${current + pV}%`); current += pV; }
    if (pM > 0) { segments.push(`#a855f7 ${current}% ${current + pM}%`); current += pM; }
    if (pN > 0) { segments.push(`#fb923c ${current}% ${current + pN}%`); current += pN; }
    if (pA > 0) { segments.push(`#facc15 ${current}% ${current + pA}%`); current += pA; }
    if (pR > 0) { segments.push(`#ef4444 ${current}% ${current + pR}%`); current += pR; }
    if (segments.length > 0) {
      conicGradient = `conic-gradient(${segments.join(', ')})`;
    }
  }

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
    <div className="min-h-screen bg-neutral-950 flex flex-col">
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
          <div className="min-w-0 flex items-center gap-2">
            <span className="font-black text-sm text-white">HSU</span>
              {isVendedor && <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Vendedor</span>}
            <div className="flex gap-1 ml-2 bg-neutral-950 p-1 rounded-lg border border-white/5 overflow-x-auto scrollbar-hide">
              <button onClick={() => setViewMode('panel')} className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${viewMode === 'panel' ? 'bg-white text-neutral-900' : 'text-gray-500 hover:text-white'}`}>Panel</button>
              {(!isSimpleTask) && (
                <button onClick={() => setViewMode('flow')} className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${viewMode === 'flow' ? 'bg-white text-neutral-900' : 'text-gray-500 hover:text-white'}`}>Diagrama</button>
              )}
              <button onClick={() => setViewMode('perfil')} className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${viewMode === 'perfil' ? 'bg-white text-neutral-900' : 'text-gray-500 hover:text-white'}`}>Mis Datos</button>
              {actualUser.rol === 'vendedor_revisor' && !impersonatedUser && (
                <button onClick={() => navigate('/admin')} className="px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap text-blue-400 hover:bg-blue-500/10">Revisión</button>
              )}
            </div>
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

      {viewMode === 'flow' ? (
        <div className="flex-1 w-full h-[calc(100vh-64px)] overflow-hidden">
          <FlowchartViewer />
        </div>
      ) : viewMode === 'perfil' ? (
        <main className="max-w-2xl mx-auto px-4 py-8 w-full">
          <div className="mb-8">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight mb-2">Mis Datos Personales</h1>
            <p className="text-gray-500 text-sm">Actualiza tu información. Estos datos son los que usamos para identificarte y contactarte.</p>
          </div>
          
          <form onSubmit={saveProfile} className="bg-neutral-900 border border-white/8 rounded-2xl p-6 sm:p-8 space-y-5">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Nombre Completo</label>
              <input type="text" value={profileData.nombre} onChange={e => setProfileData(p => ({ ...p, nombre: e.target.value }))}
                className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/60 outline-none transition-all text-white" required />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Instagram (sin @)</label>
                <input type="text" value={profileData.instagram} 
                  onChange={e => setProfileData(p => ({ ...p, instagram: e.target.value }))}
                  onBlur={() => setProfileData(p => ({ ...p, instagram: formatIg(p.instagram) }))}
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/60 outline-none transition-all text-white" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Teléfono (+569...)</label>
                <input type="text" value={profileData.telefono} 
                  onChange={e => setProfileData(p => ({ ...p, telefono: e.target.value }))}
                  onBlur={() => setProfileData(p => ({ ...p, telefono: formatPhone(p.telefono) }))}
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/60 outline-none transition-all text-white" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">RUT (Ej: 12.345.678-9)</label>
              <input type="text" value={profileData.rut} 
                onChange={e => setProfileData(p => ({ ...p, rut: e.target.value }))}
                onBlur={() => setProfileData(p => ({ ...p, rut: formatRut(p.rut) }))}
                className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/60 outline-none transition-all text-white" />
            </div>

            <div className="pt-4 border-t border-white/10 mt-6">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Cambiar Contraseña</label>
              <input type="text" value={profileData.clave} onChange={e => setProfileData(p => ({ ...p, clave: e.target.value }))}
                className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/60 outline-none transition-all text-white" placeholder="Tu contraseña actual o nueva..." required />
              <p className="text-[10px] text-gray-500 mt-2">Esta es la clave que usas para acceder. Si la cambias, deberás usar la nueva la próxima vez.</p>
            </div>

            <div className="pt-4">
              <button type="submit" disabled={savingProfile}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm transition-all flex items-center justify-center disabled:opacity-50">
                {savingProfile ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </main>
      ) : (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">Panel de Misiones</h1>
          <p className="text-gray-500 text-sm mt-1">Hola, <span className="text-white font-semibold">{(user as any).nombre}</span> — aquí están tus tareas del día</p>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-20 text-gray-600 text-sm">Cargando datos del día...</div>
        ) : !tarea ? (
          <>
            <div className="bg-neutral-900 border border-white/8 rounded-2xl p-10 sm:p-12 text-center mb-6">
              <Clock size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 font-semibold">No hay tarea activa para hoy</p>
              <p className="text-gray-600 text-xs mt-1">El administrador publicará la misión pronto.</p>
            </div>
            <div className="space-y-3 mt-5 mb-6">
              {materialUrl && (
                <a href={materialUrl} target="_blank" rel="noopener noreferrer" onClick={() => { try { copyLink(); } catch(_) {} }} className="relative overflow-hidden flex items-center justify-center gap-2 w-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold py-3.5 rounded-xl text-sm transition-all group cursor-pointer">
                  <Folder size={16} className="group-hover:scale-110 transition-transform flex-shrink-0" />
                  Descargar Material RRSS
                </a>
              )}
              <a href="https://www.instagram.com/hsuevents.cl/" target="_blank" rel="noopener noreferrer" onClick={() => { try { copyLink(); } catch(_) {} }} className="relative overflow-hidden flex items-center justify-center gap-2 w-full bg-purple-900/20 hover:bg-purple-900/30 border border-purple-500/20 text-purple-300 font-bold py-3.5 rounded-xl text-sm transition-all group cursor-pointer">
                <Megaphone size={16} className="group-hover:scale-110 transition-transform flex-shrink-0" />
                Ver Publicación Oficial
              </a>
            </div>
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
                      if (st === 'morado') colorClass = 'bg-teal-500';
                      if (st === 'naranja') colorClass = 'bg-orange-400';
                      const dateObj = h.tareas?.fecha_tarea ? new Date(h.tareas.fecha_tarea + 'T12:00:00') : new Date();
                      const dateLabel = dateObj.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
                      return (
                        <button key={i} onClick={() => h.tareas?.fecha_tarea && setSelectedDate(h.tareas.fecha_tarea)} className="flex flex-col items-center gap-2 group outline-none">
                          <div title={`Día: ${dateLabel} | Estado: ${st}`} className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${colorClass} opacity-60 group-hover:opacity-100`}>
                            {st === 'verde' && <ShieldCheck size={16} className="text-green-900" />}
                            {st === 'morado' && <ShieldCheck size={16} className="text-teal-900" />}
                            {st === 'amarillo' && <span className="text-[10px] font-black text-yellow-900">...</span>}
                          </div>
                          <span className="text-[10px] font-semibold text-gray-500">{dateLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
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
                  <div className="h-[30px] mt-2 w-full flex items-center justify-center">
                    {myStatus === 'rojo' && !isExpired && <p className="text-[10px] text-gray-500 font-medium">Toca para activar</p>}
                    {myStatus === 'amarillo' && !isVendedor && (
                      <div className="w-full">
                        <p className="text-[10px] text-yellow-500 font-medium text-center mb-1">Revisiones:</p>
                        <div className="flex justify-center gap-1">
                          {incomingAudits.map((aud, i) => (
                            <span key={i} title={`Revisión ${i+1}: ${aud.voto}`} className="text-xs bg-neutral-900 border border-white/5 w-4 h-4 flex items-center justify-center rounded-full">
                              {aud.voto === 'PENDIENTE' ? '⌛' : aud.voto === 'SI' ? '✅' : '❌'}
                            </span>
                          ))}
                          {incomingAudits.length === 0 && <span className="text-[10px] text-gray-500">Sin auditores</span>}
                        </div>
                      </div>
                    )}
                    {isVendedor && myStatus === 'amarillo' && (
                      <p className="text-[10px] text-yellow-500 font-medium text-center">Registrado ✓</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="space-y-2">
                {materialUrl && (
                  <a
                    href={materialUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => { try { copyLink(); } catch(_) {} }}
                    className="relative overflow-hidden flex items-center justify-center gap-2 w-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold py-3.5 rounded-xl text-sm transition-all group cursor-pointer"
                  >
                    <Folder size={16} className="group-hover:scale-110 transition-transform flex-shrink-0" />
                    Descargar Material RRSS
                  </a>
                )}
                {tarea.link_publicitario && (
                  <a
                    href={tarea.link_publicitario || 'https://www.instagram.com/hsuevents.cl/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => { try { copyLink(); } catch(_) {} }}
                    className="relative overflow-hidden flex items-center justify-center gap-2 w-full bg-purple-900/20 hover:bg-purple-900/30 border border-purple-500/20 text-purple-300 font-bold py-3.5 rounded-xl text-sm transition-all group cursor-pointer"
                  >
                    <Megaphone size={16} className="group-hover:scale-110 transition-transform flex-shrink-0" />
                    Ver Publicación Oficial
                  </a>
                )}
              </div>
            </div>

            {/* ── EXPLICACIÓN DEL ESTADO ────────────────────────── */}
            <div className="bg-neutral-900/60 border border-white/5 rounded-xl px-4 py-3 mb-6 text-xs text-gray-500 leading-relaxed min-h-[64px] flex items-center">
              <div>
                {myStatus === 'rojo' && '🔴 Aún no has activado tu publicación. Descarga el material, súbelo a tus Stories con tu link, y activa el switch.'}
                {myStatus === 'amarillo' && !isVendedor && '🟡 Switch activado. Tus auditores verificarán tu perfil. Si confirman, pasarás a Verde automáticamente.'}
                {myStatus === 'amarillo' && isVendedor && '🟡 Publicación registrada correctamente.'}
                {myStatus === 'verde' && '🟢 ¡Misión cumplida! Tu publicación fue confirmada.'}
                {myStatus === 'morado' && '🟣 Cumpliste auditando con honestidad. Eres un Auditor Leal.'}
                {myStatus === 'naranja' && '🟠 Tu caso fue justificado por el administrador.'}
              </div>
            </div>

            {/* ── AUDITORÍAS (solo promotores) ─────────────────── */}
            {!isVendedor && asignados.length > 0 && (
              <div className="bg-neutral-900 border border-white/8 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                  <div>
                    <h2 className="font-black flex items-center gap-2 text-base">
                      <ShieldCheck size={18} className="text-blue-400 flex-shrink-0" /> Auditorías Asignadas
                    </h2>
                    <p className="text-gray-500 text-xs mt-0.5">Revisa a tus compañeros para completar tu misión</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {asignados.map((asig) => {
                    const promotor = asig.promotores;
                    return (
                      <div key={asig.id} className="bg-neutral-950 border border-white/8 p-4 rounded-xl">
                        {/* Header: nombre + estado switch */}
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm truncate">@{promotor?.instagram}</span>
                              <div className="flex gap-1.5 flex-shrink-0">
                                <a href={`https://www.instagram.com/${promotor?.instagram}/`} target="_blank" rel="noopener noreferrer"
                                  className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-pink-400 transition-colors" title="Ver Perfil">
                                  <User size={12} />
                                </a>
                                <a href={`https://www.instagram.com/stories/${promotor?.instagram}/`} target="_blank" rel="noopener noreferrer"
                                  className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-purple-400 transition-colors" title="Ver Historias">
                                  <PlayCircle size={12} />
                                </a>
                              </div>
                            </div>
                            <p className="text-gray-600 text-[11px] mt-0.5">{promotor?.nombre}</p>
                          </div>
                          {asig.target_published ? (
                            <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                              🔔 Publicó
                            </span>
                          ) : (
                            <span className="bg-neutral-800 text-gray-500 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                              ⏳ Sin publicar
                            </span>
                          )}
                        </div>

                        {/* Botones de voto grandes y táctiles */}
                        <div className="grid grid-cols-3 gap-2">
                          {(['SI', 'NO', 'JUSTIFICADO'] as const).map(v => {
                            const active = asig.voto === v;
                            const cfg = {
                              SI: { label: '✅ SÍ', active: 'bg-green-500/20 text-green-400 border-green-500/50 ring-1 ring-green-500/50', idle: 'text-gray-400 bg-neutral-900 border-white/8 hover:border-green-500/30 hover:text-green-400' },
                              NO: { label: '❌ NO', active: 'bg-red-500/20 text-red-400 border-red-500/50 ring-1 ring-red-500/50', idle: 'text-gray-400 bg-neutral-900 border-white/8 hover:border-red-500/30 hover:text-red-400' },
                              JUSTIFICADO: { label: '⏸ Just.', active: 'bg-orange-500/20 text-orange-400 border-orange-500/50 ring-1 ring-orange-500/50', idle: 'text-gray-400 bg-neutral-900 border-white/8 hover:border-orange-500/30 hover:text-orange-400' },
                            }[v];
                            return (
                              <button key={v} onClick={() => votar(asig.id, v)}
                                disabled={(isExpired || isRevClosed) && !isAdminRole}
                                className={`py-2.5 text-xs font-bold rounded-xl transition-all border ${active ? cfg.active : cfg.idle} disabled:opacity-40 disabled:cursor-not-allowed`}>
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                        {asig.voto !== 'PENDIENTE' && (
                          <p className="text-[10px] text-gray-600 mt-2 text-center">
                            Votaste: <span className="font-bold text-gray-400">{asig.voto}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── GRÁFICO GLOBAL ──────────────────────────────────────── */}
            {tarea && globalStats.total > 0 && (
              <div className="mt-8 border-t border-white/8 pt-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <PieChart size={16} /> Avance General de la Misión
                </h3>
                <div className="bg-neutral-900 border border-white/8 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-8">
                  {/* Gráfico Donut */}
                  <div className="relative w-32 h-32 flex-shrink-0">
                    <div className="absolute inset-0 rounded-full" style={{ background: conicGradient }}></div>
                    <div className="absolute inset-2 bg-neutral-900 rounded-full flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-white">{Math.round(((globalStats.total - globalStats.rojo) / globalStats.total) * 100)}%</span>
                      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Activos</span>
                    </div>
                  </div>
                  
                  {/* Leyenda */}
                  <div className="flex-1 grid grid-cols-2 gap-y-3 gap-x-4 w-full">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-green-500"></span> Confirmados</span>
                      <span className="font-mono text-white font-bold">{globalStats.verde}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-400"></span> En Revisión</span>
                      <span className="font-mono text-white font-bold">{globalStats.amarillo}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-teal-500"></span> Conf. (Rev. Temprana)</span>
                      <span className="font-mono text-white font-bold">{globalStats.morado}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400"></span> Justificados</span>
                      <span className="font-mono text-white font-bold">{globalStats.naranja}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs col-span-2 pt-2 border-t border-white/5 mt-1">
                      <span className="flex items-center gap-1.5 text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-red-500"></span> Pendientes (Sin activar)</span>
                      <span className="font-mono text-red-400 font-bold">{globalStats.rojo} / {globalStats.total}</span>
                    </div>
                  </div>
                </div>
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
                      if (st === 'morado') colorClass = 'bg-teal-500';
                      if (st === 'naranja') colorClass = 'bg-orange-400';

                      const dateObj = h.tareas?.fecha_tarea ? new Date(h.tareas.fecha_tarea + 'T12:00:00') : new Date();
                      const dateLabel = dateObj.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });

                      return (
                        <button key={i} onClick={() => h.tareas?.fecha_tarea && setSelectedDate(h.tareas.fecha_tarea)} className="flex flex-col items-center gap-2 group outline-none">
                          <div title={`Día: ${dateLabel} | Estado: ${st}`}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${colorClass} ${h.tareas?.fecha_tarea === selectedDate ? 'ring-4 ring-white ring-offset-2 ring-offset-neutral-900 scale-110' : 'opacity-60 group-hover:opacity-100'}`}>
                            {st === 'verde' && <ShieldCheck size={16} className="text-green-900" />}
                            {st === 'morado' && <ShieldCheck size={16} className="text-teal-900" />}
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
      </main>
      )}
    </div>
  );
}
