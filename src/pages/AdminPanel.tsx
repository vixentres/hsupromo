import React, { useState, useEffect } from 'react';
import {
  Users, Settings, BarChart3, Plus, Trash2, Save,
  LogOut, Search, Copy, ChevronUp, ChevronDown, Clock, ShieldCheck, RefreshCw, FileText, Eye
} from 'lucide-react';
import { supabase, transformDriveUrl, type Promotor, type Tarea, type EstadoColor, type Config } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import PromoterDashboard from './PromoterDashboard';

// ─── Constantes de color ─────────────────────────────────────────────────────
const COLORS: EstadoColor[] = ['rojo', 'amarillo', 'verde', 'morado', 'naranja'];

const COLOR_META: Record<EstadoColor, { bg: string; ring: string; label: string; desc: string }> = {
  rojo:    { bg: 'bg-red-500',    ring: 'ring-red-500',    label: 'Rojo',     desc: 'Pendiente / Castigado' },
  amarillo:{ bg: 'bg-yellow-400', ring: 'ring-yellow-400', label: 'Amarillo', desc: 'En revisión cruzada' },
  verde:   { bg: 'bg-green-500',  ring: 'ring-green-500',  label: 'Verde',    desc: 'Aprobado' },
  morado:  { bg: 'bg-purple-500', ring: 'ring-purple-500', label: 'Morado',   desc: 'Auditor leal' },
  naranja: { bg: 'bg-orange-400', ring: 'ring-orange-400', label: 'Naranja',  desc: 'Justificado' },
};

const TODAY = new Date().toISOString().split('T')[0];

function formatDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

// ─── HeatCell ────────────────────────────────────────────────────────────────
function HeatCell({ revId, currentStatus, onOverride }: {
  revId: string | null;
  currentStatus: EstadoColor;
  onOverride: (id: string, c: EstadoColor) => void;
}) {
  const [open, setOpen] = useState(false);
  const c = COLOR_META[currentStatus];
  if (!revId) return <span className="inline-block w-5 h-5 rounded-full bg-neutral-800 border border-white/10" title="Sin datos" />;
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(o => !o)}
        className={`w-5 h-5 rounded-full ${c.bg} ring-2 ring-offset-2 ring-offset-neutral-900 ${c.ring} hover:scale-110 transition-all`}
        title={`${c.label}: ${c.desc}`} />
      {open && (
        <div className="absolute z-50 top-7 left-1/2 -translate-x-1/2 bg-neutral-800 border border-white/15 rounded-xl shadow-2xl p-2 flex gap-1.5">
          {COLORS.map(col => (
            <button key={col} onClick={() => { onOverride(revId, col); setOpen(false); }}
              className={`w-5 h-5 rounded-full ${COLOR_META[col].bg} hover:scale-125 transition-transform`}
              title={COLOR_META[col].label} />
          ))}
          <button onClick={() => { onOverride(revId, currentStatus); setOpen(false); }}
            className="w-5 h-5 rounded-full bg-neutral-600 hover:bg-neutral-500 flex items-center justify-center text-[8px] font-bold transition-transform"
            title="Quitar override">✕</button>
        </div>
      )}
    </div>
  );
}

// ─── Leyenda ─────────────────────────────────────────────────────────────────
function Leyenda() {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {COLORS.map(c => (
        <div key={c} className="flex items-center gap-2 bg-neutral-950 border border-white/8 px-3 py-1.5 rounded-lg">
          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${COLOR_META[c].bg}`} />
          <span className="text-xs font-bold text-white">{COLOR_META[c].label}</span>
          <span className="text-[10px] text-gray-500 hidden sm:inline">{COLOR_META[c].desc}</span>
        </div>
      ))}
    </div>
  );
}

// ─── DEFAULT CONFIG ───────────────────────────────────────────────────────────
const DEFAULT_CONFIG: Config = {
  id: 1, banner_url: '', material_nuevo_url: '',
  auditores_por_tarea: 2, ticketmaster_url: '', entradas_gratis_url: '',
  fecha_evento: '2027-01-15',
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function AdminPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'tasks' | 'stats'>('users');

  // ── Usuarios ──────────────────────────────────────────────────────────────
  const [promotores, setPromotores] = useState<Promotor[]>([]);
  const [editedRows, setEditedRows] = useState<Record<string, Partial<Promotor>>>({});
  const [savingUsers, setSavingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRolFilter, setUserRolFilter] = useState<'todos' | 'promotor' | 'admin'>('todos');
  const [userSort, setUserSort] = useState<{ field: keyof Promotor; dir: 'asc' | 'desc' }>({ field: 'nombre', dir: 'asc' });
  const [copied, setCopied] = useState<string | null>(null);

  // ── Tareas ────────────────────────────────────────────────────────────────
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [newTask, setNewTask] = useState({ titulo: '', horas_duracion: 24, material_nuevo: '' });
  const [creatingTask, setCreatingTask] = useState(false);

  // ── Config ────────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);

  // ── Mapa de calor ─────────────────────────────────────────────────────────
  const [heatData, setHeatData] = useState<any[]>([]);
  const [heatDates, setHeatDates] = useState<string[]>([]);
  const [heatColorFilter, setHeatColorFilter] = useState<EstadoColor | 'todos'>('todos');
  const [heatSort, setHeatSort] = useState<'nombre' | 'estado'>('nombre');
  const [selectedHeatDate, setSelectedHeatDate] = useState<string>(TODAY);

  // ── Impersonation ─────────────────────────────────────────────────────────
  const [impersonated, setImpersonated] = useState<any>(null);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<any[]>([]);
  const [statsFilter, setStatsFilter] = useState<'visita' | 'click_tm' | 'click_gratis'>('visita');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadUsers(), loadTareas(), loadConfig(), loadHeatMap(), loadMetrics()]);
    } catch (error) {
      console.error("Error loading admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    const { data } = await supabase.from('promotores').select('*').order('created_at');
    setPromotores(data || []);
  };

  const loadTareas = async () => {
    const { data } = await supabase.from('tareas').select('*').order('fecha_tarea', { ascending: false });
    setTareas(data || []);
  };

  const loadConfig = async () => {
    const { data } = await supabase.from('config').select('*').eq('id', 1).single();
    if (data) setConfig(data);
  };

  const loadHeatMap = async () => {
    // 1. Obtener solo los promotores (excluir admins del mapa)
    const { data: proms } = await supabase.from('promotores').select('id, nombre, instagram').eq('rol', 'promotor').order('created_at');
    if (!proms) return;
    
    // 2. Obtener revisiones
    const { data: revs } = await supabase
      .from('revisiones')
      .select('*, tareas!revisiones_tarea_id_fkey(fecha_tarea), target:promotores!revisiones_promotor_id_fkey(id, nombre, instagram)')
      .order('created_at');
    
    const dates = revs ? [...new Set(revs.map((r: any) => r.tareas?.fecha_tarea).filter(Boolean))].sort() as string[] : [];
    setHeatDates(dates);

    const byPromotor: Record<string, any> = {};
    proms.forEach((p: any) => {
      byPromotor[p.id] = { promotor: p, dias: {} };
    });

    if (revs) {
      revs.forEach((r: any) => {
        const fecha = r.tareas?.fecha_tarea;
        if (!fecha) return;
        const pId = r.promotor_id;
        const aId = r.auditor_id;
        
        if (!byPromotor[pId]) return; // por si acaso
        if (!byPromotor[pId].dias[fecha]) byPromotor[pId].dias[fecha] = { self: null, asAuditor: [] };
        if (!byPromotor[aId]) return;
        if (!byPromotor[aId].dias[fecha]) byPromotor[aId].dias[fecha] = { self: null, asAuditor: [] };

        if (pId === aId) {
          byPromotor[pId].dias[fecha].self = r;
        } else {
          byPromotor[aId].dias[fecha].asAuditor.push(r);
        }
      });
    }
    
    setHeatData(Object.values(byPromotor));
  };

  const loadMetrics = async () => {
    const { data } = await supabase
      .from('metricas')
      .select('*, promotores!metricas_promotor_id_fkey(nombre, instagram)');
    setMetrics(data || []);
  };

  // ── Usuarios: helpers ─────────────────────────────────────────────────────
  const getFilteredUsers = () => {
    let list = [...promotores];
    if (userRolFilter !== 'todos') list = list.filter(p => p.rol === userRolFilter);
    if (userSearch) {
      const s = userSearch.toLowerCase();
      list = list.filter(p =>
        p.nombre?.toLowerCase().includes(s) ||
        p.correo?.toLowerCase().includes(s) ||
        p.instagram?.toLowerCase().includes(s)
      );
    }
    list.sort((a, b) => {
      const av = (a[userSort.field] || '') as string;
      const bv = (b[userSort.field] || '') as string;
      return userSort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  };

  const toggleSort = (field: keyof Promotor) => {
    setUserSort(prev => ({ field, dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const SortIcon = ({ field }: { field: keyof Promotor }) => {
    if (userSort.field !== field) return <ChevronUp size={12} className="text-gray-600" />;
    return userSort.dir === 'asc' ? <ChevronUp size={12} className="text-blue-400" /> : <ChevronDown size={12} className="text-blue-400" />;
  };

  const editCell = (id: string, field: keyof Promotor, value: string) => {
    setEditedRows(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const addRow = () => {
    const tempId = `new_${Date.now()}`;
    setPromotores(prev => [...prev, { id: tempId, nombre: '', rut: '', correo: '', clave: '', instagram: '', rol: 'promotor' }]);
  };

  const deleteRow = async (id: string) => {
    if (id.startsWith('new_')) { setPromotores(prev => prev.filter(p => p.id !== id)); return; }
    if (!confirm('¿Eliminar este promotor permanentemente?')) return;
    await supabase.from('promotores').delete().eq('id', id);
    setPromotores(prev => prev.filter(p => p.id !== id));
  };

  const saveUsers = async () => {
    setSavingUsers(true);
    const toUpsert = promotores.map(p => ({
      ...p, ...editedRows[p.id],
      ...(p.id.startsWith('new_') ? { id: undefined } : { id: p.id }),
    }));
    await supabase.from('promotores').upsert(toUpsert, { onConflict: 'id' });
    setEditedRows({});
    await loadUsers();
    setSavingUsers(false);
  };

  const copyLink = async (instagram: string, type: 'ref' | 'login') => {
    const url = type === 'ref'
      ? `${window.location.origin}/?ref=${instagram}`
      : `${window.location.origin}/promotor/login`;
    await navigator.clipboard.writeText(url);
    setCopied(instagram + type);
    setTimeout(() => setCopied(null), 1500);
  };

  const [configOpen, setConfigOpen] = useState(false);

  const addHours = async (tareaId: string, extraHours: number) => {
    const tarea = tareas.find(t => t.id === tareaId);
    if (!tarea) return;
    const currentHours = tarea.horas_duracion || 24;
    await supabase.from('tareas').update({ horas_duracion: currentHours + extraHours }).eq('id', tareaId);
    alert(`Se agregaron ${extraHours}h a la tarea.`);
    loadTareas();
  };

  // ── Tareas: crear ─────────────────────────────────────────────────────────
  const crearTarea = async () => {
    setCreatingTask(true);
    const titulo = newTask.titulo.trim() || `Tarea del día ${formatDate(TODAY)}`;
    
    // Solo promotores para la asignación
    const { data: proms } = await supabase.from('promotores').select('id').eq('rol', 'promotor').order('created_at');
    if (!proms || proms.length === 0) {
      alert('No hay promotores para asignar.');
      setCreatingTask(false);
      return;
    }

    const { data: tarea, error } = await supabase.from('tareas').insert({
      titulo, horas_duracion: newTask.horas_duracion, material_nuevo: newTask.material_nuevo, activa: true, fecha_tarea: TODAY
    }).select().single();

    if (error || !tarea) { alert('Error al crear tarea: ' + error?.message); setCreatingTask(false); return; }
    
    const tareaId = tarea.id;
    const selfRows: any[] = [];
    const auditRows: any[] = [];

    // Desactivar las de días anteriores
    await supabase.from('tareas').update({ activa: false }).neq('id', tareaId);

    const numAuditores = Math.min(config.auditores_por_tarea || 2, proms.length - 1);

    proms.forEach((p, i) => {
      selfRows.push({
        tarea_id: tareaId,
        promotor_id: p.id,
        auditor_id: p.id,
        voto: 'SI', // Placeholder para su propia "auditoría"
        submission_status: 'rojo'
      });

      for (let k = 1; k <= numAuditores; k++) {
        const audIdx = (i + k) % proms.length;
        auditRows.push({
          tarea_id: tareaId,
          promotor_id: proms[audIdx].id, // Quien es auditado
          auditor_id: p.id,              // Quien audita
          voto: 'PENDIENTE',
          submission_status: 'rojo'
        });
      }
    });

    await supabase.from('revisiones').insert([...selfRows, ...auditRows]);

    setNewTask({ titulo: '', horas_duracion: 24, material_nuevo: '' });
    await Promise.all([loadTareas(), loadHeatMap()]);
    setCreatingTask(false);
    alert(`"${titulo}" creada y asignada a ${proms.length} promotores ✓`);
  };

  // ── Mapa calor: override ─────────────────────────────────────────────────
  const overrideColor = async (revId: string | null, color: EstadoColor) => {
    if (!revId) return alert('Este usuario no tiene entrada para hoy.');
    if (!window.confirm(`¿Forzar color a ${COLOR_META[color].label}?`)) return;
    await supabase.from('revisiones').update({ admin_override: color }).eq('id', revId);
    loadHeatMap();
  };

  // ── Mapa de calor: filtros ─────────────────────────────────────────────────
  const getFilteredHeat = () => {
    let list = [...heatData];
    if (heatColorFilter !== 'todos') {
      list = list.filter(row => {
        const selfRev = row.dias[TODAY]?.self;
        const status = (selfRev?.admin_override || selfRev?.submission_status || 'rojo') as EstadoColor;
        return status === heatColorFilter;
      });
    }
    if (heatSort === 'nombre') {
      list.sort((a, b) => (a.promotor?.nombre || '').localeCompare(b.promotor?.nombre || ''));
    } else {
      // Orden inteligente por estado real (prioridad de acción)
      list.sort((a, b) => {
        const getScore = (row: any) => {
          const dia = row.dias[TODAY] || { self: null, asAuditor: [] };
          const status = (dia.self?.admin_override || dia.self?.submission_status || 'rojo') as EstadoColor;
          const hasPublished = status !== 'rojo';
          const pendingAuditsCount = (dia.asAuditor || []).filter((r: any) => r.voto === 'PENDIENTE').length;
          
          if (!hasPublished && pendingAuditsCount > 0) return 1; // Máxima prioridad (rojo + debe revisar)
          if (!hasPublished && pendingAuditsCount === 0) return 2; // (rojo + ya revisó)
          if (hasPublished && pendingAuditsCount > 0 && status !== 'verde') return 3; // (amarillo + debe revisar)
          if (hasPublished && pendingAuditsCount === 0 && status !== 'verde') return 4; // (amarillo + ya revisó)
          if (status === 'verde' && pendingAuditsCount > 0) return 5; // (verde + debe revisar)
          return 6; // Verde + ya revisó (todo OK, va al fondo)
        };
        return getScore(a) - getScore(b);
      });
    }
    return list;
  };

  // ── Config: guardar ───────────────────────────────────────────────────────
  const saveConfig = async () => {
    setSavingConfig(true);
    await supabase.from('config').upsert({ ...config, id: 1 });
    setSavingConfig(false);
  };

  const handleLogout = () => { logout(); navigate('/promotor/login'); };

  const bannerPreview = transformDriveUrl(config.banner_url);

  if (loading) return <div className="p-10 text-center text-gray-500">Cargando Admin Hub...</div>;
  if (!user || user.rol !== 'admin') return null;

  if (impersonated) {
    return <PromoterDashboard impersonatedUser={impersonated} onExitImpersonation={() => setImpersonated(null)} />;
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Encabezado Principal */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-900 border border-white/8 rounded-2xl p-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-blue-500" /> Admin Hub
            </h1>
            <p className="text-gray-500 text-sm mt-1">Gestión de promotores, misiones y métricas</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadAll} className="flex items-center gap-1.5 text-xs font-bold bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded-xl transition-colors">
              <RefreshCw size={14} /> Refrescar
            </button>
            <button onClick={logout} className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-950/30 hover:bg-red-900/40 border border-red-500/20 px-4 py-2 rounded-xl transition-colors">
              <LogOut size={14} /> Salir
            </button>
          </div>
        </div>

        {/* Tabs Principales */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {(['users', 'tasks', 'stats'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2
              ${activeTab === tab ? 'bg-white text-neutral-900 shadow-lg' : 'bg-neutral-900 text-gray-400 hover:text-white border border-white/5 hover:bg-neutral-800'}`}>
              {tab === 'users' && <Users size={16} />}
              {tab === 'tasks' && <FileText size={16} />}
              {tab === 'stats' && <BarChart3 size={16} />}
              {tab === 'users' ? 'Promotores' : tab === 'tasks' ? 'Gestor de Tareas' : 'Analíticas'}
            </button>
          ))}
        </div>

        {/* ══ TAB USUARIOS ══════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div className="bg-neutral-900 border border-white/8 rounded-2xl overflow-hidden">
            {/* Toolbar */}
            <div className="px-5 py-4 border-b border-white/8 flex flex-wrap items-center gap-3">
              {/* Búsqueda */}
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                  placeholder="Buscar por nombre, correo o @..."
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              {/* Filtro rol */}
              <div className="flex gap-1 bg-neutral-950 border border-white/10 p-1 rounded-xl">
                {(['todos', 'promotor', 'admin'] as const).map(r => (
                  <button key={r} onClick={() => setUserRolFilter(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all capitalize ${userRolFilter === r ? 'bg-white text-neutral-900' : 'text-gray-400 hover:text-white'}`}>
                    {r}
                  </button>
                ))}
              </div>

              <button onClick={saveUsers} disabled={savingUsers || Object.keys(editedRows).length === 0}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 text-sm transition-all ml-auto">
                <Save size={14} /> {savingUsers ? 'Guardando...' : `Guardar${Object.keys(editedRows).length > 0 ? ` (${Object.keys(editedRows).length})` : ''}`}
              </button>
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-white/8 bg-neutral-950/50">
                    {([
                      ['nombre', 'Nombre'],
                      ['rut', 'RUT'],
                      ['correo', 'Correo'],
                      ['clave', 'Contraseña'],
                      ['instagram', 'Instagram'],
                    ] as const).map(([field, label]) => (
                      <th key={field} className="px-4 py-3 text-left font-semibold cursor-pointer select-none hover:text-white transition-colors"
                        onClick={() => toggleSort(field)}>
                        <span className="flex items-center gap-1">{label}<SortIcon field={field} /></span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left font-semibold cursor-pointer select-none hover:text-white" onClick={() => toggleSort('rol')}>
                      <span className="flex items-center gap-1">Rol<SortIcon field="rol" /></span>
                    </th>
                    <th className="px-4 py-3 text-center font-semibold">Links</th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {getFilteredUsers().map(p => {
                    const edited = editedRows[p.id] || {};
                    const val = (f: keyof Promotor) => ((edited[f] ?? p[f]) || '') as string;
                    const isDirty = !!editedRows[p.id];
                    const ig = val('instagram');
                    return (
                      <tr key={p.id} className={`group transition-colors ${isDirty ? 'bg-blue-900/10' : 'hover:bg-neutral-800/20'}`}>
                        {(['nombre', 'rut', 'correo', 'clave', 'instagram'] as const).map(field => (
                          <td key={field} className="px-3 py-1.5">
                            <input type="text" value={val(field)} onChange={e => editCell(p.id, field, e.target.value)}
                              className="w-full bg-transparent border border-transparent hover:border-white/15 focus:border-blue-500/60 focus:bg-neutral-900/80 rounded-lg px-2 py-1.5 outline-none transition-all min-w-[90px] text-sm" />
                          </td>
                        ))}
                        <td className="px-3 py-1.5">
                          <select value={val('rol')} onChange={e => editCell(p.id, 'rol', e.target.value)}
                            className="bg-neutral-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-500/60">
                            <option value="promotor">Promotor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => copyLink(ig, 'ref')}
                              title="Copiar link de referido"
                              className="text-[10px] font-bold text-gray-500 hover:text-green-400 bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
                              {copied === ig + 'ref' ? '✓ Copiado' : '🔗 Ref'}
                            </button>
                            <button onClick={() => copyLink(ig, 'login')}
                              title="Copiar link de login"
                              className="text-[10px] font-bold text-gray-500 hover:text-blue-400 bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
                              {copied === ig + 'login' ? '✓ Copiado' : '🔐 Login'}
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-1.5">
                          <button onClick={() => deleteRow(p.id)}
                            className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-white/8">
              <button onClick={addRow} className="flex items-center gap-2 text-gray-500 hover:text-white text-xs font-bold transition-colors hover:bg-white/5 px-3 py-2 rounded-lg">
                <Plus size={14} /> Añadir promotor
              </button>
            </div>
          </div>
        )}

        {/* ══ TAB GESTOR DE TAREAS ══════════════════════════════════════════ */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">

            {/* Config Global */}
            <div className="bg-neutral-900 border border-white/8 rounded-2xl overflow-hidden transition-all">
              <div 
                className="px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setConfigOpen(!configOpen)}
              >
                <div>
                  <h2 className="font-black text-base flex items-center gap-2">Configuración Global</h2>
                  <p className="text-gray-500 text-xs mt-0.5">Links, banner y opciones del sistema</p>
                </div>
                <ChevronDown size={18} className={`text-gray-400 transition-transform ${configOpen ? 'rotate-180' : ''}`} />
              </div>
              
              {configOpen && (
                <div className="p-6 border-t border-white/8 bg-neutral-950/30">
                  {/* Preview del banner */}
                  {config.banner_url && (
                    <div className="mb-4 w-full max-w-xs rounded-xl overflow-hidden border border-white/10 aspect-video bg-neutral-800">
                      <img src={bannerPreview} alt="Preview banner"
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {([
                      ['banner_url', 'URL Banner (Drive o directa)', 'https://drive.google.com/file/d/.../view'],
                      ['ticketmaster_url', 'URL Botón "Comprar en Ticketmaster"', 'https://www.ticketmaster.cl/...'],
                      ['entradas_gratis_url', 'URL Botón "Entradas sin cargo"', 'https://...'],
                      ['material_nuevo_url', 'URL Material RRSS (Drive — carpeta con todo)', 'https://drive.google.com/drive/folders/...'],
                    ] as const).map(([field, label, placeholder]) => (
                      <div key={field} className={field === 'banner_url' ? 'md:col-span-2' : ''}>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">{label}</label>
                        <input type="text" value={config[field] || ''} placeholder={placeholder}
                          onChange={e => setConfig(c => ({ ...c, [field]: e.target.value }))}
                          className="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-blue-500/60 outline-none transition-all" />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Fecha del Evento (para cuenta regresiva)</label>
                      <input type="date" value={config.fecha_evento || '2027-01-15'}
                        onChange={e => setConfig(c => ({ ...c, fecha_evento: e.target.value }))}
                        className="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-blue-500/60 outline-none transition-all text-white" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Auditores por tarea</label>
                      <input type="number" min={1} max={5} value={config.auditores_por_tarea}
                        onChange={e => setConfig(c => ({ ...c, auditores_por_tarea: parseInt(e.target.value) }))}
                        className="w-20 bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-blue-500/60 outline-none text-center" />
                    </div>
                    <button onClick={saveConfig} disabled={savingConfig}
                      className="mt-5 bg-white hover:bg-gray-100 text-neutral-900 font-bold py-2 px-5 rounded-xl text-sm flex items-center gap-2 transition-colors border border-white/10">
                      <Save size={14} /> {savingConfig ? 'Guardando...' : 'Guardar Config'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Nueva Tarea */}
              <div className="bg-neutral-900 border border-white/8 rounded-2xl p-6 h-fit">
                <h2 className="font-black text-base mb-4">Nueva Tarea Diaria</h2>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-3 flex-wrap">
                    <input type="text" value={newTask.titulo} onChange={e => setNewTask(t => ({ ...t, titulo: e.target.value }))}
                      placeholder={`Tarea del día ${formatDate(TODAY)}`}
                      className="flex-1 min-w-[200px] bg-neutral-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500/60 outline-none transition-all" />
                    <div className="flex items-center gap-2 bg-neutral-950 border border-white/10 rounded-xl px-4 py-2.5">
                      <span className="text-xs text-gray-500 font-semibold">Horas:</span>
                      <input type="number" min={1} max={72} value={newTask.horas_duracion}
                        onChange={e => setNewTask(t => ({ ...t, horas_duracion: parseInt(e.target.value) }))}
                        className="w-12 bg-transparent text-sm outline-none text-center font-mono" />
                    </div>
                  </div>
                  <button onClick={crearTarea} disabled={creatingTask}
                    className="self-end bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 font-black py-2.5 px-6 rounded-xl text-sm flex items-center gap-2 transition-all">
                    {creatingTask
                      ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Creando...</>
                      : <><Plus size={15} />Crear y Asignar Revisiones</>
                    }
                  </button>
                </div>
              </div>

              {/* Tareas Existentes */}
              <div className="bg-neutral-900 border border-white/8 rounded-2xl p-6 h-fit">
                <h2 className="font-black text-base mb-1">Misiones Existentes</h2>
                <p className="text-gray-500 text-xs mb-4">Administra el tiempo de las tareas generadas</p>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {tareas.map(t => (
                    <div key={t.id} className="flex justify-between items-center bg-neutral-950 border border-white/5 p-3 rounded-xl hover:border-white/10 transition-colors">
                      <div>
                        <p className="font-bold text-sm flex items-center gap-2">
                          {t.titulo}
                          {t.activa && <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>}
                        </p>
                        <p className="text-gray-500 text-[10px] mt-0.5">Fecha: {formatDate(t.fecha_tarea || '')} — Duración total: {t.horas_duracion}h</p>
                      </div>
                      <button onClick={() => addHours(t.id, 12)}
                        title="Añadir 12 horas a esta tarea"
                        className="flex items-center gap-1.5 text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                        <Clock size={12} /> + 12h
                      </button>
                    </div>
                  ))}
                  {tareas.length === 0 && <p className="text-center text-xs text-gray-500 py-4">No hay misiones creadas aún.</p>}
                </div>
              </div>
            </div>

            {/* Mapa de Calor */}
            <div className="bg-neutral-900 border border-white/8 rounded-2xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div>
                  <h2 className="font-black text-base flex items-center gap-2">
                    Mapa de Calor 
                    <button onClick={loadHeatMap} className="text-gray-500 hover:text-white transition-colors" title="Refrescar mapa">
                      <RefreshCw size={14} />
                    </button>
                  </h2>
                  <p className="text-gray-500 text-xs mt-0.5">Click en un círculo para modificar el estado manualmente</p>
                </div>
                {/* Filtros mapa */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex gap-1 bg-neutral-950 border border-white/10 p-1 rounded-xl">
                    <button onClick={() => setHeatColorFilter('todos')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${heatColorFilter === 'todos' ? 'bg-white text-neutral-900' : 'text-gray-400 hover:text-white'}`}>
                      Todos
                    </button>
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setHeatColorFilter(c)}
                        className={`w-6 h-6 rounded-lg ${COLOR_META[c].bg} transition-all ${heatColorFilter === c ? 'ring-2 ring-white ring-offset-1 ring-offset-neutral-900 scale-110' : 'opacity-60 hover:opacity-100'}`}
                        title={COLOR_META[c].label} />
                    ))}
                  </div>
                  <div className="flex gap-1 bg-neutral-950 border border-white/10 p-1 rounded-xl">
                    {(['nombre', 'estado'] as const).map(s => (
                      <button key={s} onClick={() => setHeatSort(s)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${heatSort === s ? 'bg-white text-neutral-900' : 'text-gray-400 hover:text-white'}`}>
                        {s === 'nombre' ? 'A→Z' : 'Por Estado'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Leyenda />

              {/* DÍA SELECCIONADO (TOP) */}
              <div className="mb-8">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${selectedHeatDate === TODAY ? 'bg-blue-400 animate-pulse' : 'bg-gray-400'}`} />
                  {selectedHeatDate === TODAY ? 'Hoy' : 'Día seleccionado'} — {formatDate(selectedHeatDate)}
                  {heatColorFilter !== 'todos' && (
                    <span className="text-[10px] font-normal text-gray-600">
                      ({getFilteredHeat().length} con estado {COLOR_META[heatColorFilter].label})
                    </span>
                  )}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-white/8">
                        <th className="text-left pb-2 pr-4 font-semibold">Promotor</th>
                        <th className="text-center pb-2 font-semibold">Color</th>
                        <th className="text-left pb-2 px-4 font-semibold">Debe revisar a</th>
                        <th className="text-left pb-2 pl-4 font-semibold text-xs">Estado Real</th>
                        <th className="text-right pb-2 font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {getFilteredHeat().map(row => {
                        const dia = row.dias[selectedHeatDate] || { self: null, asAuditor: [] };
                        const selfRev = dia.self;
                        const status = (selfRev?.admin_override || selfRev?.submission_status || 'rojo') as EstadoColor;
                        const hasPublished = status !== 'rojo';
                        const pendingAudits = (dia.asAuditor || []).filter((r: any) => r.voto === 'PENDIENTE').length;
                        
                        let stateText = '';
                        if (status === 'verde' || status === 'morado' || status === 'naranja') stateText = pendingAudits > 0 ? 'Misión lista, pero debe revisar' : '✅ 100% OK';
                        else if (hasPublished) stateText = pendingAudits > 0 ? 'Publicó, espera validación y debe revisar' : 'Publicó, espera validación';
                        else stateText = pendingAudits > 0 ? 'Falta publicar y revisar' : 'Falta publicar';

                        return (
                          <tr key={row.promotor?.id} className="hover:bg-neutral-800/20 transition-colors">
                            <td className="py-3 pr-4">
                              <a href={`https://www.instagram.com/${row.promotor?.instagram}/`} target="_blank" rel="noopener noreferrer"
                                className="font-semibold text-white hover:text-blue-400 transition-colors">
                                {row.promotor?.nombre}
                              </a>
                              <span className="text-gray-600 text-[10px] ml-1.5 opacity-50 block md:inline">@{row.promotor?.instagram}</span>
                            </td>
                            <td className="py-3 text-center">
                              <HeatCell revId={selfRev?.id || null} currentStatus={status} onOverride={overrideColor} />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1">
                                {(dia.asAuditor || []).map((a: any, i: number) => (
                                  <div key={i} className="flex items-center gap-1.5 text-[11px]">
                                    <span className={a.voto === 'PENDIENTE' ? 'text-yellow-500' : 'text-green-500'}>
                                      {a.voto === 'PENDIENTE' ? '⏳' : '✅'}
                                    </span>
                                    <span className={a.voto === 'PENDIENTE' ? 'text-gray-300' : 'text-gray-600'}>
                                      {a.target?.nombre || a.target?.instagram}
                                    </span>
                                  </div>
                                ))}
                                {(!dia.asAuditor || dia.asAuditor.length === 0) && (
                                  <span className="text-gray-600 text-[10px]">-</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 pl-4">
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${pendingAudits > 0 || !hasPublished ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                                <span className={`text-[11px] font-semibold ${pendingAudits > 0 || !hasPublished ? 'text-gray-300' : 'text-green-500'}`}>
                                  {stateText}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <button onClick={() => setImpersonated(row.promotor)}
                                className="inline-flex items-center justify-center bg-white/5 hover:bg-white/15 border border-white/10 text-white rounded-lg p-1.5 transition-colors"
                                title={`Ver panel como ${row.promotor?.nombre}`}>
                                <Eye size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {getFilteredHeat().length === 0 && (
                        <tr><td colSpan={5} className="py-8 text-center text-gray-600 text-xs">
                          {heatColorFilter !== 'todos' ? `No hay promotores con estado "${COLOR_META[heatColorFilter].label}" en esta fecha.` : 'No hay datos para esta fecha.'}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* HISTÓRICO */}
              {heatDates.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Historial Completo</h3>
                  <div className="overflow-x-auto">
                    <table className="text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs border-b border-white/8">
                          <th className="text-left pb-2 pr-6 font-semibold sticky left-0 bg-neutral-900 min-w-[150px]">Promotor</th>
                          {heatDates.map(d => (
                            <th key={d} 
                                onClick={() => setSelectedHeatDate(d)}
                                className={`text-center pb-2 px-3 font-semibold cursor-pointer transition-colors hover:text-white ${d === selectedHeatDate ? 'text-white bg-blue-500/20 border-b-2 border-blue-500' : (d === TODAY ? 'text-blue-400' : '')}`}>
                              {formatDate(d)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {heatData.map(row => (
                          <tr key={row.promotor?.id} className="hover:bg-neutral-800/20 transition-colors">
                            <td className="py-3 pr-6 sticky left-0 bg-neutral-900">
                              <a href={`https://www.instagram.com/${row.promotor?.instagram}/`} target="_blank" rel="noopener noreferrer"
                                className="font-semibold text-white hover:text-blue-400 transition-colors">
                                {row.promotor?.nombre}
                              </a>
                            </td>
                            {heatDates.map(d => {
                              const dia = row.dias[d] || { self: null };
                              const selfRev = dia.self;
                              const status = (selfRev?.admin_override || selfRev?.submission_status || 'rojo') as EstadoColor;
                              return (
                                <td key={d} className="py-3 px-3 text-center">
                                  <HeatCell revId={selfRev?.id || null} currentStatus={status} onOverride={overrideColor} />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ══ TAB ANALÍTICAS ════════════════════════════════════════════════ */}
        {activeTab === 'stats' && (() => {
          // Tipos de acción disponibles
          type TipoFiltro = 'visita' | 'click_tm' | 'click_gratis';

          // Obtener fechas únicas de métricas
          const metricDates = [...new Set(metrics.map((m: any) =>
            new Date(m.created_at).toISOString().split('T')[0]
          ))].sort() as string[];

          // Agrupar: { promotor_id → { fecha → count } }
          const grouped: Record<string, any> = {};
          metrics.forEach((m: any) => {
            const pid = m.promotor_id;
            const fecha = new Date(m.created_at).toISOString().split('T')[0];
            if (!grouped[pid]) grouped[pid] = { promotor: m.promotores, byDate: {}, total: { visita: 0, click_tm: 0, click_gratis: 0 } };
            if (!grouped[pid].byDate[fecha]) grouped[pid].byDate[fecha] = { visita: 0, click_tm: 0, click_gratis: 0 };
            if (m.tipo_accion in grouped[pid].byDate[fecha]) grouped[pid].byDate[fecha][m.tipo_accion]++;
            if (m.tipo_accion in grouped[pid].total) grouped[pid].total[m.tipo_accion]++;
          });

          const rows = Object.values(grouped).sort((a: any, b: any) => b.total[statsFilter] - a.total[statsFilter]);

          const tipoLabel: Record<TipoFiltro, string> = {
            visita: 'Visitas',
            click_tm: 'Clicks Ticketmaster',
            click_gratis: 'Clicks Entradas s/c',
          };
          const tipoColor: Record<TipoFiltro, string> = {
            visita: 'text-white',
            click_tm: 'text-green-400',
            click_gratis: 'text-blue-400',
          };

          return (
            <div className="space-y-6">
              {/* Tabla día × promotor */}
              <div className="bg-neutral-900 border border-white/8 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/8 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-black text-base flex items-center gap-2">
                    Tráfico por Día
                    <button onClick={loadMetrics} className="text-gray-500 hover:text-white transition-colors" title="Refrescar métricas">
                      <RefreshCw size={14} />
                    </button>
                  </h2>
                  {/* Filtro tipo */}
                  <div className="flex gap-1 bg-neutral-950 border border-white/10 p-1 rounded-xl">
                    {(['visita', 'click_tm', 'click_gratis'] as TipoFiltro[]).map(t => (
                      <button key={t} onClick={() => setStatsFilter(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statsFilter === t ? 'bg-white text-neutral-900' : 'text-gray-400 hover:text-white'}`}>
                        {tipoLabel[t]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-white/8 bg-neutral-950/50">
                        <th className="px-5 py-3 text-left font-semibold sticky left-0 bg-neutral-950/50 min-w-[150px]">Promotor</th>
                        {metricDates.map(d => (
                          <th key={d} className="px-4 py-3 text-center font-semibold min-w-[80px]">{formatDate(d)}</th>
                        ))}
                        <th className="px-4 py-3 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {rows.length === 0 ? (
                        <tr><td colSpan={metricDates.length + 2} className="px-6 py-8 text-center text-gray-600 text-xs">Sin datos aún.</td></tr>
                      ) : rows.map((r: any, idx: number) => (
                        <tr key={idx} className="hover:bg-neutral-800/20 transition-colors">
                          <td className="px-5 py-3 font-semibold sticky left-0 bg-neutral-900">
                            <a href={`https://www.instagram.com/${r.promotor?.instagram}/`} target="_blank" rel="noopener noreferrer"
                              className="hover:text-blue-400 transition-colors flex items-center gap-1.5">
                              {r.promotor?.nombre}
                              {idx === 0 && <span className="text-yellow-400 text-[10px]">🏆</span>}
                            </a>
                          </td>
                          {metricDates.map(d => {
                            const val = r.byDate[d]?.[statsFilter] || 0;
                            return (
                              <td key={d} className={`px-4 py-3 text-center font-mono ${val > 0 ? tipoColor[statsFilter] : 'text-gray-700'}`}>
                                {val > 0 ? val : '—'}
                              </td>
                            );
                          })}
                          <td className={`px-4 py-3 text-right font-mono font-bold ${tipoColor[statsFilter]}`}>
                            {r.total[statsFilter]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Totales por columna */}
                    {rows.length > 0 && (
                      <tfoot>
                        <tr className="border-t border-white/15 bg-neutral-950/50 text-xs font-bold text-gray-400">
                          <td className="px-5 py-3 sticky left-0 bg-neutral-950/50">TOTAL</td>
                          {metricDates.map(d => {
                            const total = rows.reduce((sum: number, r: any) => sum + (r.byDate[d]?.[statsFilter] || 0), 0);
                            return <td key={d} className={`px-4 py-3 text-center font-mono ${tipoColor[statsFilter]}`}>{total || '—'}</td>;
                          })}
                          <td className={`px-4 py-3 text-right font-mono ${tipoColor[statsFilter]}`}>
                            {rows.reduce((sum: number, r: any) => sum + r.total[statsFilter], 0)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Tabla resumen totalizado */}
              <div className="bg-neutral-900 border border-white/8 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/8">
                  <h2 className="font-black text-base">Resumen General</h2>
                  <p className="text-gray-500 text-xs mt-0.5">Totales acumulados por promotor</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-white/8 bg-neutral-950/50">
                      <th className="px-6 py-3 text-left font-semibold">Promotor</th>
                      <th className="px-6 py-3 text-right font-semibold">Visitas</th>
                      <th className="px-6 py-3 text-right font-semibold">Ticketmaster</th>
                      <th className="px-6 py-3 text-right font-semibold">Entradas s/c</th>
                      <th className="px-6 py-3 text-right font-semibold">Conv. TM %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rows.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-600 text-xs">Sin datos aún.</td></tr>
                    ) : rows.sort((a: any, b: any) => b.total.visita - a.total.visita).map((r: any, idx: number) => {
                      const conv = r.total.visita > 0 ? ((r.total.click_tm / r.total.visita) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={idx} className="hover:bg-neutral-800/20 transition-colors">
                          <td className="px-6 py-3 font-semibold flex items-center gap-2">
                            <a href={`https://www.instagram.com/${r.promotor?.instagram}/`} target="_blank" rel="noopener noreferrer"
                              className="hover:text-blue-400 transition-colors">{r.promotor?.nombre}</a>
                            {idx === 0 && <span className="bg-yellow-500/20 text-yellow-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-yellow-500/30">🏆 Top</span>}
                          </td>
                          <td className="px-6 py-3 text-right font-mono">{r.total.visita}</td>
                          <td className="px-6 py-3 text-right font-mono text-green-400">{r.total.click_tm}</td>
                          <td className="px-6 py-3 text-right font-mono text-blue-400">{r.total.click_gratis}</td>
                          <td className={`px-6 py-3 text-right font-mono font-bold ${parseFloat(conv) >= 10 ? 'text-green-400' : parseFloat(conv) >= 5 ? 'text-yellow-400' : 'text-gray-500'}`}>
                            {conv}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
