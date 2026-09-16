import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Settings, BarChart3, Plus, Trash2, Save,
  LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { supabase, type Promotor, type Tarea, type EstadoColor } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';

// ─── Constantes de color ────────────────────────────────────────────────────
const COLORS: EstadoColor[] = ['rojo', 'amarillo', 'verde', 'morado', 'naranja'];

const COLOR_STYLE: Record<EstadoColor, { bg: string; ring: string; label: string; desc: string }> = {
  rojo:    { bg: 'bg-red-500',    ring: 'ring-red-500',    label: 'Rojo',    desc: 'Pendiente / Castigado' },
  amarillo:{ bg: 'bg-yellow-400', ring: 'ring-yellow-400', label: 'Amarillo',desc: 'En revisión cruzada' },
  verde:   { bg: 'bg-green-500',  ring: 'ring-green-500',  label: 'Verde',   desc: 'Aprobado' },
  morado:  { bg: 'bg-purple-500', ring: 'ring-purple-500', label: 'Morado',  desc: 'Auditor leal (compañero falló)' },
  naranja: { bg: 'bg-orange-400', ring: 'ring-orange-400', label: 'Naranja', desc: 'Justificado' },
};

// ─── Utilidades ─────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0];

function formatDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

// ─── Sub-componente: Célula de Mapa de Calor (clicable) ─────────────────────
function HeatCell({ revId, currentStatus, onOverride }: {
  revId: string | null;
  currentStatus: EstadoColor;
  onOverride: (revId: string, color: EstadoColor) => void;
}) {
  const [open, setOpen] = useState(false);
  const c = COLOR_STYLE[currentStatus];

  if (!revId) return <span className="inline-block w-5 h-5 rounded-full bg-neutral-800 border border-white/10" title="Sin datos" />;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-5 h-5 rounded-full ${c.bg} ring-2 ring-offset-2 ring-offset-neutral-900 ${c.ring} opacity-90 hover:opacity-100 hover:scale-110 transition-all`}
        title={`${c.label}: ${c.desc}`}
      />
      {open && (
        <div className="absolute z-50 top-7 left-1/2 -translate-x-1/2 bg-neutral-800 border border-white/15 rounded-xl shadow-2xl p-2 flex gap-1.5">
          {COLORS.map(col => (
            <button
              key={col}
              onClick={() => { onOverride(revId, col); setOpen(false); }}
              className={`w-5 h-5 rounded-full ${COLOR_STYLE[col].bg} hover:scale-125 transition-transform`}
              title={COLOR_STYLE[col].label}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-componente: Histograma Leyenda ─────────────────────────────────────
function Leyenda() {
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {COLORS.map(c => (
        <div key={c} className="flex items-center gap-2 bg-neutral-900 border border-white/8 px-3 py-2 rounded-xl">
          <span className={`w-3.5 h-3.5 rounded-full ${COLOR_STYLE[c].bg}`} />
          <div>
            <span className="text-xs font-bold text-white">{COLOR_STYLE[c].label}</span>
            <span className="text-[10px] text-gray-500 ml-1">{COLOR_STYLE[c].desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function AdminPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'tasks' | 'stats'>('users');

  // ── Estado: Usuarios ──────────────────────────────────────────────────────
  const [promotores, setPromotores] = useState<Promotor[]>([]);
  const [editedRows, setEditedRows] = useState<Record<string, Partial<Promotor>>>({});
  const [savingUsers, setSavingUsers] = useState(false);

  // ── Estado: Tareas ────────────────────────────────────────────────────────
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [newTask, setNewTask] = useState({ titulo: '', horas_duracion: 24, material_nuevo: '', material_historico: '' });
  const [creatingTask, setCreatingTask] = useState(false);

  // ── Estado: Config global ─────────────────────────────────────────────────
  const [config, setConfig] = useState({ banner_url: '', material_nuevo_url: '', material_historico_url: '', auditores_por_tarea: 2 });
  const [savingConfig, setSavingConfig] = useState(false);

  // ── Estado: Mapa de calor ─────────────────────────────────────────────────
  const [heatData, setHeatData] = useState<any[]>([]);     // { promotor, dias: [{tarea_id, fecha, revId, status}] }
  const [heatDates, setHeatDates] = useState<string[]>([]); // fechas únicas ordenadas

  // ── Estado: Stats ──────────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<any[]>([]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    await Promise.all([loadUsers(), loadTareas(), loadConfig(), loadHeatMap(), loadMetrics()]);
  };

  // ── Cargar usuarios ───────────────────────────────────────────────────────
  const loadUsers = async () => {
    const { data } = await supabase.from('promotores').select('*').order('created_at');
    setPromotores(data || []);
  };

  // ── Cargar tareas ─────────────────────────────────────────────────────────
  const loadTareas = async () => {
    const { data } = await supabase.from('tareas').select('*').order('fecha_tarea', { ascending: false });
    setTareas(data || []);
  };

  // ── Cargar config ─────────────────────────────────────────────────────────
  const loadConfig = async () => {
    const { data } = await supabase.from('config').select('*').eq('id', 1).single();
    if (data) setConfig(data);
  };

  // ── Cargar mapa de calor ──────────────────────────────────────────────────
  const loadHeatMap = async () => {
    const { data: revs } = await supabase
      .from('revisiones')
      .select('*, tareas!revisiones_tarea_id_fkey(fecha_tarea, titulo), promotores!revisiones_promotor_id_fkey(id, nombre, instagram)')
      .order('created_at');

    if (!revs) return;

    // Recopilar fechas únicas
    const dates = [...new Set(revs.map((r: any) => r.tareas?.fecha_tarea).filter(Boolean))].sort();
    setHeatDates(dates as string[]);

    // Agrupar por promotor
    const byPromotor: Record<string, any> = {};
    revs.forEach((r: any) => {
      const pid = r.promotor_id;
      if (!byPromotor[pid]) {
        byPromotor[pid] = {
          promotor: r.promotores,
          dias: {},
        };
      }
      const fecha = r.tareas?.fecha_tarea;
      if (fecha) {
        byPromotor[pid].dias[fecha] = {
          revId: r.id,
          status: (r.admin_override || r.submission_status || 'rojo') as EstadoColor,
        };
      }
    });

    setHeatData(Object.values(byPromotor));
  };

  // ── Cargar métricas ───────────────────────────────────────────────────────
  const loadMetrics = async () => {
    const { data } = await supabase
      .from('metricas')
      .select('*, promotores!metricas_promotor_id_fkey(nombre, instagram)');
    setMetrics(data || []);
  };

  // ── USUARIOS: editar celda ────────────────────────────────────────────────
  const editCell = (id: string, field: keyof Promotor, value: string) => {
    setEditedRows(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const addRow = () => {
    const tempId = `new_${Date.now()}`;
    setPromotores(prev => [...prev, {
      id: tempId, nombre: '', rut: '', correo: '', clave: '', instagram: '', rol: 'promotor', created_at: ''
    }]);
  };

  const deleteRow = async (id: string) => {
    if (id.startsWith('new_')) {
      setPromotores(prev => prev.filter(p => p.id !== id));
      return;
    }
    if (!confirm('¿Eliminar este promotor?')) return;
    await supabase.from('promotores').delete().eq('id', id);
    setPromotores(prev => prev.filter(p => p.id !== id));
  };

  const saveUsers = async () => {
    setSavingUsers(true);
    const toUpsert: any[] = promotores.map(p => ({
      ...p,
      ...editedRows[p.id],
      ...(p.id.startsWith('new_') ? { id: undefined } : { id: p.id }),
    }));
    await supabase.from('promotores').upsert(toUpsert, { onConflict: 'id' });
    setEditedRows({});
    await loadUsers();
    setSavingUsers(false);
  };

  // ── TAREAS: crear ─────────────────────────────────────────────────────────
  const crearTarea = async () => {
    setCreatingTask(true);
    const titulo = newTask.titulo.trim() || `Tarea del día ${formatDate(TODAY)}`;

    // 1. Insertar tarea
    const { data: tarea, error } = await supabase
      .from('tareas')
      .insert([{ titulo, horas_duracion: newTask.horas_duracion, material_nuevo: newTask.material_nuevo, material_historico: newTask.material_historico, fecha_tarea: TODAY, activa: true }])
      .select()
      .single();

    if (error || !tarea) { alert('Error al crear tarea'); setCreatingTask(false); return; }

    // 2. Obtener promotores (solo rol promotor)
    const { data: proms } = await supabase.from('promotores').select('id').eq('rol', 'promotor');
    if (!proms || proms.length < 2) { alert('Se necesitan al menos 2 promotores'); setCreatingTask(false); return; }

    // 3. Algoritmo asignación circular: a cada promotor le tocan `auditores_por_tarea` compañeros siguientes
    const n = proms.length;
    const numAuditores = Math.min(config.auditores_por_tarea, n - 1);
    const revisiones: any[] = [];

    // Primero crear la entrada de "submission" de cada promotor (su propia tarea)
    proms.forEach((p) => {
      revisiones.push({
        tarea_id: tarea.id,
        promotor_id: p.id,
        auditor_id: p.id, // placeholder, se actualizará
        voto: 'PENDIENTE',
        submission_status: 'rojo',
      });
    });

    // Ahora las asignaciones de auditoría (circular)
    const auditAsignaciones: any[] = [];
    proms.forEach((promotor, idx) => {
      for (let k = 1; k <= numAuditores; k++) {
        const auditorIdx = (idx + k) % n;
        auditAsignaciones.push({
          tarea_id: tarea.id,
          promotor_id: proms[auditorIdx].id,   // el que será auditado
          auditor_id: promotor.id,              // el que audita
          voto: 'PENDIENTE',
          submission_status: 'rojo',
        });
      }
    });

    // Insertar submissions individuales (promotor_id = auditor_id como "mi propia tarea")
    const submissionRows = proms.map(p => ({
      tarea_id: tarea.id,
      promotor_id: p.id,
      auditor_id: p.id,
      voto: 'PENDIENTE',
      submission_status: 'rojo',
    }));

    await supabase.from('revisiones').insert([...submissionRows, ...auditAsignaciones]);

    setNewTask({ titulo: '', horas_duracion: 24, material_nuevo: '', material_historico: '' });
    await loadTareas();
    await loadHeatMap();
    setCreatingTask(false);
    alert(`Tarea "${titulo}" creada y asignada a ${proms.length} promotores ✓`);
  };

  // ── MAPA DE CALOR: override manual ───────────────────────────────────────
  const overrideColor = async (revId: string, color: EstadoColor) => {
    await supabase.from('revisiones').update({ admin_override: color }).eq('id', revId);
    await loadHeatMap();
  };

  // ── CONFIG GLOBAL: guardar ────────────────────────────────────────────────
  const saveConfig = async () => {
    setSavingConfig(true);
    await supabase.from('config').upsert({ ...config, id: 1 });
    setSavingConfig(false);
  };

  const handleLogout = () => { logout(); navigate('/promotor/login'); };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Top Nav */}
      <nav className="border-b border-white/8 bg-neutral-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black tracking-tight">Admin Hub</span>
            <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-red-500/30">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs">{(user as any)?.nombre}</span>
            <button onClick={handleLogout} className="bg-neutral-800 hover:bg-neutral-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/8">
              <LogOut size={13} /> Salir
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-neutral-900 border border-white/8 p-1 rounded-xl mb-8 w-fit">
          {[
            { id: 'users', label: 'Usuarios', icon: Users },
            { id: 'tasks', label: 'Gestor de Tareas', icon: Settings },
            { id: 'stats', label: 'Analíticas', icon: BarChart3 },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === id ? 'bg-white text-neutral-900 shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* ═══ TAB: USUARIOS ═══════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div className="bg-neutral-900 border border-white/8 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <h2 className="font-black text-lg">Gestión de Promotores</h2>
              <div className="flex gap-2">
                <button
                  onClick={saveUsers}
                  disabled={savingUsers || Object.keys(editedRows).length === 0}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 text-sm transition-all"
                >
                  <Save size={14} /> {savingUsers ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>

            {/* Tabla editable */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/8 bg-neutral-950/50">
                    <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                    <th className="px-4 py-3 text-left font-semibold">RUT</th>
                    <th className="px-4 py-3 text-left font-semibold">Correo</th>
                    <th className="px-4 py-3 text-left font-semibold">Contraseña</th>
                    <th className="px-4 py-3 text-left font-semibold">Instagram</th>
                    <th className="px-4 py-3 text-left font-semibold">Rol</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {promotores.map(p => {
                    const edited = editedRows[p.id] || {};
                    const val = (field: keyof Promotor) => (edited[field] ?? p[field]) as string;
                    const isDirty = !!editedRows[p.id];
                    return (
                      <tr key={p.id} className={`group transition-colors ${isDirty ? 'bg-blue-900/10' : 'hover:bg-neutral-800/30'}`}>
                        {(['nombre', 'rut', 'correo', 'clave', 'instagram'] as const).map(field => (
                          <td key={field} className="px-3 py-2">
                            <input
                              type={field === 'clave' ? 'text' : 'text'}
                              value={val(field)}
                              onChange={e => editCell(p.id, field, e.target.value)}
                              className="w-full bg-transparent border border-transparent hover:border-white/15 focus:border-blue-500/60 focus:bg-neutral-900 rounded-lg px-2 py-1.5 outline-none transition-all min-w-[100px]"
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          <select
                            value={val('rol')}
                            onChange={e => editCell(p.id, 'rol', e.target.value)}
                            className="bg-neutral-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-500/60"
                          >
                            <option value="promotor">Promotor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => deleteRow(p.id)}
                            className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Fila añadir */}
            <div className="px-4 py-3 border-t border-white/8">
              <button
                onClick={addRow}
                className="flex items-center gap-2 text-gray-500 hover:text-white text-xs font-bold transition-colors hover:bg-white/5 px-3 py-2 rounded-lg"
              >
                <Plus size={14} /> Añadir promotor
              </button>
            </div>
          </div>
        )}

        {/* ═══ TAB: GESTOR DE TAREAS ══════════════════════════════════════════ */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">

            {/* Config Global */}
            <div className="bg-neutral-900 border border-white/8 rounded-2xl p-6">
              <h2 className="font-black text-base mb-4">Configuración Global (Landing)</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {([
                  ['banner_url', 'URL Imagen del Banner'],
                  ['material_nuevo_url', 'URL Material Nuevo (Drive)'],
                  ['material_historico_url', 'URL Material Histórico (Drive)'],
                ] as const).map(([field, label]) => (
                  <div key={field}>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">{label}</label>
                    <input
                      type="text"
                      value={config[field]}
                      onChange={e => setConfig(c => ({ ...c, [field]: e.target.value }))}
                      className="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-blue-500/60 outline-none transition-all"
                      placeholder="https://..."
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Auditores por tarea</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={config.auditores_por_tarea}
                    onChange={e => setConfig(c => ({ ...c, auditores_por_tarea: parseInt(e.target.value) }))}
                    className="w-20 bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-blue-500/60 outline-none text-center"
                  />
                </div>
                <button
                  onClick={saveConfig}
                  disabled={savingConfig}
                  className="mt-5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2 px-5 rounded-xl text-sm flex items-center gap-2 transition-colors border border-white/10"
                >
                  <Save size={14} /> {savingConfig ? 'Guardando...' : 'Guardar Config'}
                </button>
              </div>
            </div>

            {/* Nueva Tarea */}
            <div className="bg-neutral-900 border border-white/8 rounded-2xl p-6">
              <h2 className="font-black text-base mb-4">Nueva Tarea Diaria</h2>
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newTask.titulo}
                    onChange={e => setNewTask(t => ({ ...t, titulo: e.target.value }))}
                    placeholder={`Tarea del día ${formatDate(TODAY)} (dejar vacío para título automático)`}
                    className="flex-1 bg-neutral-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500/60 outline-none transition-all"
                  />
                  <div className="flex items-center gap-2 bg-neutral-950 border border-white/10 rounded-xl px-4 py-2.5 min-w-[120px]">
                    <span className="text-xs text-gray-500">Horas:</span>
                    <input
                      type="number"
                      min={1}
                      max={72}
                      value={newTask.horas_duracion}
                      onChange={e => setNewTask(t => ({ ...t, horas_duracion: parseInt(e.target.value) }))}
                      className="w-12 bg-transparent text-sm outline-none text-center font-mono"
                    />
                  </div>
                </div>
                <button
                  onClick={crearTarea}
                  disabled={creatingTask}
                  className="self-end bg-white text-neutral-900 hover:bg-gray-100 disabled:opacity-50 font-black py-2.5 px-6 rounded-xl text-sm flex items-center gap-2 transition-all"
                >
                  {creatingTask ? (
                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Creando...</>
                  ) : <><Plus size={15} /> Crear y Asignar Revisiones</>}
                </button>
              </div>
            </div>

            {/* Mapa de Calor */}
            <div className="bg-neutral-900 border border-white/8 rounded-2xl p-6">
              <h2 className="font-black text-base mb-2">Mapa de Calor</h2>
              <p className="text-gray-500 text-xs mb-5">Haz clic en cualquier círculo para modificar el estado manualmente</p>

              <Leyenda />

              {/* Tabla HOY */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"/> Hoy — {formatDate(TODAY)}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-white/8">
                        <th className="text-left pb-2 pr-4 font-semibold">Promotor</th>
                        <th className="text-center pb-2 font-semibold">{formatDate(TODAY)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {heatData.map(row => {
                        const dia = row.dias[TODAY];
                        return (
                          <tr key={row.promotor?.id} className="hover:bg-neutral-800/30 transition-colors">
                            <td className="py-3 pr-4 font-semibold">
                              <a
                                href={`https://www.instagram.com/${row.promotor?.instagram}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white hover:text-blue-400 transition-colors"
                              >
                                {row.promotor?.nombre}
                              </a>
                              <span className="text-gray-600 text-xs ml-1">@{row.promotor?.instagram}</span>
                            </td>
                            <td className="py-3 text-center">
                              <HeatCell
                                revId={dia?.revId || null}
                                currentStatus={dia?.status || 'rojo'}
                                onOverride={overrideColor}
                              />
                            </td>
                          </tr>
                        );
                      })}
                      {heatData.length === 0 && (
                        <tr><td colSpan={2} className="py-8 text-center text-gray-600 text-xs">No hay datos para hoy aún.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabla HISTÓRICO */}
              {heatDates.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Historial Completo</h3>
                  <div className="overflow-x-auto">
                    <table className="text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs border-b border-white/8">
                          <th className="text-left pb-2 pr-6 font-semibold sticky left-0 bg-neutral-900">Promotor</th>
                          {heatDates.map(d => (
                            <th key={d} className={`text-center pb-2 px-3 font-semibold ${d === TODAY ? 'text-blue-400' : ''}`}>
                              {formatDate(d)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {heatData.map(row => (
                          <tr key={row.promotor?.id} className="hover:bg-neutral-800/30 transition-colors">
                            <td className="py-3 pr-6 font-semibold sticky left-0 bg-neutral-900">
                              <a
                                href={`https://www.instagram.com/${row.promotor?.instagram}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white hover:text-blue-400 transition-colors"
                              >
                                {row.promotor?.nombre}
                              </a>
                            </td>
                            {heatDates.map(d => {
                              const dia = row.dias[d];
                              return (
                                <td key={d} className="py-3 px-3 text-center">
                                  <HeatCell
                                    revId={dia?.revId || null}
                                    currentStatus={dia?.status || 'rojo'}
                                    onOverride={overrideColor}
                                  />
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

            {/* Lista de tareas creadas */}
            <div className="bg-neutral-900 border border-white/8 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/8">
                <h2 className="font-black text-base">Tareas Creadas</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-white/8 bg-neutral-950/50">
                    <th className="px-6 py-3 text-left font-semibold">Título</th>
                    <th className="px-6 py-3 text-left font-semibold">Fecha</th>
                    <th className="px-6 py-3 text-left font-semibold">Horas</th>
                    <th className="px-6 py-3 text-left font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tareas.map(t => (
                    <tr key={t.id} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="px-6 py-3 font-medium">{t.titulo}</td>
                      <td className="px-6 py-3 text-gray-400 font-mono text-xs">{formatDate(t.fecha_tarea)}</td>
                      <td className="px-6 py-3 text-gray-400 font-mono">{t.horas_duracion}h</td>
                      <td className="px-6 py-3">
                        {t.activa
                          ? <span className="bg-green-500/15 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-500/30">Activa</span>
                          : <span className="bg-neutral-800 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">Inactiva</span>
                        }
                      </td>
                    </tr>
                  ))}
                  {tareas.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-600 text-xs">No hay tareas creadas aún.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ TAB: ANALÍTICAS ════════════════════════════════════════════════ */}
        {activeTab === 'stats' && (
          <div className="bg-neutral-900 border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/8">
              <h2 className="font-black text-lg">Tráfico de Enlaces</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-white/8 bg-neutral-950/50">
                  <th className="px-6 py-3 text-left font-semibold">Promotor</th>
                  <th className="px-6 py-3 text-right font-semibold">Visitas</th>
                  <th className="px-6 py-3 text-right font-semibold">Clicks Ticketmaster</th>
                  <th className="px-6 py-3 text-right font-semibold">Clicks Gratis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(() => {
                  // Agrupar métricas por promotor
                  const grouped: Record<string, any> = {};
                  metrics.forEach(m => {
                    const pid = m.promotor_id;
                    if (!grouped[pid]) grouped[pid] = { promotor: m.promotores, visitas: 0, tm: 0, gratis: 0 };
                    if (m.tipo_accion === 'visita') grouped[pid].visitas++;
                    if (m.tipo_accion === 'click_tm') grouped[pid].tm++;
                    if (m.tipo_accion === 'click_gratis') grouped[pid].gratis++;
                  });
                  const rows = Object.values(grouped).sort((a: any, b: any) => b.visitas - a.visitas);
                  if (rows.length === 0) return (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-600 text-xs">No hay datos de tráfico aún.</td></tr>
                  );
                  return rows.map((r: any, idx) => (
                    <tr key={idx} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="px-6 py-3 font-semibold flex items-center gap-2">
                        {r.promotor?.nombre}
                        {idx === 0 && <span className="bg-blue-500/20 text-blue-400 text-[9px] px-2 py-0.5 rounded-full uppercase border border-blue-500/30">Top 1</span>}
                      </td>
                      <td className="px-6 py-3 text-right font-mono">{r.visitas}</td>
                      <td className="px-6 py-3 text-right font-mono text-green-400">{r.tm}</td>
                      <td className="px-6 py-3 text-right font-mono text-blue-400">{r.gratis}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
