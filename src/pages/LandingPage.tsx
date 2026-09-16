import React from 'react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <div className="h-64 bg-neutral-800 flex items-center justify-center relative">
          <p className="text-neutral-500 font-bold uppercase tracking-widest text-sm">Banner Oficial</p>
          <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-mono text-gray-300">
            ?ref=promotor1
          </div>
        </div>
        
        <div className="p-8 space-y-4">
          <h2 className="text-2xl font-black text-center mb-6">Próximo Evento</h2>
          
          <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
            Comprar en Ticketmaster
          </button>
          
          <button className="w-full bg-white hover:bg-gray-100 text-black font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
            Entradas sin cargo
          </button>
        </div>
      </div>
    </div>
  );
}
