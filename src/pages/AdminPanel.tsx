import React, { useState, useEffect } from 'react';
import {
  Users, Settings, BarChart3, Plus, Trash2, Save,
  LogOut, Search, Copy, ChevronUp, ChevronDown, Clock, ShieldCheck, RefreshCw, FileText, Eye, ExternalLink, User, PlayCircle
} from 'lucide-react';
import { supabase, transformDriveUrl, type Promotor, type Tarea, type EstadoColor, type Config, type Rol } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import PromoterDashboard from './PromoterDashboard';
import FlowchartViewer from '../components/FlowchartViewer';
import { formatRut, formatPhone, formatIg } from '../lib/utils';

// ─── Constantes de color ─────────────────────────────────────────────────────
const COLORS: EstadoColor[] = ['rojo', 'amarillo', 'verde', 'morado', 'naranja'];

const COLOR_META: Record<EstadoColor, { bg: string; ring: string; label: string; desc: string }> = {
  rojo:    { bg: 'bg-red-500',    ring: 'ring-red-500',    label: 'Rojo',     desc: 'Pendiente / Castigado' },
  amarillo:{ bg: 'bg-yellow-400', ring: 'ring-yellow-400', label: 'Amarillo', desc: 'En revisión cruzada' },
  verde:   { bg: 'bg-green-500',  ring: 'ring-green-500',  label: 'Verde',    desc: 'Aprobado' },
  morado:  { bg: 'bg-teal-500',   ring: 'ring-teal-500',   label: 'Verde (Reportó)', desc: 'Aprobado, revisión temprana' },
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
  fecha_evento: '2027-01-15', whatsapp_numero: '', whatsapp_mensaje: '',
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function AdminPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isRevisor = user?.rol === 'revisor' || user?.rol === 'vendedor_revisor';
  const isAdmin = user?.rol === 'admin';
  const [activeTab, setActiveTab] = useState<'users' | 'tasks' | 'stats' | 'config' | 'flow'>('tasks');

  // ── Usuarios ──────────────────────────────────────────────────────────────
  const [promotores, setPromotores] = useState<Promotor[]>([]);
  const [editedRows, setEditedRows] = useState<Record<string, Partial<Promotor>>>({});
  const [savingUsers, setSavingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRolFilter, setUserRolFilter] = useState<'todos' | 'promotor' | 'admin' | 'vendedor'>('todos');
  const [userSort, setUserSort] = useState<{ field: keyof Promotor; dir: 'asc' | 'desc' }>({ field: 'nombre', dir: 'asc' });
  const [copied, setCopied] = useState<string | null>(null);
  const [showExtraCols, setShowExtraCols] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [newMember, setNewMember] = useState({ correo: '', nombre: '', instagram: '', telefono: '', rut: '', team: 'Promotor', link_tm: '' });

  // ── Tareas ────────────────────────────────────────────────────────────────
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [newTask, setNewTask] = useState({ titulo: '', horas_duracion: 24, horas_revision: 4, material_nuevo: '', link_publicitario: 'https://www.instagram.com/hsuevents.cl/' });
  const [showNewTaskLink, setShowNewTaskLink] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [editingTaskTitle, setEditingTaskTitle] = useState<{ id: string; titulo: string; link_publicitario: string } | null>(null);
  const [heatCountdown, setHeatCountdown] = useState('');
  const [heatRevCountdown, setHeatRevCountdown] = useState('');
  const [newTaskAuditores, setNewTaskAuditores] = useState(0);

  // ── Config ────────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);
  // Link visibility toggles (each field shows/hides the input)
  const [visibleLinks, setVisibleLinks] = useState<Record<string, boolean>>({});
  const toggleLink = (key: string) => setVisibleLinks(p => ({ ...p, [key]: !p[key] }));

  // ── Mapa de calor ─────────────────────────────────────────────────────────
  const [heatData, setHeatData] = useState<any[]>([]);
  const [heatTasks, setHeatTasks] = useState<{ id: string, fecha: string, titulo: string }[]>([]);
  const heatMapRef = React.useRef<HTMLDivElement>(null);
  const [heatColorFilter, setHeatColorFilter] = useState<EstadoColor | 'todos'>('todos');
  const [toastMsg, setToastMsg] = useState('');
  const [heatAdminFilter, setHeatAdminFilter] = useState<'todos' | 'revisadas' | 'pendientes'>('todos');
  const [heatRolFilter, setHeatRolFilter] = useState<'todos' | 'promotor' | 'vendedor'>('todos');
  const [heatSort, setHeatSort] = useState<'nombre' | 'estado'>('nombre');
  const [selectedHeatTask, setSelectedHeatTask] = useState<string>('');
  const [heatMapOpen, setHeatMapOpen] = useState(true);
  const [heatHistoryOpen, setHeatHistoryOpen] = useState(true);

  // ── Impersonation ─────────────────────────────────────────────────────────
  const [impersonated, setImpersonated] = useState<any>(null);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<any[]>([]);
  const [statsFilter, setStatsFilter] = useState<'visita' | 'click_tm' | 'click_gratis'>('visita');
  const [loading, setLoading] = useState(true);
  const [csvData, setCsvData] = useState('');

  useEffect(() => { loadAll().then(() => { if (isAdmin) ensureTodayTask(); }); }, []);

  const handleImportCsv = () => {
    if (!csvData.trim()) return;
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return alert('Debes incluir al menos una fila de cabeceras y una de datos.');
    
    // Detect separator (comma or tab)
    const sep = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
    
    const required = ['nombre', 'correo', 'instagram'];
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length > 0) return alert(`Faltan cabeceras obligatorias: ${missing.join(', ')}\nAsegúrate de escribir "nombre, correo, instagram" como cabeceras (o separadas por tabulador si es Excel).`);

    const newUsers: Promotor[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(sep);
      const row: any = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx]?.trim() || '';
      });
      
      const tempId = `new_csv_${Date.now()}_${i}`;
      const newUser: any = {
        id: tempId,
        nombre: row.nombre,
        correo: row.correo,
        instagram: formatIg(row.instagram || ''),
        clave: row.clave || '1234',
        rol: (row.rol || 'promotor').toLowerCase() as Rol,
        rut: formatRut(row.rut || ''),
        telefono: formatPhone(row.telefono || ''),
        ticketmaster_url: row.ticketmaster_url || ''
      };
      
      newUsers.push(newUser);
    }
    
    // Añadimos a la tabla local y marcamos como editados para que "Guardar" los inserte
    setPromotores(prev => [...prev, ...newUsers]);
    
    const newEditedRows: any = {};
    newUsers.forEach(u => {
      newEditedRows[u.id] = { ...u };
    });
    setEditedRows(prev => ({ ...prev, ...newEditedRows }));
    setCsvData('');
    alert(`Se prepararon ${newUsers.length} usuarios para insertar. Revisa la tabla y presiona "Guardar" arriba para confirmar los cambios a la base de datos.`);
  };

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

  // ── Doble countdown para la tarea seleccionada ──────────────────────────────
  useEffect(() => {
    const selTask = tareas.find(t => t.id === selectedHeatTask);
    if (!selTask) { setHeatCountdown(''); setHeatRevCountdown(''); return; }
    const created = new Date(selTask.created_at || selTask.fecha_tarea + 'T10:00:00Z');
    const expiry = new Date(created.getTime() + (selTask.horas_duracion || 24) * 3600000);
    const revHours = selTask.horas_revision || 0;
    const revDeadline = revHours > 0 ? new Date(expiry.getTime() - revHours * 3600000) : null;

    const tick = () => {
      const now = Date.now();
      const diff = expiry.getTime() - now;
      if (diff <= 0) { setHeatCountdown('Expirado'); }
      else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setHeatCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      }
      if (revDeadline) {
        const rd = revDeadline.getTime() - now;
        if (rd <= 0) setHeatRevCountdown('Tiempo de revisión cerrado');
        else {
          const h = Math.floor(rd / 3600000);
          const m = Math.floor((rd % 3600000) / 60000);
          const s = Math.floor((rd % 60000) / 1000);
          setHeatRevCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
        }
      } else { setHeatRevCountdown(''); }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [selectedHeatTask, tareas]);

  // ── Guardar nombre y link de tarea ─────────────────────────────────────────
  const saveTaskTitle = async () => {
    if (!editingTaskTitle) return;
    await supabase.from('tareas').update({ 
      titulo: editingTaskTitle.titulo, 
      link_publicitario: editingTaskTitle.link_publicitario 
    }).eq('id', editingTaskTitle.id);
    
    setTareas(prev => prev.map(t => t.id === editingTaskTitle.id 
      ? { ...t, titulo: editingTaskTitle.titulo, link_publicitario: editingTaskTitle.link_publicitario } 
      : t
    ));
    setEditingTaskTitle(null);
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
    // 1. Obtener promotores Y vendedores (excluir solo admins del mapa)
    const { data: proms } = await supabase.from('promotores').select('id, nombre, instagram, rol').in('rol', ['promotor', 'vendedor']).order('created_at');
    if (!proms) return;
    
    // 2. Obtener tareas (descendente para que lo más reciente esté primero/izquierda)
    const { data: tareasData } = await supabase.from('tareas').select('id, fecha_tarea, titulo, horas_duracion, horas_revision, created_at').order('created_at', { ascending: false });
    if (!tareasData) return;
    const taskList = tareasData.map(t => ({ id: t.id, fecha: t.fecha_tarea, titulo: t.titulo }));
    setHeatTasks(taskList);
    
    if (!selectedHeatTask && taskList.length > 0) {
      setSelectedHeatTask(taskList[0].id); // La más reciente
    }

    // 3. Obtener revisiones
    const { data: revs } = await supabase
      .from('revisiones')
      .select('*, tareas!revisiones_tarea_id_fkey(fecha_tarea), target:promotores!revisiones_promotor_id_fkey(id, nombre, instagram)')
      .order('created_at');

    const byPromotor: Record<string, any> = {};
    proms.forEach((p: any) => {
      byPromotor[p.id] = { promotor: p, tareas: {} };
    });

    if (revs) {
      revs.forEach((r: any) => {
        const tareaId = r.tarea_id;
        if (!tareaId) return;
        const pId = r.promotor_id;
        const aId = r.auditor_id;
        
        if (!byPromotor[pId]) return;
        if (!byPromotor[pId].tareas[tareaId]) byPromotor[pId].tareas[tareaId] = { self: null, asAuditor: [], incomingAudits: [] };
        if (!byPromotor[aId]) return;
        if (!byPromotor[aId].tareas[tareaId]) byPromotor[aId].tareas[tareaId] = { self: null, asAuditor: [], incomingAudits: [] };

        if (pId === aId) {
          byPromotor[pId].tareas[tareaId].self = r;
        } else {
          byPromotor[aId].tareas[tareaId].asAuditor.push(r);
          byPromotor[pId].tareas[tareaId].incomingAudits.push(r);
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

  
  const handleSyncSheets = async () => {
    if (!confirm('¿Deseas sincronizar la base de datos con Google Sheets ahora mismo?')) return;
    setSyncingSheets(true);
    try {
      await fetch('https://script.google.com/macros/s/AKfycbwJ5FyujTc8-GlgNsGqDkv64Z0uSKSNnZtQ607PTQUxZ6CG4-p2QaMFdmRz-m60gvAWYA/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'sync' })
      });
      setTimeout(() => {
        loadUsers();
        setSyncingSheets(false);
        setToastMsg('Sincronización completada');
        setTimeout(() => setToastMsg(''), 3000);
      }, 3000);
    } catch (e) {
      setSyncingSheets(false);
      alert('Error de red al sincronizar.');
    }
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncingSheets(true);
    try {
      await fetch('https://script.google.com/macros/s/AKfycbwJ5FyujTc8-GlgNsGqDkv64Z0uSKSNnZtQ607PTQUxZ6CG4-p2QaMFdmRz-m60gvAWYA/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'add', data: newMember })
      });
      setTimeout(() => {
        loadUsers();
        setSyncingSheets(false);
        setShowAddModal(false);
        setNewMember({ correo: '', nombre: '', instagram: '', telefono: '', rut: '', team: 'Promotor', link_tm: '' });
        setToastMsg('Integrante añadido y sincronizado');
        setTimeout(() => setToastMsg(''), 3000);
      }, 3000);
    } catch (e) {
      setSyncingSheets(false);
      alert('Error de red.');
    }
  };

  const addRow = () => {
    const tempId = `new_${Date.now()}`;
    setPromotores(prev => [...prev, { id: tempId, nombre: '', rut: '', correo: '', clave: '', instagram: '', rol: 'promotor' }]);
  };

  const deleteRow = async (id: string) => {
    if (id.startsWith('new_')) { setPromotores(prev => prev.filter(p => p.id !== id)); return; }
    const res = prompt('ATENCIÓN: ¿Estás seguro que deseas eliminar este promotor y todo su historial? Escribe ELIMINAR para confirmar.');
    if (res !== 'ELIMINAR') {
      if (res !== null) alert('Eliminación cancelada. Debes escribir ELIMINAR.');
      return;
    }
    
    const targetUser = promotores.find(p => p.id === id);
    
    await supabase.from('promotores').delete().eq('id', id);
    setPromotores(prev => prev.filter(p => p.id !== id));

    if (targetUser && targetUser.correo) {
      try {
        await fetch('https://script.google.com/macros/s/AKfycbwJ5FyujTc8-GlgNsGqDkv64Z0uSKSNnZtQ607PTQUxZ6CG4-p2QaMFdmRz-m60gvAWYA/exec', {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'delete', correo: targetUser.correo })
        });
      } catch (e) {
        console.error('Error syncing delete to sheets', e);
      }
    }
  };

  const saveUsers = async () => {
    setSavingUsers(true);
    
    // Separar en INSERT (nuevos) y UPDATE (existentes) para evitar conflictos de columnas con Supabase
    const newRowsToInsert = promotores
      .filter(p => p.id.startsWith('new_') && editedRows[p.id])
      .map(p => {
        const row = { ...p, ...editedRows[p.id] };
        if (row.rut) row.rut = formatRut(row.rut as string);
        if (row.telefono) row.telefono = formatPhone(row.telefono as string);
        if (row.instagram) row.instagram = formatIg(row.instagram as string);
        delete (row as any).id; // Remove temporary ID
        return row;
      });

    const existingRowsToUpdate = promotores
      .filter(p => !p.id.startsWith('new_') && editedRows[p.id])
      .map(p => {
        const row = { ...p, ...editedRows[p.id] };
        if (row.rut) row.rut = formatRut(row.rut as string);
        if (row.telefono) row.telefono = formatPhone(row.telefono as string);
        if (row.instagram) row.instagram = formatIg(row.instagram as string);
        return row;
      });

    try {
      if (newRowsToInsert.length > 0) {
        const { error } = await supabase.from('promotores').insert(newRowsToInsert);
        if (error) throw error;
      }
      
      if (existingRowsToUpdate.length > 0) {
        const { error } = await supabase.from('promotores').upsert(existingRowsToUpdate, { onConflict: 'id' });
        if (!error) {
          try {
            await fetch('https://script.google.com/macros/s/AKfycbwJ5FyujTc8-GlgNsGqDkv64Z0uSKSNnZtQ607PTQUxZ6CG4-p2QaMFdmRz-m60gvAWYA/exec', {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({ action: 'update', data: existingRowsToUpdate })
            });
          } catch(e) {}
        }
        if (error) throw error;
      }
      
      setEditedRows({});
      await loadUsers();
    } catch (err: any) {
      alert('Error guardando usuarios: ' + (err.message || 'Verifica los datos.'));
      console.error(err);
    }
    
    setSavingUsers(false);
  };

  const copyLink = async (instagram: string, type: 'ref' | 'login', personalTmUrl?: string) => {
    let url;
    if (type === 'ref') {
      url = personalTmUrl ? personalTmUrl : (config.ticketmaster_url ? config.ticketmaster_url : `${window.location.origin}/?ref=${instagram}`);
    } else {
      url = `${window.location.origin}/promotor/login`;
    }
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

  const crearTarea = async () => {
    setCreatingTask(true);
    const titulo = newTask.titulo.trim() || `Tarea del día ${formatDate(TODAY)}`;
    
    // Promotores para revisiones cruzadas
    const { data: promsData } = await supabase.from('promotores').select('id').eq('rol', 'promotor');
    // Vendedores participan sin revisión cruzada
    const { data: vendedoresData } = await supabase.from('promotores').select('id').eq('rol', 'vendedor');
    // Vendedor+Revisor participan como vendedor en la tarea (switch propio) + pueden revisar
    const { data: vrData } = await supabase.from('promotores').select('id').eq('rol', 'vendedor_revisor');

    if (!promsData || promsData.length === 0) {
      alert('No hay promotores para asignar.');
      setCreatingTask(false);
      return;
    }

    // Fisher-Yates Shuffle
    const proms = [...promsData];
    for (let i = proms.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [proms[i], proms[j]] = [proms[j], proms[i]];
    }

    const { data: tarea, error } = await supabase.from('tareas').insert({
      titulo, horas_duracion: newTask.horas_duracion, horas_revision: newTask.horas_revision || 0,
      material_nuevo: newTask.material_nuevo, activa: true, fecha_tarea: TODAY, auto_generada: false,
      link_publicitario: newTask.link_publicitario || 'https://www.instagram.com/hsuevents.cl/'
    }).select().single();

    if (error || !tarea) { alert('Error al crear tarea: ' + error?.message); setCreatingTask(false); return; }
    
    const tareaId = tarea.id;
    const selfRows: any[] = [];
    const auditRows: any[] = [];

    // Desactivar las de días anteriores
    await supabase.from('tareas').update({ activa: false }).neq('id', tareaId);

    const numAuditores = Math.min(newTaskAuditores, proms.length - 1);

    // Promotores: revisión cruzada entre sí
    proms.forEach((p, i) => {
      selfRows.push({ tarea_id: tareaId, promotor_id: p.id, auditor_id: p.id, voto: 'SI', submission_status: 'rojo' });
      for (let k = 1; k <= numAuditores; k++) {
        const audIdx = (i + k) % proms.length;
        auditRows.push({ tarea_id: tareaId, promotor_id: proms[audIdx].id, auditor_id: p.id, voto: 'PENDIENTE', submission_status: 'rojo' });
      }
    });

    // Vendedores: solo su propia entrada (sin auditores cruzados)
    (vendedoresData || []).forEach(v => {
      selfRows.push({ tarea_id: tareaId, promotor_id: v.id, auditor_id: v.id, voto: 'SI', submission_status: 'rojo' });
    });

    // Vendedor+Revisores: también tienen su propia entrada (pueden activar su switch)
    (vrData || []).forEach(v => {
      selfRows.push({ tarea_id: tareaId, promotor_id: v.id, auditor_id: v.id, voto: 'SI', submission_status: 'rojo' });
    });

    await supabase.from('revisiones').insert([...selfRows, ...auditRows]);

    setNewTask({ titulo: '', horas_duracion: 24, horas_revision: 0, material_nuevo: '', link_publicitario: 'https://www.instagram.com/hsuevents.cl/' });
    setShowNewTaskLink(false);
    await Promise.all([loadTareas(), loadHeatMap()]);
    setCreatingTask(false);
    alert(`"${titulo}" creada y asignada a ${proms.length} promotores, ${(vendedoresData || []).length} vendedores y ${(vrData || []).length} vendedor+revisores ✓`);
  };


  // ── Mapa calor: override (toggle — mismo color = quita el override) ──────
  const overrideColor = async (revId: string | null, color: EstadoColor | null, promotorId?: string, tareaId?: string) => {
    if (!revId) {
      if (!promotorId || !tareaId) return alert('Sin datos para este promotor en este día.');
      await supabase.from('revisiones').insert({
        tarea_id: tareaId,
        promotor_id: promotorId,
        auditor_id: promotorId,
        voto: 'SI',
        submission_status: 'rojo',
        admin_override: color
      });
      loadHeatMap();
      return;
    }
    await supabase.from('revisiones').update({ admin_override: color }).eq('id', revId);
    loadHeatMap();
  };

  // ── Tareas: eliminar ──────────────────────────────────────────────────────
  const deleteTask = async (tareaId: string, titulo: string) => {
    const res = prompt(`Vas a eliminar la tarea "${titulo}" y TODAS sus revisiones.\nEscribe ELIMINAR para confirmar:`);
    if (res !== 'ELIMINAR') { if (res !== null) alert('Cancelado.'); return; }
    await supabase.from('revisiones').delete().eq('tarea_id', tareaId);
    await supabase.from('tareas').delete().eq('id', tareaId);
    await Promise.all([loadTareas(), loadHeatMap()]);
  };

  // ── Auto-crear tarea del día si no existe ─────────────────────────────────
  const ensureTodayTask = async () => {
    // Verificar si ya existe tarea para hoy
    const { data: existing } = await supabase.from('tareas').select('id, auto_generada').eq('fecha_tarea', TODAY);
    if (existing && existing.length > 0) return; // Ya existe, no hacer nada

    // Obtener todos los participantes
    const { data: promsData } = await supabase.from('promotores').select('id, rol').in('rol', ['promotor', 'vendedor', 'vendedor_revisor']);
    if (!promsData || promsData.length === 0) return;

    // Crear tarea fantasma auto-generada (sin auditores cruzados por defecto)
    const { data: tarea, error } = await supabase.from('tareas').insert({
      titulo: `Tarea del día ${formatDate(TODAY)}`,
      horas_duracion: 24,
      horas_revision: 0,
      activa: true,
      fecha_tarea: TODAY,
      link_publicitario: 'https://www.instagram.com/hsuevents.cl/',
      auto_generada: true,
    }).select().single();

    if (error || !tarea) return;

    // Desactivar otras tareas del pasado
    await supabase.from('tareas').update({ activa: false }).neq('id', tarea.id);

    // Crear solo self-rows para todos (sin auditores cruzados)
    const selfRows = promsData.map(p => ({
      tarea_id: tarea.id,
      promotor_id: p.id,
      auditor_id: p.id,
      voto: 'SI',
      submission_status: 'rojo',
    }));
    await supabase.from('revisiones').insert(selfRows);
    await Promise.all([loadTareas(), loadHeatMap()]);
  };

  // ── Vigilar consolidación de tarea auto-generada (3+ switches) ────────────
  const checkAutoTaskConsolidation = async () => {
    const { data: autoTask } = await supabase
      .from('tareas').select('id, auto_generada, consolidada_at')
      .eq('fecha_tarea', TODAY).eq('auto_generada', true).single();
    if (!autoTask || autoTask.consolidada_at) return;

    // Contar switches activados (submission_status != 'rojo')
    const { data: switches } = await supabase
      .from('revisiones')
      .select('id')

    // Contar revisiones donde auditor = promotor y status != rojo
    const { data: activeSwitches } = await supabase.rpc('count_active_switches', { p_tarea_id: autoTask.id });
    const count = typeof activeSwitches === 'number' ? activeSwitches : 0;

    if (count >= 3) {
      // Consolidar: marcar con timestamp actual como inicio real
      await supabase.from('tareas').update({
        auto_generada: false,
        consolidada_at: new Date().toISOString(),
      }).eq('id', autoTask.id);
    }
  };

  // ── Mapa de calor: filtros ─────────────────────────────────────────────────
  const getFilteredHeat = () => {
    let list = [...heatData];
    const taskId = selectedHeatTask;

    if (heatColorFilter !== 'todos') {
      list = list.filter(row => {
        const selfRev = row.tareas[taskId]?.self;
        const status = (selfRev?.admin_override || selfRev?.submission_status || 'rojo') as EstadoColor;
        return status === heatColorFilter;
      });
    }

    if (heatAdminFilter === 'revisadas') {
      list = list.filter(row => !!row.tareas[taskId]?.self?.admin_override);
    } else if (heatAdminFilter === 'pendientes') {
      list = list.filter(row => !row.tareas[taskId]?.self?.admin_override);
    }

    if (heatRolFilter === 'promotor') {
      list = list.filter(row => row.promotor?.rol === 'promotor');
    } else if (heatRolFilter === 'vendedor') {
      list = list.filter(row => row.promotor?.rol === 'vendedor' || row.promotor?.rol === 'vendedor_revisor');
    }

    if (heatSort === 'nombre') {
      list.sort((a, b) => (a.promotor?.nombre || '').localeCompare(b.promotor?.nombre || ''));
    } else {
      list.sort((a, b) => {
        const getScore = (row: any) => {
          const tarea = row.tareas[taskId] || { self: null, asAuditor: [] };
          const status = (tarea.self?.admin_override || tarea.self?.submission_status || 'rojo') as EstadoColor;
          const hasPublished = status !== 'rojo';
          const pendingAuditsCount = (tarea.asAuditor || []).filter((r: any) => r.voto === 'PENDIENTE').length;
          if (!hasPublished && pendingAuditsCount > 0) return 1;
          if (!hasPublished && pendingAuditsCount === 0) return 2;
          if (hasPublished && pendingAuditsCount > 0 && status !== 'verde') return 3;
          if (hasPublished && pendingAuditsCount === 0 && status !== 'verde') return 4;
          if (status === 'verde' && pendingAuditsCount > 0) return 5;
          return 6;
        };
        return getScore(a) - getScore(b);
      });
    }

    // Admin-reviewed rows go to bottom
    list.sort((a, b) => {
      const aRev = !!a.tareas[taskId]?.self?.admin_override;
      const bRev = !!b.tareas[taskId]?.self?.admin_override;
      return aRev === bRev ? 0 : aRev ? 1 : -1;
    });

    if (user?.rol === 'revisor' || user?.rol === 'vendedor_revisor') {
      const allRevisors = promotores.filter(p => p.rol === 'revisor' || p.rol === 'vendedor_revisor').sort((a, b) => a.id.localeCompare(b.id));
      const myIndex = allRevisors.findIndex(r => r.id === user.id);
      if (myIndex !== -1 && allRevisors.length > 0) {
        const offset = Math.floor((list.length / allRevisors.length) * myIndex);
        list = [...list.slice(offset), ...list.slice(0, offset)];
      }
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

  if (loading) return <div className="p-10 text-center text-gray-500">Cargando panel...</div>;
  if (!user || (user.rol !== 'admin' && user.rol !== 'revisor' && user.rol !== 'vendedor_revisor')) return null;

  if (impersonated) {
    return <PromoterDashboard impersonatedUser={impersonated} onExitImpersonation={() => setImpersonated(null)} allowSwitchEdit={true} />;
  }

  const availableTabs = isAdmin
    ? (['users', 'tasks', 'stats', 'config', 'flow'] as const)
    : (['tasks'] as const);
  const currentTab = availableTabs.includes(activeTab as any) ? activeTab : 'tasks';

  const TAB_META: Record<string, { icon: React.ReactNode; label: string }> = {
    users:  { icon: <Users size={20} />,     label: 'Equipo' },
    tasks:  { icon: <FileText size={20} />,  label: 'Revisiones' },
    stats:  { icon: <BarChart3 size={20} />, label: 'Analíticas' },
    config: { icon: <Settings size={20} />,  label: 'Config' },
    flow:   { icon: <Eye size={20} />,       label: 'Diagrama' },
  };

  // ─────────────────────────────────────────────────────────────────────────

  // -- MINI CALENDARIO --
  const renderCalendar = () => {
    const hoy = new Date();
    const start = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const end = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    
    const days = [];
    for(let d = 1; d <= end.getDate(); d++) {
      const dateStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const hasTask = tareas.find(t => t.fecha_tarea === dateStr);
      days.push({ day: d, dateStr, hasTask });
    }

    return (
      <div className="bg-neutral-950 border border-white/5 rounded-xl p-3 mb-4">
        <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Calendario ({hoy.toLocaleString('es', { month: 'long' })})</h3>
        <div className="grid grid-cols-7 gap-1">
          {['L','M','M','J','V','S','D'].map((day, i) => <div key={i} className="text-center text-[10px] text-gray-500 font-bold">{day}</div>)}
          {Array.from({length: (start.getDay() === 0 ? 6 : start.getDay() - 1)}).map((_, i) => <div key={i}></div>)}
          {days.map(d => (
            <button key={d.day}
              onClick={() => {
                if (d.hasTask) {
                   setSelectedHeatTask(d.hasTask.id);
                   heatMapRef.current?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              disabled={!d.hasTask}
              className={`w-full aspect-square rounded flex items-center justify-center text-[10px] font-bold transition-all ${d.hasTask ? (selectedHeatTask === d.hasTask.id ? 'bg-white text-black ring-2 ring-white' : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/40 cursor-pointer') : 'text-gray-600 opacity-30 cursor-not-allowed'}`}
            >
              {d.day}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto px-3 pt-3 md:px-8 md:pt-8 space-y-4">
        
        {/* ── Header compacto ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between bg-neutral-900 border border-white/8 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-blue-500 flex-shrink-0" />
            <div>
              <h1 className="text-base font-black tracking-tight leading-none">
                {isAdmin ? 'Admin Hub' : 'Panel de Revisión'}
              </h1>
              <p className="text-gray-500 text-[10px] mt-0.5 hidden sm:block">
                {isAdmin ? 'Promotores · Misiones · Métricas' : 'Revisión y gestión de auditorías'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user.rol === 'vendedor_revisor' && (
              <button onClick={() => navigate('/promotor/dashboard')} className="flex items-center gap-1.5 text-xs font-bold text-blue-400 bg-blue-950/30 hover:bg-blue-900/40 border border-blue-500/20 px-3 py-2 rounded-xl transition-colors" title="Mi Panel">
                <span className="hidden sm:inline">Mi Panel</span>
              </button>
            )}
            <button onClick={loadAll} className="flex items-center gap-1.5 text-xs font-bold bg-neutral-800 hover:bg-neutral-700 px-3 py-2 rounded-xl transition-colors" title="Refrescar">
              <RefreshCw size={14} />
              <span className="hidden sm:inline">Refrescar</span>
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-950/30 hover:bg-red-900/40 border border-red-500/20 px-3 py-2 rounded-xl transition-colors" title="Cerrar sesión">
              <LogOut size={14} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* ── Tabs en desktop (solo si hay más de un tab) ────────────────── */}
        {availableTabs.length > 1 && (
          <div className="hidden md:flex gap-2">
            {availableTabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2
                ${currentTab === tab ? 'bg-white text-neutral-900 shadow-lg' : 'bg-neutral-900 text-gray-400 hover:text-white border border-white/5 hover:bg-neutral-800'}`}>
                {TAB_META[tab]?.icon}
                {TAB_META[tab]?.label}
              </button>
            ))}
          </div>
        )}

        {/* ══ TAB USUARIOS ══════════════════════════════════════════════════ */}
        {currentTab === 'users' && (
          <div className="bg-neutral-900 border border-white/8 rounded-2xl overflow-hidden">
            {/* Toolbar */}
            <div className="px-4 sm:px-5 py-4 border-b border-white/8 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[160px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                  placeholder="Buscar nombre, correo o @..."
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-blue-500/50 transition-all" />
              </div>
              <div className="flex gap-1 bg-neutral-950 border border-white/10 p-1 rounded-xl">
                {(['todos', 'promotor', 'vendedor', 'admin'] as const).map(r => (
                  <button key={r} onClick={() => setUserRolFilter(r)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all capitalize ${userRolFilter === r ? 'bg-white text-neutral-900' : 'text-gray-400 hover:text-white'}`}>
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={() => setShowExtraCols(!showExtraCols)} className="bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-gray-400 hover:text-white font-bold py-2 px-3 sm:px-4 rounded-xl flex items-center gap-2 text-sm transition-all" title={showExtraCols ? "Ocultar Teléfono y RUT" : "Mostrar Teléfono y RUT"}>
                  <Eye size={14} className={showExtraCols ? "text-blue-400" : ""} /> <span className="hidden sm:inline">{showExtraCols ? 'Ocultar extras' : 'Mostrar extras'}</span>
                </button>
                <button onClick={handleSyncSheets} disabled={syncingSheets} className="bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-blue-400 font-bold py-2 px-3 sm:px-4 rounded-xl flex items-center gap-2 text-sm transition-all">
  <RefreshCw size={14} className={syncingSheets ? 'animate-spin' : ''} /> <span className="hidden sm:inline">{syncingSheets ? 'Sincronizando...' : 'Sync Sheets'}</span>
</button>
<button onClick={() => setShowAddModal(true)} className="bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-white font-bold py-2 px-3 sm:px-4 rounded-xl flex items-center gap-2 text-sm transition-all">
  <Plus size={14} /> <span className="hidden sm:inline">Añadir</span>
</button>
                <button onClick={saveUsers} disabled={savingUsers || Object.keys(editedRows).length === 0}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2 px-3 sm:px-4 rounded-xl flex items-center gap-2 text-sm transition-all">
                  <Save size={14} /> {savingUsers ? 'Guardando...' : `Guardar${Object.keys(editedRows).length > 0 ? ` (${Object.keys(editedRows).length})` : ''}`}
                </button>
              </div>
            </div>

            {/* CSV Import */}
            <div className="px-4 sm:px-5 py-4 border-b border-white/8 bg-neutral-950/20">
              
            </div>

            {/* Tabla con primera columna sticky */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-white/8 bg-neutral-950/50">
                    <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-neutral-950 z-10 min-w-[130px] cursor-pointer select-none hover:text-white"
                      onClick={() => toggleSort('correo')}>
                      <span className="flex items-center gap-1">Correo<SortIcon field="correo" /></span>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold min-w-[90px] cursor-pointer select-none hover:text-white" onClick={() => toggleSort('clave')}>
                      <span className="flex items-center gap-1">Clave<SortIcon field="clave" /></span>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold min-w-[120px] cursor-pointer select-none hover:text-white" onClick={() => toggleSort('nombre')}>
                      <span className="flex items-center gap-1">Nombre<SortIcon field="nombre" /></span>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold min-w-[110px] cursor-pointer select-none hover:text-white" onClick={() => toggleSort('instagram')}>
                      <span className="flex items-center gap-1">Instagram<SortIcon field="instagram" /></span>
                    </th>
                    {showExtraCols && <th className="px-4 py-3 text-left font-semibold min-w-[100px]">Teléfono</th>}
                    {showExtraCols && <th className="px-4 py-3 text-left font-semibold min-w-[100px]">RUT</th>}
                    <th className="px-4 py-3 text-left font-semibold min-w-[100px] cursor-pointer select-none hover:text-white" onClick={() => toggleSort('rol')}>
                      <span className="flex items-center gap-1">Rol<SortIcon field="rol" /></span>
                    </th>
                    <th className="px-4 py-3 text-center font-semibold min-w-[80px]">Link Ref</th>
                    <th className="px-4 py-3 text-left font-semibold min-w-[160px]">Link TM (Vendedor)</th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {getFilteredUsers().map(p => {
                    const edited = editedRows[p.id] || {};
                    const val = (f: keyof Promotor) => ((edited[f] ?? p[f]) || '') as string;
                    const isDirty = !!editedRows[p.id];
                    const ig = val('instagram');
                    const rolColor = val('rol') === 'admin' ? 'text-blue-400' : val('rol') === 'vendedor' ? 'text-purple-400' : val('rol') === 'revisor' ? 'text-orange-400' : 'text-gray-300';
                    return (
                      <tr key={p.id} className={`group transition-colors ${isDirty ? 'bg-blue-900/10' : 'hover:bg-neutral-800/20'}`}>
                        {/* Correo — sticky */}
                        <td className="px-3 py-1.5 sticky left-0 bg-neutral-900 group-hover:bg-neutral-800/40 z-10">
                          <input type="text" value={val('correo')} onChange={e => editCell(p.id, 'correo', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-white/15 focus:border-blue-500/60 focus:bg-neutral-950 rounded-lg px-2 py-1.5 outline-none transition-all min-w-[120px] text-sm" />
                        </td>
                        {/* Clave */}
                        <td className="px-3 py-1.5">
                          <input type="text" value={val('clave')} onChange={e => editCell(p.id, 'clave', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-white/15 focus:border-blue-500/60 focus:bg-neutral-950 rounded-lg px-2 py-1.5 outline-none transition-all min-w-[80px] text-sm" />
                        </td>
                        {/* Nombre */}
                        <td className="px-3 py-1.5">
                          <input type="text" value={val('nombre')} onChange={e => editCell(p.id, 'nombre', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-white/15 focus:border-blue-500/60 focus:bg-neutral-950 rounded-lg px-2 py-1.5 outline-none transition-all min-w-[100px] text-sm" />
                        </td>
                        {/* Instagram */}
                        <td className="px-3 py-1.5">
                          <input type="text" value={val('instagram')} onChange={e => editCell(p.id, 'instagram', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-white/15 focus:border-blue-500/60 focus:bg-neutral-950 rounded-lg px-2 py-1.5 outline-none transition-all min-w-[90px] text-sm" />
                        </td>
                        {/* Teléfono */}
                        {showExtraCols && (
                          <td className="px-3 py-1.5">
                            <input type="text" value={val('telefono')} onChange={e => editCell(p.id, 'telefono', e.target.value)}
                              className="w-full bg-transparent border border-transparent hover:border-white/15 focus:border-blue-500/60 focus:bg-neutral-950 rounded-lg px-2 py-1.5 outline-none transition-all min-w-[90px] text-sm" />
                          </td>
                        )}
                        {/* RUT */}
                        {showExtraCols && (
                          <td className="px-3 py-1.5">
                            <input type="text" value={val('rut')} onChange={e => editCell(p.id, 'rut', e.target.value)}
                              className="w-full bg-transparent border border-transparent hover:border-white/15 focus:border-blue-500/60 focus:bg-neutral-950 rounded-lg px-2 py-1.5 outline-none transition-all min-w-[90px] text-sm" />
                          </td>
                        )}
                        {/* Rol */}
                        <td className="px-3 py-1.5">
                          <select value={val('rol')} onChange={e => editCell(p.id, 'rol', e.target.value)}
                            className={`bg-neutral-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-500/60 ${rolColor}`}>
                            <option value="promotor">Promotor</option>
                            <option value="vendedor">Vendedor</option>
                            <option value="revisor">Revisor</option>
                            <option value="vendedor_revisor">Vendedor+Revisor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        {/* Link Ref */}
                        <td className="px-3 py-1.5 text-center">
                          <button onClick={() => copyLink(ig, 'ref', val('ticketmaster_url'))} title="Copiar link de referido"
                            className="text-[10px] font-bold text-gray-500 hover:text-green-400 bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
                            {copied === ig + 'ref' ? '✓ Copiado' : '🔗 Ref'}
                          </button>
                        </td>
                        {/* Link TM personal (solo relevante para vendedores) */}
                        <td className="px-3 py-1.5">
                          <input type="text" value={val('ticketmaster_url')} onChange={e => editCell(p.id, 'ticketmaster_url', e.target.value)}
                            placeholder="https://tm.link/..."
                            className="w-full bg-transparent border border-transparent hover:border-white/15 focus:border-blue-500/60 focus:bg-neutral-950 rounded-lg px-2 py-1.5 outline-none transition-all min-w-[140px] text-xs text-purple-300" />
                        </td>
                        {/* Delete */}
                        <td className="px-3 py-1.5">
                          <button onClick={() => deleteRow(p.id)} className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
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
              <button onClick={handleSyncSheets} disabled={syncingSheets} className="bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-blue-400 font-bold py-2 px-3 sm:px-4 rounded-xl flex items-center gap-2 text-sm transition-all">
  <RefreshCw size={14} className={syncingSheets ? 'animate-spin' : ''} /> <span className="hidden sm:inline">{syncingSheets ? 'Sincronizando...' : 'Sync Sheets'}</span>
</button>
<button onClick={() => setShowAddModal(true)} className="bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-white font-bold py-2 px-3 sm:px-4 rounded-xl flex items-center gap-2 text-sm transition-all">
  <Plus size={14} /> <span className="hidden sm:inline">Añadir</span>
</button>
            </div>
          </div>
        )}

        {/* ══ TAB GESTOR DE TAREAS ══════════════════════════════════════════ */}
        {currentTab === 'tasks' && (
          <div className="space-y-6">

            <div className="max-w-4xl">
              {/* Gestor de Tarea */}
              {user?.rol === 'admin' && (
                <div className="bg-neutral-900 border border-white/8 rounded-2xl p-6 h-fit">
                  <h2 className="font-black text-base mb-4">Gestor de Tarea</h2>
                    {renderCalendar()}
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3 flex-wrap">
                      <input type="text" value={newTask.titulo} onChange={e => setNewTask(t => ({ ...t, titulo: e.target.value }))}
                        placeholder={`Tarea del día ${formatDate(TODAY)}`}
                        className="flex-1 min-w-[200px] bg-neutral-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500/60 outline-none transition-all" />
                      <div className="flex items-center gap-2 bg-neutral-950 border border-white/10 rounded-xl px-4 py-2.5" title="Duración total de la tarea">
                        <span className="text-xs text-gray-500 font-semibold">⏰ Duración:</span>
                        <input type="number" min={1} max={72} value={newTask.horas_duracion}
                          onChange={e => setNewTask(t => ({ ...t, horas_duracion: parseInt(e.target.value) }))}
                          className="w-12 bg-transparent text-sm outline-none text-center font-mono" />
                        <span className="text-xs text-gray-600">h</span>
                      </div>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <div className="flex items-center gap-2 bg-neutral-950 border border-yellow-500/20 rounded-xl px-4 py-2.5" title="Horas ANTES de expirar en que se cierra la revisión">
                        <span className="text-xs text-yellow-600 font-semibold">🔔 Cierre revisión:</span>
                        <input type="number" min={0} max={newTask.horas_duracion - 1} value={newTask.horas_revision}
                          onChange={e => setNewTask(t => ({ ...t, horas_revision: parseInt(e.target.value) || 0 }))}
                          className="w-12 bg-transparent text-sm outline-none text-center font-mono" />
                        <span className="text-xs text-gray-600">h antes</span>
                      </div>
                      <div className="flex items-center gap-2 bg-neutral-950 border border-white/10 rounded-xl px-4 py-2.5" title="Cantidad de compañeros que cada promotor debe auditar">
                        <span className="text-xs text-gray-500 font-semibold">Auditores:</span>
                        <input type="number" min={0} max={5} value={newTaskAuditores}
                          onChange={e => setNewTaskAuditores(parseInt(e.target.value, 10) || 0)}
                          className="w-10 bg-transparent text-sm outline-none text-center font-mono" />
                      </div>
                    </div>

                    {/* Link Publicitario */}
                    <div className="border border-white/8 rounded-xl p-3 bg-neutral-950/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-semibold flex items-center gap-1.5">
                          📢 Link Publicitario
                          {newTask.link_publicitario && newTask.link_publicitario !== 'https://www.instagram.com/hsuevents.cl/' && (
                            <span className="text-[9px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-full">Personalizado</span>
                          )}
                        </span>
                        <button type="button" onClick={() => setShowNewTaskLink(v => !v)}
                          className="text-[10px] font-bold text-gray-500 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 rounded-lg transition-colors">
                          {showNewTaskLink ? 'Ocultar' : newTask.link_publicitario !== 'https://www.instagram.com/hsuevents.cl/' ? '🔗 Ver link' : '+ Cambiar link'}
                        </button>
                      </div>
                      {showNewTaskLink && (
                        <input type="text" value={newTask.link_publicitario}
                          onChange={e => setNewTask(t => ({ ...t, link_publicitario: e.target.value }))}
                          placeholder="https://www.instagram.com/hsuevents.cl/"
                          className="w-full mt-2 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-purple-300 focus:border-purple-500/60 outline-none transition-all" />
                      )}
                    </div>

                    <button onClick={crearTarea} disabled={creatingTask}
                      className="self-end bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 font-black py-2.5 px-6 rounded-xl text-sm flex items-center gap-2 transition-all">
                      {creatingTask
                        ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Creando...</>
                        : <><Plus size={15} />Crear y Asignar</>
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mapa de Calor */}
            <div className="bg-neutral-900 border border-white/8 rounded-2xl p-6" ref={heatMapRef}>
              <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div 
                  className="cursor-pointer flex items-center gap-2 group"
                  onClick={() => setHeatMapOpen(!heatMapOpen)}
                >
                  <ChevronDown size={18} className={`text-gray-400 transition-transform ${heatMapOpen ? 'rotate-180' : ''}`} />
                  <div>
                    <h2 className="font-black text-base flex items-center gap-2">
                      Mapa de Calor 
                      <button onClick={(e) => { e.stopPropagation(); loadHeatMap(); }} className="text-gray-500 hover:text-white transition-colors" title="Refrescar mapa">
                        <RefreshCw size={14} />
                      </button>
                    </h2>
                    <p className="text-gray-500 text-xs mt-0.5">Día seleccionado (click para expandir/colapsar)</p>
                  </div>
                </div>
                {/* Filtros mapa */}
                {heatMapOpen && (
                  <div className="flex flex-wrap gap-2">
                    <div className="flex gap-1 bg-neutral-950 border border-white/10 p-1 rounded-xl">
                      <button onClick={() => {
                          setHeatColorFilter('todos');
                          setToastMsg('Mostrando todos');
                          setTimeout(() => setToastMsg(''), 3500);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${heatColorFilter === 'todos' ? 'bg-white text-neutral-900' : 'text-gray-400 hover:text-white'}`}>
                        Todos
                      </button>
                      {COLORS.map(c => (
                        <button key={c} onClick={() => {
                          setHeatColorFilter(c);
                          let msg = '';
                          if (c === 'verde') msg = 'Completados (Auditados correctamente)';
                          if (c === 'amarillo') msg = 'Pendientes de revisión';
                          if (c === 'rojo') msg = 'Sin hacer';
                          if (c === 'morado') msg = 'Pendiente de revisión pero anticipado (Vendedor)';
                          if (c === 'naranja') msg = 'Justificado / Vendedor';
                          setToastMsg(msg);
                          setTimeout(() => setToastMsg(''), 3500);
                        }}
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
                )}
              </div>

              {heatMapOpen && (
                <>

                  {/* DÍA SELECCIONADO (TOP) */}
                  <div className="mb-8">
                    {/* Header con título editable, contadores y controles */}
                    <div className="flex flex-col gap-3 mb-4 p-4 bg-neutral-950/40 border border-white/8 rounded-xl">
                      {/* Fila 1: Fecha + Título editable */}
                      <div className="flex flex-wrap items-center gap-3">
                        {(() => {
                          const selTask = tareas.find(t => t.id === selectedHeatTask);
                          if (!selTask) return <span className="text-gray-600 text-xs">Sin tarea seleccionada</span>;
                          return (
                            <>
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${selTask.fecha_tarea === TODAY ? 'bg-blue-400 animate-pulse' : 'bg-gray-500'}`} />
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{selTask.fecha_tarea === TODAY ? 'HOY' : 'Día seleccionado'} — {formatDate(selTask.fecha_tarea)}</span>

                              {/* Título y Link editables */}
                              {editingTaskTitle?.id === selTask.id ? (
                                <div className="flex flex-col gap-2 w-full sm:w-auto">
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      value={editingTaskTitle.titulo}
                                      onChange={e => setEditingTaskTitle(prev => prev ? { ...prev, titulo: e.target.value } : null)}
                                      onKeyDown={e => { if (e.key === 'Enter') saveTaskTitle(); if (e.key === 'Escape') setEditingTaskTitle(null); }}
                                      className="bg-neutral-800 border border-blue-500/60 rounded-lg px-2 py-1 text-xs outline-none text-white w-full sm:w-52"
                                      placeholder="Título de la tarea..."
                                      autoFocus
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-purple-400">🔗 Link:</span>
                                    <input
                                      value={editingTaskTitle.link_publicitario}
                                      onChange={e => setEditingTaskTitle(prev => prev ? { ...prev, link_publicitario: e.target.value } : null)}
                                      onKeyDown={e => { if (e.key === 'Enter') saveTaskTitle(); if (e.key === 'Escape') setEditingTaskTitle(null); }}
                                      className="bg-neutral-800 border border-purple-500/40 rounded-lg px-2 py-1 text-xs outline-none text-purple-300 w-full sm:w-52"
                                      placeholder="https://www.instagram.com/hsuevents.cl/"
                                    />
                                    <button onClick={saveTaskTitle} className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg flex-shrink-0">Guardar</button>
                                    <button onClick={() => setEditingTaskTitle(null)} className="text-[10px] text-gray-500 hover:text-white px-2 flex-shrink-0">✕</button>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => setEditingTaskTitle({ id: selTask.id, titulo: selTask.titulo, link_publicitario: selTask.link_publicitario || 'https://www.instagram.com/hsuevents.cl/' })}
                                  className="text-xs text-gray-400 hover:text-white border border-transparent hover:border-white/20 px-2 py-0.5 rounded-lg transition-all flex items-center gap-1">
                                  {selTask.titulo} ✏️
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>

                  {/* Fila 2: Contadores + Añadir horas */}
                  <div className="flex flex-wrap items-center gap-4">
                    {heatCountdown && (
                      <div className="flex items-center gap-2">
                        <Clock size={12} className={heatCountdown === 'Expirado' ? 'text-red-400' : 'text-gray-400'} />
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">Expira en</span>
                        <span className={`font-mono font-bold text-sm ${heatCountdown === 'Expirado' ? 'text-red-400' : 'text-white'}`}>{heatCountdown}</span>
                      </div>
                    )}
                    {heatRevCountdown && (
                      <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                        <span className="text-[10px] text-yellow-500 uppercase font-semibold">🔔 Cierre revisión</span>
                        <span className={`font-mono font-bold text-sm ${heatRevCountdown.includes('cerrado') ? 'text-red-400' : 'text-yellow-400'}`}>{heatRevCountdown}</span>
                      </div>
                    )}
                    {tareas.find(t => t.id === selectedHeatTask) && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <input
                          type="number"
                          id={`hours_${selectedHeatTask}`}
                          defaultValue={4}
                          min={1}
                          className="w-14 bg-neutral-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-center outline-none focus:border-blue-500/60 text-white"
                          title="Horas a añadir"
                        />
                        <button
                          onClick={() => {
                            const val = parseInt((document.getElementById(`hours_${selectedHeatTask}`) as HTMLInputElement).value) || 0;
                            const tId = tareas.find(t => t.id === selectedHeatTask)?.id;
                            if (tId && val > 0) addHours(tId, val);
                          }}
                          className="bg-neutral-800 hover:bg-neutral-700 text-blue-400 font-bold px-3 py-1 text-xs rounded-lg transition-colors border border-blue-500/20 whitespace-nowrap flex items-center gap-1.5">
                          <Clock size={11} /> +Horas
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Fila 3: Filtros de admin */}
                  <div className="flex flex-wrap gap-2">
                    {(['todos', 'revisadas', 'pendientes'] as const).map(f => (
                      <button key={f} onClick={() => setHeatAdminFilter(f)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all capitalize ${heatAdminFilter === f ? 'bg-white text-neutral-900' : 'text-gray-400 hover:text-white bg-neutral-900 border border-white/8'}`}>
                        {f === 'todos' ? 'Todos' : f === 'revisadas' ? '✅ Revisadas por admin' : '⏳ Pendientes de revisión'}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {([
                      { key: 'todos', label: '👥 Todos' },
                      { key: 'promotor', label: '🎯 Promotores' },
                      { key: 'vendedor', label: '🔵 Vendedores' },
                    ] as const).map(({ key, label }) => (
                      <button key={key} onClick={() => setHeatRolFilter(key)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${heatRolFilter === key ? (key === 'vendedor' ? 'bg-blue-600 text-white' : 'bg-white text-neutral-900') : 'text-gray-400 hover:text-white bg-neutral-900 border border-white/8'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Vista Cards (Mobile + Desktop) ───────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {getFilteredHeat().map(row => {
                    const tarea = row.tareas[selectedHeatTask] || { self: null, asAuditor: [], incomingAudits: [] };
                    const selfRev = tarea.self;
                    const rawStatus = (selfRev?.submission_status || 'rojo') as EstadoColor;
                    const adminOverride = selfRev?.admin_override as EstadoColor | null;

                    const incomingAudits: any[] = tarea.incomingAudits || [];
                    const allAuditsSI = incomingAudits.length > 0 && incomingAudits.every((a: any) => a.voto === 'SI');
                    const isVendedorRow = row.promotor?.rol === 'vendedor' || row.promotor?.rol === 'vendedor_revisor';
                    
                    const pendingAudits = (tarea.asAuditor || []).filter((r: any) => r.voto === 'PENDIENTE').length;
                    
                    let caughtLying = false;
                    let truthfulLoyal = false;
                    (tarea.asAuditor || []).forEach((r: any) => {
                      if (r.voto === 'NO') {
                        const targetRow = heatData.find(h => h.promotor.id === r.promotor_id);
                        const tSelf = targetRow?.tareas[selectedHeatTask]?.self;
                        const tStatus = tSelf?.admin_override || tSelf?.submission_status || 'rojo';
                        if (tStatus === 'verde') caughtLying = true;
                        else truthfulLoyal = true;
                      }
                    });

                    const anyJustificado = incomingAudits.some((a: any) => a.voto === 'JUSTIFICADO');

                    let computedStatus = rawStatus;
                    if (rawStatus === 'amarillo' && (isVendedorRow || allAuditsSI)) {
                      if (caughtLying) {
                        computedStatus = 'rojo';
                      } else if (isVendedorRow || pendingAudits === 0) {
                        computedStatus = truthfulLoyal ? 'morado' : 'verde';
                      } else {
                        computedStatus = 'amarillo';
                      }
                    } else if (rawStatus === 'amarillo' && anyJustificado) {
                      computedStatus = 'naranja';
                    }

                    const status = adminOverride || computedStatus;
                    const hasPublished = rawStatus !== 'rojo';
                    const hasAdminReview = !!adminOverride;
                    const cm = COLOR_META[status];

                    return (
                      <div key={row.promotor?.id}
                        className={`rounded-2xl border p-3.5 transition-all ${hasAdminReview ? 'bg-blue-950/20 border-blue-500/30' : 'bg-neutral-950/40 border-white/8'}`}>
                        
                        {/* Top row: switch dot + name + ig icon + panel icon */}
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${hasPublished ? 'bg-green-500' : 'bg-red-500'}`}
                              title={hasPublished ? 'Switch activado' : 'Switch apagado'} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-white text-sm truncate">{row.promotor?.nombre}</span>
                                {hasAdminReview && <span className="text-xs leading-none">👑</span>}
                                {isVendedorRow && <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide flex-shrink-0">Vendedor</span>}
                              </div>
                              <span className="text-gray-500 text-[10px] truncate block">@{row.promotor?.instagram}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <a href={`https://www.instagram.com/${row.promotor?.instagram}/`} target="_blank" rel="noopener noreferrer"
                              className="flex items-center justify-center w-7 h-7 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-pink-400 transition-colors"
                              title={`Perfil de @${row.promotor?.instagram}`}>
                              <User size={12} />
                            </a>
                            <a href={`https://www.instagram.com/stories/${row.promotor?.instagram}/`} target="_blank" rel="noopener noreferrer"
                              className="flex items-center justify-center w-7 h-7 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-purple-400 transition-colors"
                              title={`Historias de @${row.promotor?.instagram}`}>
                              <PlayCircle size={12} />
                            </a>
                            <button onClick={() => setImpersonated(row.promotor)}
                              className="flex items-center justify-center w-7 h-7 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-gray-300 transition-colors"
                              title={`Ver panel de ${row.promotor?.nombre}`}>
                              <Eye size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Status badge */}
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cm.bg}`} />
                          <span className="text-[11px] text-gray-300 font-medium">{cm.label}</span>
                        </div>

                        {/* Revisiones asignadas */}
                        {(tarea.asAuditor || []).length > 0 && (
                          <div className="mb-2.5 space-y-1">
                            <span className="text-[10px] text-gray-600 uppercase font-bold tracking-wider">Revisó a</span>
                            {(tarea.asAuditor || []).map((a: any, i: number) => {
                              const vIcon = a.voto === 'SI' ? '🟢' : a.voto === 'NO' ? '🔴' : a.voto === 'JUSTIFICADO' ? '🟠' : '⏳';
                              return (
                                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                                  <span>{vIcon}</span>
                                  <span className="text-gray-300">{a.target?.nombre || `@${a.target?.instagram}` || '—'}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Admin override buttons */}
                        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                          <span className="text-[10px] text-gray-600 font-bold uppercase tracking-wider flex-1">Rev. Admin</span>
                          <div className="flex items-center gap-1.5">
                            {(['verde', 'rojo', 'naranja'] as EstadoColor[]).map(col => (
                              <button key={col}
                                onClick={() => {
                                  overrideColor(selfRev?.id || null, adminOverride === col ? null : col, row.promotor.id, selectedHeatTask);
                                }}
                                className={`w-6 h-6 rounded-full transition-all ${COLOR_META[col].bg} ${adminOverride === col ? 'ring-2 ring-white ring-offset-1 ring-offset-neutral-950 scale-110' : 'opacity-40 hover:opacity-100'}`}
                                title={adminOverride === col ? `Quitar revisión (${COLOR_META[col].label})` : `Marcar como ${COLOR_META[col].label}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {getFilteredHeat().length === 0 && (
                    <div className="col-span-full py-10 text-center text-gray-600 text-xs">
                      {heatColorFilter !== 'todos' ? `No hay promotores con estado "${COLOR_META[heatColorFilter].label}" en esta fecha.` : 'No hay datos para esta fecha.'}
                    </div>
                  )}
                </div>
              </div>
              </>
            )}

            {/* HISTÓRICO */}
              {heatTasks.length > 0 && (
                <div className="mt-8 pt-8 border-t border-white/8">
                  <div 
                    className="cursor-pointer flex items-center gap-2 group mb-4"
                    onClick={() => setHeatHistoryOpen(!heatHistoryOpen)}
                  >
                    <ChevronDown size={18} className={`text-gray-400 transition-transform ${heatHistoryOpen ? 'rotate-180' : ''}`} />
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Historial Mapa de Calor</h3>
                    </div>
                  </div>
                  
                  {heatHistoryOpen && (
                    <div className="overflow-x-auto">
                      <table className="text-sm">
                        <thead>
                          <tr className="text-gray-500 text-xs border-b border-white/8">
                            <th className="text-left pb-2 pr-6 font-semibold sticky left-0 bg-neutral-900 z-10 min-w-[150px] align-bottom border-r border-white/5">Promotor</th>
                            {heatTasks.map(t => (
                              <th key={t.id} 
                                  className={`text-center pb-2 px-3 font-semibold transition-colors ${t.id === selectedHeatTask ? 'text-white bg-blue-500/20 border-b-2 border-blue-500' : (t.fecha === TODAY ? 'text-blue-400' : '')}`}>
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-1">
                                    <span className="cursor-pointer hover:text-white" onClick={() => {
                                      setSelectedHeatTask(t.id);
                                      setHeatMapOpen(true);
                                      heatMapRef.current?.scrollIntoView({ behavior: 'smooth' });
                                    }}>{formatDate(t.fecha)}{(t as any).auto_generada && <span className="ml-1 text-[9px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1 rounded font-bold">AUTO</span>}</span>
                                    <button onClick={() => deleteTask(t.id, t.titulo)} className="text-gray-600 hover:text-red-400 transition-colors" title="Eliminar tarea">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                  <span className="text-[10px] text-gray-500 max-w-[100px] truncate" title={t.titulo}>{t.titulo}</span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {heatData.map(row => (
                            <tr key={row.promotor?.id} className="hover:bg-neutral-800/20 transition-colors group">
                              <td className="py-3 pr-6 sticky left-0 bg-neutral-900 z-10 border-r border-white/5 group-hover:bg-neutral-800/40">
                                <a href={`https://www.instagram.com/${row.promotor?.instagram}/`} target="_blank" rel="noopener noreferrer"
                                  className="font-semibold text-white hover:text-blue-400 transition-colors">
                                  {row.promotor?.nombre}
                                </a>
                              </td>
                              {heatTasks.map(t => {
                                const tarea = row.tareas[t.id] || { self: null };
                                const selfRev = tarea.self;
                                const status = (selfRev?.admin_override || selfRev?.submission_status || 'rojo') as EstadoColor;
                                return (
                                  <td key={t.id} className="py-3 px-3 text-center">
                                    <HeatCell revId={selfRev?.id || null} currentStatus={status} onOverride={overrideColor} />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ══ TAB ANALÍTICAS ════════════════════════════════════════════════ */}
        {currentTab === 'stats' && (() => {
          // Tipos de acción disponibles
          type TipoFiltro = 'visita' | 'click_tm' | 'click_gratis';

          // Obtener fechas únicas de métricas
          const metricDates = [...new Set(metrics.map((m: any) =>
            new Date(m.created_at).toISOString().split('T')[0]
          ))].sort((a, b) => b.localeCompare(a)) as string[];

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
                  <table className="text-sm w-full">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-white/8 bg-neutral-950/50">
                        <th className="px-5 py-3 text-left font-semibold sticky left-0 z-10 bg-neutral-950 min-w-[150px] border-r border-white/5">Promotor</th>
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
                        <tr key={idx} className="hover:bg-neutral-800/20 transition-colors group">
                          <td className="px-5 py-3 font-semibold sticky left-0 z-10 bg-neutral-900 border-r border-white/5 group-hover:bg-neutral-800/40">
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
                          <td className="px-5 py-3 sticky left-0 z-10 bg-neutral-950 border-r border-white/5">TOTAL</td>
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

              {/* ── Gráfico Diario de Participación ─────────────────────── */}
              <div className="bg-neutral-900 border border-white/8 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/8">
                  <h2 className="font-black text-base flex items-center gap-2">📊 Participación Diaria</h2>
                  <p className="text-gray-500 text-xs mt-0.5">Switches activados por día — Verde / Amarillo / Rojo</p>
                </div>
                <div className="p-4 overflow-x-auto">
                  {(() => {
                    const sorted = [...heatTasks].sort((a, b) => a.fecha.localeCompare(b.fecha));
                    if (sorted.length === 0) return <p className="text-gray-600 text-xs text-center py-6">No hay tareas todavía.</p>;
                    const total = heatData.length;
                    return (
                      <div className="flex items-end gap-2 min-w-max pb-2">
                        {sorted.map(t => {
                          let verde = 0, amarillo = 0, rojo = 0;
                          heatData.forEach(row => {
                            const selfRev = row.tareas[t.id]?.self;
                            if (!selfRev) return;
                            const inAudits: any[] = row.tareas[t.id]?.incomingAudits || [];
                            const isVend = row.promotor?.rol === 'vendedor' || row.promotor?.rol === 'vendedor_revisor';
                            const allSI = inAudits.length > 0 && inAudits.every((a: any) => a.voto === 'SI');
                            const isSimple = inAudits.length === 0 && (row.tareas[t.id]?.asAuditor || []).length === 0;
                            const raw = selfRev.submission_status || 'rojo';
                            const override = selfRev.admin_override;
                            let computed = raw;
                            if (raw === 'amarillo' && (isVend || allSI || isSimple)) computed = 'verde';
                            const s = override || computed;
                            if (['verde','morado'].includes(s)) verde++;
                            else if (s === 'amarillo' || s === 'naranja') amarillo++;
                            else rojo++;
                          });
                          const height = 80;
                          const vH = total > 0 ? Math.round((verde / total) * height) : 0;
                          const aH = total > 0 ? Math.round((amarillo / total) * height) : 0;
                          const rH = height - vH - aH;
                          const pct = total > 0 ? Math.round((verde / total) * 100) : 0;
                          const dateObj = new Date(t.fecha + 'T12:00:00');
                          const label = dateObj.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
                          const isToday = t.fecha === TODAY;
                          return (
                            <div key={t.id} className="flex flex-col items-center gap-1 cursor-pointer group"
                              onClick={() => { setSelectedHeatTask(t.id); setHeatMapOpen(true); heatMapRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>
                              <span className="text-[10px] font-bold text-gray-400 group-hover:text-white transition-colors">{pct}%</span>
                              <div className="flex flex-col-reverse rounded-lg overflow-hidden w-10 border border-white/8 group-hover:border-white/20 transition-all" style={{ height: `${height}px` }}>
                                {verde > 0 && <div className="bg-green-500 transition-all" style={{ height: `${vH}px` }} title={`Verde: ${verde}`} />}
                                {amarillo > 0 && <div className="bg-yellow-400 transition-all" style={{ height: `${aH}px` }} title={`Amarillo: ${amarillo}`} />}
                                {rojo > 0 && <div className="bg-red-500/60 transition-all" style={{ height: `${rH}px` }} title={`Rojo: ${rojo}`} />}
                              </div>
                              <span className={`text-[10px] font-semibold ${isToday ? 'text-blue-400' : 'text-gray-600'}`}>{label}</span>
                              {isToday && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Tabla Desempeño de Tareas */}
              <div className="bg-neutral-900 border border-white/8 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/8">
                  <h2 className="font-black text-base flex items-center gap-2">Desempeño de Tareas</h2>
                  <p className="text-gray-500 text-xs mt-0.5">Mide la participación y nivel de cumplimiento según el mapa de calor</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-white/8 bg-neutral-950/50">
                        <th className="px-6 py-3 text-left font-semibold">Promotor</th>
                        <th className="px-6 py-3 text-center font-semibold" title="Total de tareas en las que fue asignado">Tareas Asignadas</th>
                        <th className="px-6 py-3 text-center font-semibold text-green-400">Completadas</th>
                        <th className="px-6 py-3 text-center font-semibold text-yellow-500">Pendientes (Revisión)</th>
                        <th className="px-6 py-3 text-center font-semibold text-red-400">Faltantes (Rojo)</th>
                        <th className="px-6 py-3 text-right font-semibold">Cumplimiento %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(() => {
                        const performance = heatData.map(row => {
                          const stats = { total: 0, completadas: 0, pendientes: 0, faltantes: 0 };
                          heatTasks.forEach(t => {
                            const tarea = row.tareas[t.id];
                            if (!tarea || !tarea.self) return; // Not assigned
                            stats.total++;
                            const status = (tarea.self.admin_override || tarea.self.submission_status || 'rojo') as string;
                            if (['verde', 'morado', 'naranja'].includes(status)) stats.completadas++;
                            else if (status === 'amarillo') stats.pendientes++;
                            else stats.faltantes++;
                          });
                          const pct = stats.total > 0 ? (stats.completadas / stats.total) * 100 : 0;
                          return { promotor: row.promotor, stats, pct };
                        });
                        
                        performance.sort((a, b) => b.pct - a.pct || b.stats.completadas - a.stats.completadas);

                        if (performance.length === 0) {
                          return <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-600 text-xs">No hay datos de tareas aún.</td></tr>;
                        }

                        return performance.map((p, idx) => (
                          <tr key={p.promotor.id} className="hover:bg-neutral-800/20 transition-colors">
                            <td className="px-6 py-3 font-semibold flex items-center gap-2">
                              <a href={`https://www.instagram.com/${p.promotor?.instagram}/`} target="_blank" rel="noopener noreferrer"
                                className="hover:text-blue-400 transition-colors">{p.promotor?.nombre}</a>
                              {idx === 0 && p.pct === 100 && p.stats.total > 0 && <span className="text-yellow-400 text-[10px]" title="Cumplimiento perfecto">⭐</span>}
                            </td>
                            <td className="px-6 py-3 text-center font-mono">{p.stats.total}</td>
                            <td className="px-6 py-3 text-center font-mono text-green-400 font-medium">{p.stats.completadas}</td>
                            <td className="px-6 py-3 text-center font-mono text-yellow-500">{p.stats.pendientes}</td>
                            <td className="px-6 py-3 text-center font-mono text-red-400">{p.stats.faltantes}</td>
                            <td className={`px-6 py-3 text-right font-mono font-bold ${p.pct >= 80 ? 'text-green-400' : p.pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {p.pct.toFixed(0)}%
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabla resumen totalizado (Tráfico) */}
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

        {/* ══ TAB CONFIGURACIÓN ════════════════════════════════════════════ */}
        {currentTab === 'config' && (
          <div className="space-y-6">
            <div className="bg-neutral-900 border border-white/8 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/8 flex justify-between items-center bg-neutral-950/30">
                <div>
                  <h2 className="font-black text-base flex items-center gap-2">Configuración Global</h2>
                  <p className="text-gray-500 text-xs mt-0.5">Links, banner y opciones del sistema</p>
                </div>
                <button onClick={saveConfig} disabled={savingConfig}
                  className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 font-bold py-2 px-5 rounded-xl text-sm flex items-center gap-2 transition-colors">
                  <Save size={14} /> {savingConfig ? 'Guardando...' : 'Guardar Config'}
                </button>
              </div>
              
              <div className="p-6">
                {/* Preview del banner */}
                {config.banner_url && (
                  <div className="mb-6 w-full max-w-sm rounded-xl overflow-hidden border border-white/10 aspect-video bg-neutral-800">
                    <img src={bannerPreview} alt="Preview banner"
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                  {/* Bloque URLs */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-300 border-b border-white/10 pb-2">URLs de Botones y Material</h3>
                    {([
                      ['banner_url', '🖼️ Banner', 'URL Banner (Drive o directa)', 'https://drive.google.com/file/d/.../view'],
                      ['ticketmaster_url', '🎫 Ticketmaster', 'URL Botón "Comprar en Ticketmaster"', 'https://www.ticketmaster.cl/...'],
                      ['material_nuevo_url', '📁 Material RRSS', 'URL Material RRSS (Drive — carpeta)', 'https://drive.google.com/drive/folders/...'],
                    ] as const).map(([field, btnLabel, label, placeholder]) => (
                      <div key={field} className="bg-neutral-950/50 p-4 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
                          <button onClick={() => toggleLink(field)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors ${config[field] ? 'bg-green-500/10 text-green-400' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                            {config[field] ? `${btnLabel} ✓` : `Añadir ${btnLabel}`}
                          </button>
                        </div>
                        {visibleLinks[field] && (
                          <input type="text" value={config[field] || ''} placeholder={placeholder}
                            onChange={e => setConfig(c => ({ ...c, [field]: e.target.value }))}
                            className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-blue-500/60 outline-none transition-all mt-2" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Bloque WhatsApp / Config general */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-300 border-b border-white/10 pb-2">WhatsApp / Evento</h3>
                    
                    <div className="bg-neutral-950/50 p-4 rounded-xl border border-white/5 space-y-4">
                      <h4 className="text-sm font-semibold text-gray-300">Botón "Entradas sin cargo" (WhatsApp)</h4>
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Número de Teléfono</label>
                        <input type="text" value={config.whatsapp_numero || ''} placeholder="+56912345678"
                          onChange={e => setConfig(c => ({ ...c, whatsapp_numero: e.target.value }))}
                          className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-blue-500/60 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Mensaje Predeterminado</label>
                        <textarea value={config.whatsapp_mensaje || ''} placeholder="Hola, quiero entradas gratis..." rows={3}
                          onChange={e => setConfig(c => ({ ...c, whatsapp_mensaje: e.target.value }))}
                          className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-blue-500/60 outline-none transition-all resize-none" />
                      </div>
                      <p className="text-[10px] text-gray-500 bg-neutral-900 p-2 rounded-lg border border-white/5">
                        El link final será: <br/><span className="font-mono text-gray-400 break-all">https://wa.me/{config.whatsapp_numero || '+569...'}?text={encodeURIComponent(config.whatsapp_mensaje || 'Hola...')} ref: @instagram_promotor</span>
                      </p>
                    </div>

                    <div className="bg-neutral-950/50 p-4 rounded-xl border border-white/5">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Fecha del Evento (Cuenta regresiva)</label>
                      <input type="date" value={config.fecha_evento || '2027-01-15'}
                        onChange={e => setConfig(c => ({ ...c, fecha_evento: e.target.value }))}
                        className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-blue-500/60 outline-none transition-all text-white" />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ══ TAB FLUJO ════════════════════════════════════════════════════ */}
        {currentTab === 'flow' && (
          <div className="bg-neutral-900 border border-white/8 rounded-2xl overflow-hidden h-[calc(100vh-200px)]">
            <FlowchartViewer />
          </div>
        )}

      </div>

      {/* ── Bottom Nav Bar (Mobile Only) ────────────────────────────────── */}
      {availableTabs.length > 1 && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-neutral-950/95 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-2 py-1 safe-area-bottom">
          {availableTabs.map(tab => {
            const isActive = currentTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all min-w-[56px] ${isActive ? 'text-white' : 'text-gray-500'}`}
              >
                <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-white text-neutral-900' : 'hover:bg-white/5'}`}>
                  {TAB_META[tab]?.icon}
                </div>
                <span className={`text-[10px] font-bold leading-none ${isActive ? 'text-white' : 'text-gray-600'}`}>
                  {TAB_META[tab]?.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-2xl h-[90vh] flex flex-col overflow-hidden relative">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-neutral-950/50">
              <div>
                <h3 className="text-lg font-bold text-white">Añadir Integrante</h3>
                <p className="text-xs text-gray-400">Rellena el formulario oficial de HSU Promo</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors">
                X
              </button>
            </div>
            
            <div className="flex-1 bg-white relative">
              <iframe 
                src="https://docs.google.com/forms/d/1rGTsE-_D--nrhseUR_SjVp4xvtWntt93cfclspS94Wo/viewform?embedded=true" 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                marginHeight={0} 
                marginWidth={0}
                className="absolute inset-0"
              >
                Cargando...
              </iframe>
            </div>

            <div className="px-6 py-4 border-t border-white/10 bg-neutral-950/50 flex gap-3 justify-end items-center">
              <span className="text-xs text-gray-400 mr-auto">¿Ya enviaste el formulario? Dale a sincronizar para verlo en la lista.</span>
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors">
                Cerrar
              </button>
              <button onClick={() => { setShowAddModal(false); handleSyncSheets(); }} disabled={syncingSheets} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 text-sm transition-all">
                {syncingSheets ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {syncingSheets ? 'Sincronizando...' : 'Sincronizar ahora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 pointer-events-none ${toastMsg ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="bg-neutral-800 border border-neutral-600 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-sm font-bold">
          {toastMsg}
        </div>
      </div>
    </div>
  );
}