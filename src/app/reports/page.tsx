'use client';

import { useState, useCallback } from 'react';
import NavBar from '../components/NavBar';
import Sidebar from '../components/Sidebar';
import StatusBar from '../components/StatusBar';
import ReportChat from '../components/ReportChat';
import { Property } from '../lib/properties';

export default function ReportsPage() {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const handleSelectProperty = useCallback((property: Property) => {
    setSelectedProperty(prev => prev?.id === property.id ? null : property);
  }, []);

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-body)' }}>
      <NavBar />

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar — images of logged houses */}
        <Sidebar
          selectedId={selectedProperty?.id ?? null}
          onSelect={handleSelectProperty}
        />

        {/* Center — multimodal chat */}
        <div className="flex-1 flex flex-col overflow-hidden"
          style={{ background: 'var(--bg-body)' }}>
          <ReportChat backgroundImage={selectedProperty?.image ?? null} />
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
