'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Property, PROPERTIES, formatPrice, getRiskLabel } from '../lib/properties';

interface MapViewProps {
  selectedProperty: Property | null;
  onSelectProperty: (property: Property) => void;
}

function createMarkerElement(property: Property): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'map-marker' + (property.status === 'flagged' ? ' status-flagged' : property.status === 'pending' ? ' status-pending' : '');
  el.innerHTML = `<div class="ring"></div><div class="core"></div>`;
  return el;
}

function createPopupHTML(property: Property): string {
  const risk = getRiskLabel(property.riskScore);
  return `
    <div style="width:280px;font-family:DM Sans,sans-serif;">
      <div style="position:relative;height:100px;overflow:hidden;">
        <img src="${property.image}" style="width:100%;height:100%;object-fit:cover;" />
        <div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,0.45) 0%,transparent 50%)"></div>
        <div style="position:absolute;bottom:6px;left:10px;font-family:JetBrains Mono,monospace;font-size:15px;font-weight:600;color:white;text-shadow:0 1px 4px rgba(0,0,0,0.4)">
          ${formatPrice(property.price)}
        </div>
      </div>
      <div style="padding:10px 12px 14px;">
        <div style="font-size:14px;font-weight:600;color:#0F172A;margin-bottom:2px">${property.address}</div>
        <div style="font-size:11px;color:#64748B;margin-bottom:10px">
          ${property.city} &middot; ${property.beds}bd/${property.baths}ba &middot; ${property.sqft.toLocaleString()} sf
        </div>
        <div style="display:flex;gap:12px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.06)">
          <div>
            <div style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:600;color:#059669">+${property.roi}%</div>
            <div style="font-size:9px;color:#94A3B8;margin-top:1px">ROI</div>
          </div>
          <div>
            <div style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:600;color:${risk.color}">${property.riskScore}</div>
            <div style="font-size:9px;color:#94A3B8;margin-top:1px">Risk</div>
          </div>
          <div>
            <div style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:600;color:#0891B2">${property.daysOnMarket}d</div>
            <div style="font-size:9px;color:#94A3B8;margin-top:1px">Listed</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export default function MapView({ selectedProperty, onSelectProperty }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const popupRef = useRef<any>(null);
  const mapboxRef = useRef<any>(null);
  const onSelectRef = useRef(onSelectProperty);
  const [mapReady, setMapReady] = useState(false);

  onSelectRef.current = onSelectProperty;

  // Dynamically load mapbox-gl only on the client
  useEffect(() => {
    let cancelled = false;

    async function loadMap() {
      if (!mapContainer.current || mapRef.current) return;

      try {
      const mapboxgl = (await import('mapbox-gl')).default;

      if (cancelled) return;

      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
      mapboxRef.current = mapboxgl;

      const map = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [-117.8200, 33.6800],
        zoom: 10.3,
        pitch: 40,
        bearing: -15,
        attributionControl: false,
      });

      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        if (cancelled) return;

        const layers = map.getStyle().layers;
        if (layers) {
          const labelLayerId = layers.find(
            (layer: any) => layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout
          )?.id;
          if (labelLayerId) {
            map.addLayer({
              id: '3d-buildings', source: 'composite', 'source-layer': 'building',
              filter: ['==', 'extrude', 'true'], type: 'fill-extrusion', minzoom: 14,
              paint: {
                'fill-extrusion-color': '#e2e8f0',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.4,
              },
            }, labelLayerId);
          }
        }

        PROPERTIES.forEach((property) => {
          const el = createMarkerElement(property);
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelectRef.current(property);
            if (popupRef.current) popupRef.current.remove();
            popupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, maxWidth: 'none', offset: 16 })
              .setLngLat(property.coordinates).setHTML(createPopupHTML(property)).addTo(map);
          });
          markersRef.current.push(
            new mapboxgl.Marker({ element: el }).setLngLat(property.coordinates).addTo(map)
          );
        });

        setMapReady(true);
      });

      map.on('error', (e: any) => {
        console.error('Mapbox map error:', e);
      });

      } catch (err) {
        console.error('Failed to load mapbox-gl:', err);
      }
    }

    loadMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to selected property
  useEffect(() => {
    if (selectedProperty && mapRef.current && mapReady && mapboxRef.current) {
      const mapboxgl = mapboxRef.current;
      mapRef.current.flyTo({ center: selectedProperty.coordinates, zoom: 15, pitch: 55, duration: 1500, essential: true });
      if (popupRef.current) popupRef.current.remove();
      popupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, maxWidth: 'none', offset: 16 })
        .setLngLat(selectedProperty.coordinates).setHTML(createPopupHTML(selectedProperty)).addTo(mapRef.current);
    }
  }, [selectedProperty, mapReady]);

  return (
    <div className="flex-1 relative">
      <div ref={mapContainer} className="w-full h-full" />

      <div className="absolute top-3 left-3 z-10 pointer-events-none">
        <div className="glass px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-text-primary">Orange County, CA</span>
            <div className="w-[5px] h-[5px] status-live" style={{ background: 'var(--green)' }} />
          </div>
          <div className="font-mono text-[9px] text-text-tertiary">{PROPERTIES.length} properties</div>
        </div>
      </div>
    </div>
  );
}
