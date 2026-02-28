'use client';

import { useEffect, useRef } from 'react';

export default function MapboxTest() {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: any;

    async function init() {
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        console.log('mapboxgl loaded:', mapboxgl);

        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
        console.log('Token:', token ? `${token.slice(0, 10)}...` : 'MISSING');

        mapboxgl.accessToken = token;

        map = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [-117.82, 33.68],
          zoom: 10,
        });

        map.on('load', () => console.log('Map loaded successfully!'));
        map.on('error', (e: any) => console.error('Map error:', e));
      } catch (err) {
        console.error('Import/init failed:', err);
      }
    }

    init();
    return () => map?.remove();
  }, []);

  return (
    <>
      <link href="https://api.mapbox.com/mapbox-gl-js/v3.9.3/mapbox-gl.css" rel="stylesheet" />
      <div style={{ width: '100vw', height: '100vh' }} ref={mapContainer} />
    </>
  );
}
