import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { X, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface FlowchartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FLOWCHART_CODE = `
flowchart TD
  A([Inicio: Nueva Misión]) --> B[1. Entras a tu Panel]
  B --> C[2. Descargas Material]
  
  C --> D[3. Subes Historia a IG\ncon tu link de referido]
  
  D --> E[4. Activas Switch en el Panel]
  
  E -->|Estado: Amarillo 🟡| F{Cumplir 3 Requisitos}
  
  F --> R1[Requisito 1: Switch Activado]
  F --> R2[Requisito 2: Ser aprobado\npor tus auditores]
  F --> R3[Requisito 3: Tú debes auditar\na tu compañero asignado]

  R1 --> CHECK
  R2 --> CHECK
  R3 --> CHECK

  CHECK{¿Cumples los 3?}
  CHECK -->|Sí| VERDE([¡Misión Completada!\nVerde 🟢])
  CHECK -->|Falta alguno| AMAR([Quedas Pendiente\nAmarillo 🟡])

  R3 -.-> CATCH{¿Atrapaste a alguien\nque NO publicó?}
  CATCH -->|Pones voto NO| MORADO([Ganas Estatus Auditor Leal\nMorado 🟣])
  CATCH -->|No aplica| VERDE
  
  R2 -.-> EXCUSE{¿Tuviste un problema\ny el auditor lo validó?}
  EXCUSE -->|Auditor vota JUSTIFICADO| NARANJA([Misión Justificada\nNaranja 🟠])
  
  classDef default fill:#1f2937,stroke:#374151,stroke-width:2px,color:#fff;
  classDef success fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#fff;
  classDef fail fill:#7f1d1d,stroke:#ef4444,stroke-width:2px,color:#fff;
  classDef special fill:#4c1d95,stroke:#8b5cf6,stroke-width:2px,color:#fff;
  classDef pending fill:#78350f,stroke:#f59e0b,stroke-width:2px,color:#fff;
  classDef warning fill:#9a3412,stroke:#f97316,stroke-width:2px,color:#fff;
  
  class VERDE success;
  class MORADO special;
  class NARANJA warning;
  class E,AMAR pending;
`;

export default function FlowchartModal({ isOpen, onClose }: FlowchartModalProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [svgRendered, setSvgRendered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#1f2937',
          primaryTextColor: '#fff',
          primaryBorderColor: '#374151',
          lineColor: '#60a5fa',
        },
        flowchart: { curve: 'basis' },
        securityLevel: 'loose'
      });

      const renderChart = async () => {
        try {
          if (chartRef.current) {
            const { svg } = await mermaid.render('mermaid-svg-flujo', FLOWCHART_CODE);
            chartRef.current.innerHTML = svg;
            setSvgRendered(true);
          }
        } catch (e) {
          console.error("Error renderizando mermaid:", e);
        }
      };

      renderChart();
    } else {
      setSvgRendered(false);
      if (chartRef.current) chartRef.current.innerHTML = '';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overscroll-none touch-none">
      
      {/* HEADER CONTROLS */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-[110] bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
        <div className="text-white">
          <h2 className="font-black text-lg text-blue-400">Cómo funciona HSU</h2>
          <p className="text-xs text-gray-400">Pellizca para acercar</p>
        </div>
        <button onClick={onClose} className="bg-neutral-800 hover:bg-neutral-700 p-2 rounded-full text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* ZOOM WRAPPER */}
      <div className="w-full h-full flex items-center justify-center relative select-none" style={{ overflow: 'hidden' }}>
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={5}
          centerOnInit={true}
          wheel={{ step: 0.1 }}
          pinch={{ step: 5 }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* Controles de Zoom en pantalla (flotantes abajo) */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-neutral-900/80 p-2 rounded-2xl border border-white/10 z-[110] backdrop-blur-md pointer-events-auto">
                <button onClick={() => zoomOut()} className="p-3 text-white hover:bg-white/10 rounded-xl transition-colors"><ZoomOut size={18} /></button>
                <button onClick={() => resetTransform()} className="p-3 text-white hover:bg-white/10 rounded-xl transition-colors"><Maximize size={18} /></button>
                <button onClick={() => zoomIn()} className="p-3 text-white hover:bg-white/10 rounded-xl transition-colors"><ZoomIn size={18} /></button>
              </div>

              <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {/* SVG CONTAINER (Desactiva el toque de menú de descarga nativo) */}
                <div 
                  ref={chartRef} 
                  className="w-full h-full flex items-center justify-center pointer-events-none"
                  style={{ 
                    WebkitTouchCallout: 'none', 
                    WebkitUserSelect: 'none', 
                    userSelect: 'none' 
                  }}
                />
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
      
    </div>
  );
}
