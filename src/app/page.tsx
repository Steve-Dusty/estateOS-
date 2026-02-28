'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import NavBar from './components/NavBar';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import PropertyModal from './components/PropertyModal';
import ChatPanel from './components/ChatPanel';

const MapView = dynamic(() => import('./components/MapView'), { ssr: false });
import { Property } from './lib/properties';

export default function Dashboard() {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [modalProperty, setModalProperty] = useState<Property | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const handleSelectProperty = useCallback((property: Property) => {
    setSelectedProperty(property);
  }, []);

  const handleMapSelectProperty = useCallback((property: Property) => {
    setSelectedProperty(property);
    setModalProperty(property);
  }, []);

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-body)' }}>
      <NavBar onAIToggle={() => setChatOpen(!chatOpen)} aiOpen={chatOpen} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          selectedId={selectedProperty?.id ?? null}
          onSelect={handleSelectProperty}
        />
        <MapView
          selectedProperty={selectedProperty}
          onSelectProperty={handleMapSelectProperty}
        />
      </div>
      <StatusBar />
      {modalProperty && (
        <PropertyModal
          property={modalProperty}
          onClose={() => setModalProperty(null)}
        />
      )}
      {chatOpen && (
        <ChatPanel onClose={() => setChatOpen(false)} />
      )}
    </div>
  );
}
