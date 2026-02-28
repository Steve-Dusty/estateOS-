'use client';

import { useEffect, useRef, useState } from 'react';
import { Property, PROPERTIES, formatPrice, getRiskLabel } from '../lib/properties';

interface MapViewProps {
  selectedProperty: Property | null;
  onSelectProperty: (property: Property) => void;
}

// ── GeoJSON builders ──

function buildPropertiesGeoJSON() {
  return {
    type: 'FeatureCollection' as const,
    features: PROPERTIES.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: p.coordinates },
      properties: {
        id: p.id,
        price: p.price,
        roi: p.roi,
        riskScore: p.riskScore,
        status: p.status,
        weight: Math.min(1, p.price / 5000000),
      },
    })),
  };
}

function buildConnectionLines() {
  const hub: [number, number] = [-117.82, 33.68];
  return {
    type: 'FeatureCollection' as const,
    features: PROPERTIES.map((p) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [hub, p.coordinates],
      },
      properties: { status: p.status, price: p.price },
    })),
  };
}

function buildScanRings() {
  const hub: [number, number] = [-117.82, 33.68];
  const rings = [0.06, 0.12, 0.2, 0.3];
  return {
    type: 'FeatureCollection' as const,
    features: rings.map((radius, i) => {
      const points = 80;
      const coords: [number, number][] = [];
      for (let j = 0; j <= points; j++) {
        const angle = (j / points) * Math.PI * 2;
        coords.push([
          hub[0] + radius * Math.cos(angle) * 1.2,
          hub[1] + radius * Math.sin(angle),
        ]);
      }
      return {
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: coords },
        properties: { ring: i },
      };
    }),
  };
}

// ── Neighborhood zone polygons with area intelligence ──

interface ZoneData {
  name: string;
  marketHeat: number;       // 0–100, how hot/competitive the market is
  avgPrice: number;         // average home price in the zone
  schoolRating: number;     // 1–10
  investmentGrade: string;  // A+ to C
  appreciation: number;     // YoY % appreciation
  inventory: number;        // active listings
  daysOnMarket: number;     // avg DOM
  coordinates: [number, number][][];
}

const ZONES: ZoneData[] = [
  {
    name: 'Irvine',
    marketHeat: 92, avgPrice: 1350000, schoolRating: 9, investmentGrade: 'A+',
    appreciation: 8.4, inventory: 47, daysOnMarket: 12,
    coordinates: [[
      [-117.86, 33.72], [-117.83, 33.73], [-117.79, 33.725],
      [-117.755, 33.72], [-117.74, 33.70], [-117.74, 33.68],
      [-117.745, 33.655], [-117.75, 33.635], [-117.77, 33.625],
      [-117.80, 33.62], [-117.83, 33.625], [-117.85, 33.635],
      [-117.86, 33.66], [-117.865, 33.69], [-117.86, 33.72],
    ]],
  },
  {
    name: 'Newport Beach',
    marketHeat: 85, avgPrice: 3480000, schoolRating: 8, investmentGrade: 'A',
    appreciation: 6.1, inventory: 23, daysOnMarket: 38,
    coordinates: [[
      [-117.94, 33.635], [-117.92, 33.64], [-117.89, 33.635],
      [-117.87, 33.625], [-117.86, 33.615], [-117.865, 33.595],
      [-117.88, 33.59], [-117.90, 33.592], [-117.92, 33.60],
      [-117.935, 33.61], [-117.94, 33.625], [-117.94, 33.635],
    ]],
  },
  {
    name: 'Lake Forest',
    marketHeat: 78, avgPrice: 1340000, schoolRating: 8, investmentGrade: 'A',
    appreciation: 9.2, inventory: 31, daysOnMarket: 15,
    coordinates: [[
      [-117.72, 33.67], [-117.70, 33.67], [-117.67, 33.665],
      [-117.655, 33.655], [-117.65, 33.64], [-117.655, 33.625],
      [-117.67, 33.62], [-117.69, 33.62], [-117.71, 33.63],
      [-117.725, 33.645], [-117.73, 33.66], [-117.72, 33.67],
    ]],
  },
  {
    name: 'Tustin',
    marketHeat: 65, avgPrice: 850000, schoolRating: 7, investmentGrade: 'B+',
    appreciation: 6.8, inventory: 18, daysOnMarket: 22,
    coordinates: [[
      [-117.845, 33.735], [-117.83, 33.74], [-117.81, 33.735],
      [-117.79, 33.73], [-117.785, 33.715], [-117.79, 33.70],
      [-117.80, 33.695], [-117.82, 33.695], [-117.835, 33.70],
      [-117.845, 33.715], [-117.845, 33.735],
    ]],
  },
  {
    name: 'Costa Mesa',
    marketHeat: 72, avgPrice: 980000, schoolRating: 6, investmentGrade: 'B+',
    appreciation: 7.5, inventory: 22, daysOnMarket: 16,
    coordinates: [[
      [-117.945, 33.67], [-117.935, 33.67], [-117.91, 33.665],
      [-117.90, 33.655], [-117.895, 33.64], [-117.90, 33.635],
      [-117.92, 33.635], [-117.935, 33.64], [-117.945, 33.65],
      [-117.95, 33.66], [-117.945, 33.67],
    ]],
  },
  {
    name: 'Mission Viejo',
    marketHeat: 68, avgPrice: 1040000, schoolRating: 8, investmentGrade: 'B+',
    appreciation: 7.1, inventory: 26, daysOnMarket: 20,
    coordinates: [[
      [-117.68, 33.625], [-117.665, 33.625], [-117.645, 33.62],
      [-117.63, 33.61], [-117.63, 33.59], [-117.64, 33.58],
      [-117.66, 33.58], [-117.675, 33.59], [-117.685, 33.60],
      [-117.69, 33.615], [-117.68, 33.625],
    ]],
  },
  {
    name: 'Laguna Niguel',
    marketHeat: 74, avgPrice: 1850000, schoolRating: 8, investmentGrade: 'A-',
    appreciation: 8.0, inventory: 14, daysOnMarket: 18,
    coordinates: [[
      [-117.73, 33.555], [-117.715, 33.555], [-117.70, 33.545],
      [-117.69, 33.53], [-117.695, 33.515], [-117.71, 33.51],
      [-117.725, 33.515], [-117.735, 33.525], [-117.74, 33.54],
      [-117.73, 33.555],
    ]],
  },
  {
    name: 'Laguna Beach',
    marketHeat: 88, avgPrice: 5100000, schoolRating: 7, investmentGrade: 'B',
    appreciation: 4.8, inventory: 9, daysOnMarket: 52,
    coordinates: [[
      [-117.80, 33.56], [-117.79, 33.56], [-117.775, 33.55],
      [-117.77, 33.535], [-117.775, 33.52], [-117.785, 33.52],
      [-117.80, 33.525], [-117.81, 33.535], [-117.81, 33.55],
      [-117.80, 33.56],
    ]],
  },
  {
    name: 'Huntington Beach',
    marketHeat: 76, avgPrice: 1950000, schoolRating: 7, investmentGrade: 'A-',
    appreciation: 7.8, inventory: 35, daysOnMarket: 14,
    coordinates: [[
      [-118.02, 33.685], [-118.0, 33.685], [-117.98, 33.68],
      [-117.97, 33.67], [-117.965, 33.655], [-117.97, 33.64],
      [-117.985, 33.635], [-118.0, 33.64], [-118.015, 33.65],
      [-118.025, 33.665], [-118.02, 33.685],
    ]],
  },
  {
    name: 'Anaheim',
    marketHeat: 55, avgPrice: 635000, schoolRating: 5, investmentGrade: 'B',
    appreciation: 5.6, inventory: 52, daysOnMarket: 28,
    coordinates: [[
      [-117.95, 33.835], [-117.935, 33.835], [-117.91, 33.825],
      [-117.90, 33.81], [-117.90, 33.79], [-117.91, 33.78],
      [-117.93, 33.78], [-117.945, 33.79], [-117.955, 33.805],
      [-117.955, 33.82], [-117.95, 33.835],
    ]],
  },
  {
    name: 'Fullerton',
    marketHeat: 62, avgPrice: 920000, schoolRating: 7, investmentGrade: 'B',
    appreciation: 6.4, inventory: 19, daysOnMarket: 18,
    coordinates: [[
      [-117.955, 33.895], [-117.94, 33.895], [-117.92, 33.89],
      [-117.91, 33.88], [-117.91, 33.86], [-117.92, 33.85],
      [-117.935, 33.85], [-117.95, 33.86], [-117.96, 33.875],
      [-117.955, 33.895],
    ]],
  },
  {
    name: 'Orange',
    marketHeat: 60, avgPrice: 750000, schoolRating: 7, investmentGrade: 'B',
    appreciation: 5.9, inventory: 24, daysOnMarket: 21,
    coordinates: [[
      [-117.87, 33.805], [-117.855, 33.805], [-117.84, 33.80],
      [-117.835, 33.79], [-117.835, 33.775], [-117.84, 33.77],
      [-117.855, 33.77], [-117.87, 33.775], [-117.875, 33.79],
      [-117.87, 33.805],
    ]],
  },
  {
    name: 'Aliso Viejo',
    marketHeat: 70, avgPrice: 820000, schoolRating: 8, investmentGrade: 'B+',
    appreciation: 7.2, inventory: 12, daysOnMarket: 19,
    coordinates: [[
      [-117.745, 33.59], [-117.73, 33.59], [-117.72, 33.58],
      [-117.715, 33.57], [-117.72, 33.555], [-117.73, 33.555],
      [-117.745, 33.56], [-117.75, 33.575], [-117.745, 33.59],
    ]],
  },
  {
    name: 'Fountain Valley',
    marketHeat: 58, avgPrice: 820000, schoolRating: 7, investmentGrade: 'B',
    appreciation: 6.0, inventory: 15, daysOnMarket: 19,
    coordinates: [[
      [-117.975, 33.725], [-117.96, 33.725], [-117.945, 33.72],
      [-117.94, 33.71], [-117.94, 33.695], [-117.95, 33.69],
      [-117.965, 33.69], [-117.975, 33.70], [-117.98, 33.71],
      [-117.975, 33.725],
    ]],
  },
  {
    name: 'San Juan Cap.',
    marketHeat: 73, avgPrice: 1680000, schoolRating: 7, investmentGrade: 'A-',
    appreciation: 8.8, inventory: 11, daysOnMarket: 14,
    coordinates: [[
      [-117.68, 33.52], [-117.665, 33.52], [-117.65, 33.51],
      [-117.645, 33.50], [-117.65, 33.485], [-117.665, 33.48],
      [-117.68, 33.485], [-117.69, 33.50], [-117.685, 33.51],
      [-117.68, 33.52],
    ]],
  },
];

// ── National metro heat blobs (no polygons, just center points + data) ──

interface MetroBlob {
  name: string;
  coordinates: [number, number];
  marketHeat: number;
  avgPrice: number;
  investmentGrade: string;
  appreciation: number;
  inventory: number;
  daysOnMarket: number;
}

const NATIONAL_METROS: MetroBlob[] = [
  // ── West Coast ──
  { name: 'Los Angeles', coordinates: [-118.2437, 34.0522], marketHeat: 88, avgPrice: 1050000, investmentGrade: 'A', appreciation: 7.2, inventory: 312, daysOnMarket: 28 },
  { name: 'San Francisco', coordinates: [-122.4194, 37.7749], marketHeat: 91, avgPrice: 1480000, investmentGrade: 'A', appreciation: 5.8, inventory: 198, daysOnMarket: 32 },
  { name: 'San Jose', coordinates: [-121.8863, 37.3382], marketHeat: 94, avgPrice: 1620000, investmentGrade: 'A+', appreciation: 8.1, inventory: 142, daysOnMarket: 18 },
  { name: 'San Diego', coordinates: [-117.1611, 32.7157], marketHeat: 82, avgPrice: 920000, investmentGrade: 'A', appreciation: 7.9, inventory: 245, daysOnMarket: 22 },
  { name: 'Sacramento', coordinates: [-121.4944, 38.5816], marketHeat: 71, avgPrice: 540000, investmentGrade: 'B+', appreciation: 6.1, inventory: 178, daysOnMarket: 26 },
  { name: 'Portland', coordinates: [-122.6765, 45.5152], marketHeat: 64, avgPrice: 520000, investmentGrade: 'B', appreciation: 4.2, inventory: 203, daysOnMarket: 34 },
  { name: 'Seattle', coordinates: [-122.3321, 47.6062], marketHeat: 86, avgPrice: 850000, investmentGrade: 'A', appreciation: 6.5, inventory: 267, daysOnMarket: 21 },
  { name: 'Las Vegas', coordinates: [-115.1398, 36.1699], marketHeat: 73, avgPrice: 425000, investmentGrade: 'B+', appreciation: 8.4, inventory: 340, daysOnMarket: 30 },
  { name: 'Phoenix', coordinates: [-112.0740, 33.4484], marketHeat: 79, avgPrice: 460000, investmentGrade: 'A-', appreciation: 9.1, inventory: 410, daysOnMarket: 25 },
  { name: 'Tucson', coordinates: [-110.9747, 32.2226], marketHeat: 58, avgPrice: 320000, investmentGrade: 'B', appreciation: 6.8, inventory: 185, daysOnMarket: 35 },
  { name: 'Boise', coordinates: [-116.2023, 43.6150], marketHeat: 68, avgPrice: 480000, investmentGrade: 'B+', appreciation: 7.2, inventory: 124, daysOnMarket: 28 },
  { name: 'Salt Lake City', coordinates: [-111.8910, 40.7608], marketHeat: 72, avgPrice: 550000, investmentGrade: 'B+', appreciation: 6.9, inventory: 156, daysOnMarket: 24 },
  { name: 'Denver', coordinates: [-104.9903, 39.7392], marketHeat: 77, avgPrice: 620000, investmentGrade: 'A-', appreciation: 5.5, inventory: 289, daysOnMarket: 22 },
  { name: 'Colorado Springs', coordinates: [-104.8214, 38.8339], marketHeat: 65, avgPrice: 450000, investmentGrade: 'B+', appreciation: 6.1, inventory: 167, daysOnMarket: 27 },
  { name: 'Albuquerque', coordinates: [-106.6504, 35.0844], marketHeat: 52, avgPrice: 330000, investmentGrade: 'B-', appreciation: 5.2, inventory: 142, daysOnMarket: 38 },
  { name: 'Honolulu', coordinates: [-157.8583, 21.3069], marketHeat: 80, avgPrice: 980000, investmentGrade: 'A-', appreciation: 4.5, inventory: 88, daysOnMarket: 42 },

  // ── Texas ──
  { name: 'Austin', coordinates: [-97.7431, 30.2672], marketHeat: 84, avgPrice: 580000, investmentGrade: 'A', appreciation: 6.8, inventory: 378, daysOnMarket: 24 },
  { name: 'Dallas', coordinates: [-96.7970, 32.7767], marketHeat: 78, avgPrice: 420000, investmentGrade: 'A-', appreciation: 7.4, inventory: 445, daysOnMarket: 26 },
  { name: 'Houston', coordinates: [-95.3698, 29.7604], marketHeat: 72, avgPrice: 350000, investmentGrade: 'B+', appreciation: 6.2, inventory: 520, daysOnMarket: 30 },
  { name: 'San Antonio', coordinates: [-98.4936, 29.4241], marketHeat: 63, avgPrice: 310000, investmentGrade: 'B', appreciation: 5.8, inventory: 295, daysOnMarket: 32 },
  { name: 'El Paso', coordinates: [-106.4424, 31.7619], marketHeat: 48, avgPrice: 240000, investmentGrade: 'B-', appreciation: 4.5, inventory: 165, daysOnMarket: 40 },

  // ── Southeast ──
  { name: 'Miami', coordinates: [-80.1918, 25.7617], marketHeat: 90, avgPrice: 620000, investmentGrade: 'A', appreciation: 8.2, inventory: 380, daysOnMarket: 22 },
  { name: 'Tampa', coordinates: [-82.4572, 27.9506], marketHeat: 81, avgPrice: 410000, investmentGrade: 'A-', appreciation: 9.5, inventory: 310, daysOnMarket: 20 },
  { name: 'Orlando', coordinates: [-81.3789, 28.5383], marketHeat: 76, avgPrice: 390000, investmentGrade: 'B+', appreciation: 8.8, inventory: 345, daysOnMarket: 24 },
  { name: 'Jacksonville', coordinates: [-81.6557, 30.3322], marketHeat: 67, avgPrice: 360000, investmentGrade: 'B+', appreciation: 7.1, inventory: 220, daysOnMarket: 28 },
  { name: 'Atlanta', coordinates: [-84.3880, 33.7490], marketHeat: 80, avgPrice: 420000, investmentGrade: 'A-', appreciation: 7.6, inventory: 390, daysOnMarket: 25 },
  { name: 'Charlotte', coordinates: [-80.8431, 35.2271], marketHeat: 78, avgPrice: 400000, investmentGrade: 'A-', appreciation: 8.0, inventory: 275, daysOnMarket: 22 },
  { name: 'Raleigh', coordinates: [-78.6382, 35.7796], marketHeat: 83, avgPrice: 450000, investmentGrade: 'A', appreciation: 8.4, inventory: 198, daysOnMarket: 18 },
  { name: 'Nashville', coordinates: [-86.7816, 36.1627], marketHeat: 82, avgPrice: 480000, investmentGrade: 'A-', appreciation: 7.8, inventory: 265, daysOnMarket: 20 },
  { name: 'Charleston', coordinates: [-79.9311, 32.7765], marketHeat: 75, avgPrice: 520000, investmentGrade: 'B+', appreciation: 7.2, inventory: 145, daysOnMarket: 26 },
  { name: 'Savannah', coordinates: [-81.0998, 32.0809], marketHeat: 62, avgPrice: 340000, investmentGrade: 'B', appreciation: 6.5, inventory: 118, daysOnMarket: 30 },
  { name: 'New Orleans', coordinates: [-90.0715, 29.9511], marketHeat: 56, avgPrice: 290000, investmentGrade: 'B-', appreciation: 4.8, inventory: 205, daysOnMarket: 38 },
  { name: 'Birmingham', coordinates: [-86.8025, 33.5207], marketHeat: 50, avgPrice: 260000, investmentGrade: 'B-', appreciation: 4.2, inventory: 175, daysOnMarket: 42 },
  { name: 'Memphis', coordinates: [-90.0490, 35.1495], marketHeat: 47, avgPrice: 220000, investmentGrade: 'C+', appreciation: 3.8, inventory: 195, daysOnMarket: 45 },

  // ── Northeast ──
  { name: 'New York', coordinates: [-74.0060, 40.7128], marketHeat: 87, avgPrice: 780000, investmentGrade: 'A', appreciation: 4.5, inventory: 520, daysOnMarket: 35 },
  { name: 'Boston', coordinates: [-71.0589, 42.3601], marketHeat: 89, avgPrice: 820000, investmentGrade: 'A', appreciation: 5.2, inventory: 245, daysOnMarket: 28 },
  { name: 'Philadelphia', coordinates: [-75.1652, 39.9526], marketHeat: 68, avgPrice: 340000, investmentGrade: 'B+', appreciation: 5.8, inventory: 310, daysOnMarket: 32 },
  { name: 'Washington DC', coordinates: [-77.0369, 38.9072], marketHeat: 83, avgPrice: 640000, investmentGrade: 'A', appreciation: 5.4, inventory: 278, daysOnMarket: 24 },
  { name: 'Baltimore', coordinates: [-76.6122, 39.2904], marketHeat: 55, avgPrice: 280000, investmentGrade: 'B-', appreciation: 4.1, inventory: 220, daysOnMarket: 38 },
  { name: 'Pittsburgh', coordinates: [-79.9959, 40.4406], marketHeat: 58, avgPrice: 250000, investmentGrade: 'B', appreciation: 5.0, inventory: 168, daysOnMarket: 35 },
  { name: 'Hartford', coordinates: [-72.6823, 41.7658], marketHeat: 54, avgPrice: 310000, investmentGrade: 'B-', appreciation: 4.6, inventory: 140, daysOnMarket: 36 },
  { name: 'Providence', coordinates: [-71.4128, 41.8240], marketHeat: 62, avgPrice: 420000, investmentGrade: 'B', appreciation: 5.8, inventory: 125, daysOnMarket: 30 },
  { name: 'Jersey City', coordinates: [-74.0431, 40.7178], marketHeat: 81, avgPrice: 680000, investmentGrade: 'A-', appreciation: 5.1, inventory: 165, daysOnMarket: 26 },

  // ── Midwest ──
  { name: 'Chicago', coordinates: [-87.6298, 41.8781], marketHeat: 70, avgPrice: 350000, investmentGrade: 'B+', appreciation: 4.8, inventory: 420, daysOnMarket: 30 },
  { name: 'Minneapolis', coordinates: [-93.2650, 44.9778], marketHeat: 66, avgPrice: 380000, investmentGrade: 'B+', appreciation: 5.2, inventory: 235, daysOnMarket: 28 },
  { name: 'Detroit', coordinates: [-83.0458, 42.3314], marketHeat: 52, avgPrice: 220000, investmentGrade: 'B-', appreciation: 6.5, inventory: 280, daysOnMarket: 40 },
  { name: 'Columbus', coordinates: [-82.9988, 39.9612], marketHeat: 69, avgPrice: 320000, investmentGrade: 'B+', appreciation: 6.8, inventory: 210, daysOnMarket: 25 },
  { name: 'Indianapolis', coordinates: [-86.1581, 39.7684], marketHeat: 61, avgPrice: 290000, investmentGrade: 'B', appreciation: 6.2, inventory: 245, daysOnMarket: 28 },
  { name: 'Milwaukee', coordinates: [-87.9065, 43.0389], marketHeat: 55, avgPrice: 270000, investmentGrade: 'B-', appreciation: 5.0, inventory: 178, daysOnMarket: 34 },
  { name: 'Kansas City', coordinates: [-94.5786, 39.0997], marketHeat: 60, avgPrice: 290000, investmentGrade: 'B', appreciation: 5.6, inventory: 205, daysOnMarket: 30 },
  { name: 'St. Louis', coordinates: [-90.1994, 38.6270], marketHeat: 53, avgPrice: 240000, investmentGrade: 'B-', appreciation: 4.5, inventory: 230, daysOnMarket: 36 },
  { name: 'Cincinnati', coordinates: [-84.5120, 39.1031], marketHeat: 62, avgPrice: 280000, investmentGrade: 'B', appreciation: 5.8, inventory: 190, daysOnMarket: 28 },
  { name: 'Cleveland', coordinates: [-81.6944, 41.4993], marketHeat: 48, avgPrice: 200000, investmentGrade: 'C+', appreciation: 4.2, inventory: 210, daysOnMarket: 42 },
  { name: 'Omaha', coordinates: [-95.9345, 41.2565], marketHeat: 58, avgPrice: 280000, investmentGrade: 'B', appreciation: 5.4, inventory: 145, daysOnMarket: 26 },
  { name: 'Des Moines', coordinates: [-93.6091, 41.5868], marketHeat: 56, avgPrice: 260000, investmentGrade: 'B', appreciation: 5.0, inventory: 132, daysOnMarket: 30 },
  { name: 'Madison', coordinates: [-89.4012, 43.0731], marketHeat: 70, avgPrice: 390000, investmentGrade: 'B+', appreciation: 6.2, inventory: 118, daysOnMarket: 22 },

  // ── Mountain / Plains ──
  { name: 'Reno', coordinates: [-119.8138, 39.5296], marketHeat: 70, avgPrice: 520000, investmentGrade: 'B+', appreciation: 7.0, inventory: 135, daysOnMarket: 28 },
  { name: 'Spokane', coordinates: [-117.4260, 47.6588], marketHeat: 60, avgPrice: 380000, investmentGrade: 'B', appreciation: 5.8, inventory: 148, daysOnMarket: 30 },
  { name: 'Billings', coordinates: [-108.5007, 45.7833], marketHeat: 52, avgPrice: 340000, investmentGrade: 'B-', appreciation: 4.8, inventory: 95, daysOnMarket: 34 },
  { name: 'Fargo', coordinates: [-96.7898, 46.8772], marketHeat: 50, avgPrice: 280000, investmentGrade: 'B-', appreciation: 4.2, inventory: 88, daysOnMarket: 32 },
  { name: 'Sioux Falls', coordinates: [-96.7311, 43.5446], marketHeat: 55, avgPrice: 300000, investmentGrade: 'B', appreciation: 5.5, inventory: 105, daysOnMarket: 28 },

  // ── South Central ──
  { name: 'Oklahoma City', coordinates: [-97.5164, 35.4676], marketHeat: 54, avgPrice: 250000, investmentGrade: 'B-', appreciation: 4.8, inventory: 225, daysOnMarket: 34 },
  { name: 'Tulsa', coordinates: [-95.9928, 36.1540], marketHeat: 50, avgPrice: 230000, investmentGrade: 'B-', appreciation: 4.2, inventory: 185, daysOnMarket: 36 },
  { name: 'Little Rock', coordinates: [-92.2896, 34.7465], marketHeat: 46, avgPrice: 220000, investmentGrade: 'C+', appreciation: 3.6, inventory: 165, daysOnMarket: 42 },
  { name: 'Louisville', coordinates: [-85.7585, 38.2527], marketHeat: 58, avgPrice: 280000, investmentGrade: 'B', appreciation: 5.2, inventory: 195, daysOnMarket: 30 },
  { name: 'Knoxville', coordinates: [-83.9207, 35.9606], marketHeat: 65, avgPrice: 350000, investmentGrade: 'B+', appreciation: 7.0, inventory: 155, daysOnMarket: 24 },

  // ── Pacific Northwest extras ──
  { name: 'Anchorage', coordinates: [-149.9003, 61.2181], marketHeat: 42, avgPrice: 380000, investmentGrade: 'C+', appreciation: 2.8, inventory: 92, daysOnMarket: 52 },

  // ── Northeast extras ──
  { name: 'Burlington', coordinates: [-73.2121, 44.4759], marketHeat: 64, avgPrice: 420000, investmentGrade: 'B', appreciation: 5.4, inventory: 78, daysOnMarket: 30 },
  { name: 'Portland ME', coordinates: [-70.2553, 43.6591], marketHeat: 72, avgPrice: 480000, investmentGrade: 'B+', appreciation: 6.8, inventory: 95, daysOnMarket: 25 },
  { name: 'Richmond', coordinates: [-77.4360, 37.5407], marketHeat: 66, avgPrice: 380000, investmentGrade: 'B+', appreciation: 5.6, inventory: 185, daysOnMarket: 26 },
  { name: 'Virginia Beach', coordinates: [-75.9780, 36.8529], marketHeat: 63, avgPrice: 350000, investmentGrade: 'B', appreciation: 5.2, inventory: 210, daysOnMarket: 28 },
  { name: 'Buffalo', coordinates: [-78.8784, 42.8864], marketHeat: 50, avgPrice: 220000, investmentGrade: 'B-', appreciation: 5.0, inventory: 145, daysOnMarket: 36 },
  { name: 'Albany', coordinates: [-73.7562, 42.6526], marketHeat: 54, avgPrice: 280000, investmentGrade: 'B-', appreciation: 4.8, inventory: 130, daysOnMarket: 34 },
  { name: 'Stamford', coordinates: [-73.5387, 41.0534], marketHeat: 78, avgPrice: 720000, investmentGrade: 'A-', appreciation: 4.2, inventory: 110, daysOnMarket: 30 },
];

function buildZonesGeoJSON() {
  return {
    type: 'FeatureCollection' as const,
    features: ZONES.map((z) => ({
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: z.coordinates },
      properties: {
        name: z.name,
        marketHeat: z.marketHeat,
        avgPrice: z.avgPrice,
        schoolRating: z.schoolRating,
        investmentGrade: z.investmentGrade,
        appreciation: z.appreciation,
        inventory: z.inventory,
        daysOnMarket: z.daysOnMarket,
      },
    })),
  };
}

function buildZoneLabelPoints() {
  // OC zones
  const ocLabels = ZONES.map((z) => {
    const coords = z.coordinates[0];
    const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    return {
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] },
      properties: {
        name: z.name,
        marketHeat: z.marketHeat,
        investmentGrade: z.investmentGrade,
      },
    };
  });

  // National metros
  const nationalLabels = NATIONAL_METROS.map((m) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: m.coordinates as [number, number] },
    properties: {
      name: m.name,
      marketHeat: m.marketHeat,
      investmentGrade: m.investmentGrade,
    },
  }));

  return {
    type: 'FeatureCollection' as const,
    features: [...ocLabels, ...nationalLabels],
  };
}

// Zone center points for the big radial heat blobs — OC zones + nationwide metros
function buildZoneCenters() {
  // OC local zones
  const ocFeatures = ZONES.map((z) => {
    const coords = z.coordinates[0];
    const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    return {
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] },
      properties: {
        name: z.name,
        marketHeat: z.marketHeat,
        avgPrice: z.avgPrice,
        investmentGrade: z.investmentGrade,
        appreciation: z.appreciation,
        inventory: z.inventory,
        daysOnMarket: z.daysOnMarket,
        isNational: false,
      },
    };
  });

  // Nationwide metros
  const nationalFeatures = NATIONAL_METROS.map((m) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: m.coordinates as [number, number] },
    properties: {
      name: m.name,
      marketHeat: m.marketHeat,
      avgPrice: m.avgPrice,
      investmentGrade: m.investmentGrade,
      appreciation: m.appreciation,
      inventory: m.inventory,
      daysOnMarket: m.daysOnMarket,
      isNational: true,
    },
  }));

  return {
    type: 'FeatureCollection' as const,
    features: [...ocFeatures, ...nationalFeatures],
  };
}

// ── Marker & Popup ──

function createMarkerElement(property: Property): HTMLDivElement {
  const el = document.createElement('div');
  const cls = property.status === 'flagged' ? ' status-flagged' : property.status === 'pending' ? ' status-pending' : '';
  el.className = 'map-marker' + cls;
  el.innerHTML = `<div class="ring"></div><div class="ring ring-2"></div><div class="core"></div>`;
  return el;
}

function createPopupHTML(property: Property): string {
  const risk = getRiskLabel(property.riskScore);
  const statusColor = property.status === 'active' ? '#10B981' : property.status === 'pending' ? '#F59E0B' : '#EF4444';
  const statusLabel = property.status === 'active' ? 'ACTIVE' : property.status === 'pending' ? 'PENDING' : 'FLAGGED';
  return `
    <div style="width:300px;font-family:DM Sans,sans-serif;">
      <div style="position:relative;height:110px;overflow:hidden;">
        <img src="${property.image}" style="width:100%;height:100%;object-fit:cover;" />
        <div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(8,12,20,0.85) 0%,rgba(8,12,20,0.2) 40%,transparent 60%)"></div>
        <div style="position:absolute;top:8px;right:8px;display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:2px;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);border:1px solid ${statusColor}30;">
          <div style="width:5px;height:5px;border-radius:50%;background:${statusColor};box-shadow:0 0 6px ${statusColor}"></div>
          <span style="font-family:JetBrains Mono,monospace;font-size:9px;font-weight:600;color:${statusColor};letter-spacing:0.05em">${statusLabel}</span>
        </div>
        <div style="position:absolute;bottom:8px;left:12px;right:12px;display:flex;align-items:flex-end;justify-content:space-between;">
          <div style="font-family:JetBrains Mono,monospace;font-size:18px;font-weight:700;color:white;text-shadow:0 1px 8px rgba(0,0,0,0.6);letter-spacing:-0.02em">
            ${formatPrice(property.price)}
          </div>
          <div style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:600;color:#06B6D4;background:rgba(6,182,212,0.12);padding:2px 6px;border-radius:2px;border:1px solid rgba(6,182,212,0.2)">
            ${property.id}
          </div>
        </div>
      </div>
      <div style="padding:12px 14px 16px;background:#0D1117;">
        <div style="font-size:14px;font-weight:600;color:#E2E8F0;margin-bottom:2px">${property.address}</div>
        <div style="font-size:11px;color:#64748B;margin-bottom:12px;display:flex;align-items:center;gap:4px">
          <span>${property.city}</span>
          <span style="color:rgba(255,255,255,0.15)">/</span>
          <span>${property.beds}bd ${property.baths}ba</span>
          <span style="color:rgba(255,255,255,0.15)">/</span>
          <span>${property.sqft.toLocaleString()} sf</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)">
          <div style="text-align:center;padding:6px;background:rgba(16,185,129,0.06);border-radius:2px;border:1px solid rgba(16,185,129,0.1)">
            <div style="font-family:JetBrains Mono,monospace;font-size:14px;font-weight:700;color:#10B981">+${property.roi}%</div>
            <div style="font-size:9px;color:#64748B;margin-top:2px;letter-spacing:0.05em">ROI</div>
          </div>
          <div style="text-align:center;padding:6px;background:${risk.color}0F;border-radius:2px;border:1px solid ${risk.color}1A">
            <div style="font-family:JetBrains Mono,monospace;font-size:14px;font-weight:700;color:${risk.color}">${property.riskScore}</div>
            <div style="font-size:9px;color:#64748B;margin-top:2px;letter-spacing:0.05em">RISK</div>
          </div>
          <div style="text-align:center;padding:6px;background:rgba(6,182,212,0.06);border-radius:2px;border:1px solid rgba(6,182,212,0.1)">
            <div style="font-family:JetBrains Mono,monospace;font-size:14px;font-weight:700;color:#06B6D4">${property.daysOnMarket}d</div>
            <div style="font-size:9px;color:#64748B;margin-top:2px;letter-spacing:0.05em">LISTED</div>
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
  const animFrameRef = useRef<number>(0);

  onSelectRef.current = onSelectProperty;

  useEffect(() => {
    let cancelled = false;

    async function loadMap() {
      if (!mapContainer.current || mapRef.current) return;

      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        if (cancelled) return;

        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
        mapboxRef.current = mapboxgl;

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  STANDARD STYLE + NIGHT MONOCHROME — the real dark ops look
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const map = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/standard',
          config: {
            basemap: {
              theme: 'monochrome',
              lightPreset: 'night',
              showPointOfInterestLabels: false,
              showTransitLabels: false,
            },
          },
          center: [-98.5, 38.5],
          zoom: 3.8,
          pitch: 30,
          bearing: 0,
          attributionControl: false,
          antialias: true,
        });

        mapRef.current = map;

        map.addControl(
          new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }),
          'top-right'
        );

        map.on('style.load', () => {
          if (cancelled) return;

          // ── Fog: deep dark atmosphere with stars ──
          map.setFog({
            color: 'rgb(8, 10, 18)',
            'high-color': 'rgb(16, 22, 40)',
            'horizon-blend': 0.06,
            'space-color': 'rgb(4, 6, 12)',
            'star-intensity': 0.55,
            range: [0.5, 10],
          });

          // ── Sky: dark atmosphere with faint halo ──
          map.addLayer({
            id: 'sky',
            type: 'sky',
            paint: {
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun': [90, 0],
              'sky-atmosphere-sun-intensity': 2,
              'sky-atmosphere-halo-color': 'rgba(6, 182, 212, 0.15)',
              'sky-atmosphere-color': 'rgba(6, 182, 212, 0.08)',
              'sky-opacity': [
                'interpolate', ['exponential', 0.1], ['zoom'],
                5, 0,
                22, 1,
              ],
            },
          });

          // ── 3D Terrain ──
          map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512,
            maxzoom: 14,
          });
          map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.4 });

          // ── Directional lighting — cold blue moonlight ──
          map.setLights([
            {
              type: 'flat',
              id: 'flat',
              properties: {
                position: [1.5, 210, 30],
                anchor: 'map',
                intensity: 0.6,
              },
            },
          ]);

          // ── 3D Buildings: flood-lit cyberpunk style ──
          map.addLayer({
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 13,
            paint: {
              'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'height'],
                0, '#0A0F1A',
                30, '#111827',
                100, '#1E293B',
              ],
              'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                13, 0,
                13.5, ['get', 'height'],
              ],
              'fill-extrusion-base': [
                'interpolate', ['linear'], ['zoom'],
                13, 0,
                13.5, ['get', 'min_height'],
              ],
              'fill-extrusion-opacity': 0.85,
              'fill-extrusion-vertical-gradient': true,
              'fill-extrusion-ambient-occlusion-intensity': 0.3,
              'fill-extrusion-ambient-occlusion-radius': 3,
              'fill-extrusion-flood-light-color': '#06B6D4',
              'fill-extrusion-flood-light-intensity': 0.15,
              'fill-extrusion-flood-light-wall-radius': [
                'case',
                ['>', ['get', 'height'], 30], ['/', ['get', 'height'], 8],
                0,
              ],
              'fill-extrusion-flood-light-ground-radius': [
                'case',
                ['>', ['get', 'height'], 30], ['/', ['get', 'height'], 12],
                0,
              ],
            },
          });

          // ── Sources ──
          map.addSource('properties', {
            type: 'geojson',
            data: buildPropertiesGeoJSON(),
          });

          map.addSource('connection-lines', {
            type: 'geojson',
            data: buildConnectionLines(),
          });

          map.addSource('scan-rings', {
            type: 'geojson',
            data: buildScanRings(),
          });

          map.addSource('zones', {
            type: 'geojson',
            data: buildZonesGeoJSON(),
          });

          map.addSource('zone-labels', {
            type: 'geojson',
            data: buildZoneLabelPoints(),
          });

          map.addSource('zone-centers', {
            type: 'geojson',
            data: buildZoneCenters(),
          });

          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          //  RADIAL HEAT BLOBS — the big glowing zone circles
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

          // Layer 1: Outer ambient glow — huge, very blurred, faint
          map.addLayer({
            id: 'zone-blob-ambient',
            type: 'circle',
            source: 'zone-centers',
            paint: {
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                8, ['interpolate', ['linear'], ['get', 'marketHeat'], 40, 50, 70, 70, 95, 100],
                11, ['interpolate', ['linear'], ['get', 'marketHeat'], 40, 90, 70, 130, 95, 180],
                14, ['interpolate', ['linear'], ['get', 'marketHeat'], 40, 150, 70, 220, 95, 300],
              ],
              'circle-color': [
                'interpolate', ['linear'], ['get', 'marketHeat'],
                40, 'rgba(6, 182, 212, 0.12)',
                60, 'rgba(16, 185, 129, 0.14)',
                75, 'rgba(245, 158, 11, 0.16)',
                85, 'rgba(239, 68, 68, 0.18)',
                95, 'rgba(239, 68, 68, 0.22)',
              ],
              'circle-blur': 1.2,
              'circle-opacity': [
                'interpolate', ['linear'], ['zoom'],
                8, 0.8,
                13, 0.5,
                16, 0.1,
              ],
              'circle-emissive-strength': 1,
            },
          });

          // Layer 2: Core blob — medium, moderately blurred, stronger color
          map.addLayer({
            id: 'zone-blob-core',
            type: 'circle',
            source: 'zone-centers',
            paint: {
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                8, ['interpolate', ['linear'], ['get', 'marketHeat'], 40, 25, 70, 40, 95, 60],
                11, ['interpolate', ['linear'], ['get', 'marketHeat'], 40, 50, 70, 75, 95, 110],
                14, ['interpolate', ['linear'], ['get', 'marketHeat'], 40, 80, 70, 130, 95, 180],
              ],
              'circle-color': [
                'interpolate', ['linear'], ['get', 'marketHeat'],
                40, 'rgba(6, 182, 212, 0.18)',
                60, 'rgba(16, 185, 129, 0.22)',
                75, 'rgba(245, 158, 11, 0.25)',
                85, 'rgba(239, 68, 68, 0.3)',
                95, 'rgba(239, 68, 68, 0.38)',
              ],
              'circle-blur': 0.7,
              'circle-opacity': [
                'interpolate', ['linear'], ['zoom'],
                8, 0.85,
                13, 0.55,
                16, 0.1,
              ],
              'circle-emissive-strength': 1,
            },
          });

          // Layer 3: Hot center — small, minimal blur, intense
          map.addLayer({
            id: 'zone-blob-hot',
            type: 'circle',
            source: 'zone-centers',
            paint: {
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                8, ['interpolate', ['linear'], ['get', 'marketHeat'], 40, 10, 70, 18, 95, 28],
                11, ['interpolate', ['linear'], ['get', 'marketHeat'], 40, 22, 70, 35, 95, 55],
                14, ['interpolate', ['linear'], ['get', 'marketHeat'], 40, 40, 70, 60, 95, 90],
              ],
              'circle-color': [
                'interpolate', ['linear'], ['get', 'marketHeat'],
                40, 'rgba(6, 182, 212, 0.25)',
                60, 'rgba(16, 185, 129, 0.3)',
                75, 'rgba(245, 158, 11, 0.35)',
                85, 'rgba(239, 68, 68, 0.45)',
                95, 'rgba(239, 68, 68, 0.55)',
              ],
              'circle-blur': 0.4,
              'circle-opacity': [
                'interpolate', ['linear'], ['zoom'],
                8, 0.8,
                13, 0.45,
                16, 0.08,
              ],
              'circle-emissive-strength': 1,
            },
          });

          // Layer 4: Edge ring — a visible stroke ring around the blob
          map.addLayer({
            id: 'zone-blob-ring',
            type: 'circle',
            source: 'zone-centers',
            paint: {
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                8, ['interpolate', ['linear'], ['get', 'marketHeat'], 40, 35, 70, 50, 95, 70],
                11, ['interpolate', ['linear'], ['get', 'marketHeat'], 40, 65, 70, 95, 95, 135],
                14, ['interpolate', ['linear'], ['get', 'marketHeat'], 40, 110, 70, 165, 95, 220],
              ],
              'circle-color': 'transparent',
              'circle-stroke-width': [
                'interpolate', ['linear'], ['zoom'],
                8, 1.5,
                12, 2,
                15, 2.5,
              ],
              'circle-stroke-color': [
                'interpolate', ['linear'], ['get', 'marketHeat'],
                40, 'rgba(6, 182, 212, 0.2)',
                65, 'rgba(16, 185, 129, 0.25)',
                80, 'rgba(245, 158, 11, 0.3)',
                95, 'rgba(239, 68, 68, 0.35)',
              ],
              'circle-opacity': [
                'interpolate', ['linear'], ['zoom'],
                8, 0.7,
                13, 0.35,
                16, 0,
              ],
              'circle-emissive-strength': 0.8,
            },
          });

          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          //  ZONE LAYERS — neighborhood area intelligence
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

          // Zone fill — colored by marketHeat (cool cyan → hot red)
          map.addLayer({
            id: 'zone-fill',
            type: 'fill',
            source: 'zones',
            slot: 'bottom',
            paint: {
              'fill-color': [
                'interpolate', ['linear'], ['get', 'marketHeat'],
                40, 'rgba(6, 182, 212, 0.08)',
                55, 'rgba(6, 182, 212, 0.12)',
                65, 'rgba(16, 185, 129, 0.14)',
                75, 'rgba(245, 158, 11, 0.14)',
                85, 'rgba(239, 68, 68, 0.14)',
                95, 'rgba(239, 68, 68, 0.2)',
              ],
              'fill-opacity': [
                'interpolate', ['linear'], ['zoom'],
                8, 0.9,
                14, 0.5,
                16, 0.15,
              ],
              'fill-emissive-strength': 0.5,
            },
          });

          // Zone border — glowing outline
          map.addLayer({
            id: 'zone-border',
            type: 'line',
            source: 'zones',
            paint: {
              'line-color': [
                'interpolate', ['linear'], ['get', 'marketHeat'],
                40, 'rgba(6, 182, 212, 0.25)',
                65, 'rgba(16, 185, 129, 0.35)',
                80, 'rgba(245, 158, 11, 0.4)',
                95, 'rgba(239, 68, 68, 0.45)',
              ],
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                8, 1,
                12, 1.5,
                15, 2,
              ],
              'line-opacity': [
                'interpolate', ['linear'], ['zoom'],
                8, 0.8,
                14, 0.4,
                16, 0.1,
              ],
              'line-emissive-strength': 0.8,
            },
          });

          // Zone border — outer glow (wider, more transparent)
          map.addLayer({
            id: 'zone-border-glow',
            type: 'line',
            source: 'zones',
            paint: {
              'line-color': [
                'interpolate', ['linear'], ['get', 'marketHeat'],
                40, 'rgba(6, 182, 212, 0.08)',
                65, 'rgba(16, 185, 129, 0.1)',
                80, 'rgba(245, 158, 11, 0.12)',
                95, 'rgba(239, 68, 68, 0.15)',
              ],
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                8, 4,
                12, 6,
                15, 8,
              ],
              'line-blur': 4,
              'line-opacity': [
                'interpolate', ['linear'], ['zoom'],
                8, 0.7,
                14, 0.3,
                16, 0,
              ],
              'line-emissive-strength': 1,
            },
          });

          // Zone labels — name + grade
          map.addLayer({
            id: 'zone-labels',
            type: 'symbol',
            source: 'zone-labels',
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': [
                'interpolate', ['linear'], ['zoom'],
                8, 10,
                12, 13,
                15, 0,
              ],
              'text-transform': 'uppercase',
              'text-letter-spacing': 0.1,
              'text-allow-overlap': false,
            },
            paint: {
              'text-color': 'rgba(148, 163, 184, 0.7)',
              'text-halo-color': 'rgba(8, 12, 20, 0.8)',
              'text-halo-width': 2,
              'text-emissive-strength': 0.6,
            },
          });

          // Zone grade badges (below the name)
          map.addLayer({
            id: 'zone-grade-labels',
            type: 'symbol',
            source: 'zone-labels',
            layout: {
              'text-field': [
                'concat',
                ['get', 'investmentGrade'],
                ' \u2022 ',
                ['to-string', ['get', 'marketHeat']],
              ],
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': [
                'interpolate', ['linear'], ['zoom'],
                8, 8,
                12, 10,
                15, 0,
              ],
              'text-offset': [0, 1.4],
              'text-allow-overlap': false,
            },
            paint: {
              'text-color': [
                'interpolate', ['linear'], ['get', 'marketHeat'],
                40, 'rgba(6, 182, 212, 0.6)',
                65, 'rgba(16, 185, 129, 0.65)',
                80, 'rgba(245, 158, 11, 0.65)',
                95, 'rgba(239, 68, 68, 0.65)',
              ],
              'text-halo-color': 'rgba(8, 12, 20, 0.8)',
              'text-halo-width': 1.5,
              'text-emissive-strength': 0.8,
            },
          });

          // ── Zone hover popup ──
          const zonePopup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: 'none',
            offset: 12,
          });

          map.on('mousemove', 'zone-fill', (e: any) => {
            if (!e.features || e.features.length === 0) return;
            map.getCanvas().style.cursor = 'pointer';
            const f = e.features[0].properties;
            const heatColor = f.marketHeat >= 85 ? '#EF4444' : f.marketHeat >= 75 ? '#F59E0B' : f.marketHeat >= 65 ? '#10B981' : '#06B6D4';
            zonePopup
              .setLngLat(e.lngLat)
              .setHTML(`
                <div style="width:220px;font-family:DM Sans,sans-serif;padding:12px 14px;background:#0D1117;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                    <span style="font-size:13px;font-weight:700;color:#E2E8F0;letter-spacing:-0.01em">${f.name}</span>
                    <span style="font-family:JetBrains Mono,monospace;font-size:12px;font-weight:700;color:${heatColor};background:${heatColor}15;padding:2px 6px;border-radius:2px;border:1px solid ${heatColor}25">${f.investmentGrade}</span>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
                    <div style="padding:6px;background:rgba(255,255,255,0.03);border-radius:2px">
                      <div style="font-size:8px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Market Heat</div>
                      <div style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:700;color:${heatColor}">${f.marketHeat}<span style="font-size:9px;opacity:0.6">/100</span></div>
                    </div>
                    <div style="padding:6px;background:rgba(255,255,255,0.03);border-radius:2px">
                      <div style="font-size:8px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Avg Price</div>
                      <div style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:700;color:#E2E8F0">${formatPrice(f.avgPrice)}</div>
                    </div>
                    <div style="padding:6px;background:rgba(255,255,255,0.03);border-radius:2px">
                      <div style="font-size:8px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Schools</div>
                      <div style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:700;color:#06B6D4">${f.schoolRating}<span style="font-size:9px;opacity:0.6">/10</span></div>
                    </div>
                    <div style="padding:6px;background:rgba(255,255,255,0.03);border-radius:2px">
                      <div style="font-size:8px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">YoY Growth</div>
                      <div style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:700;color:#10B981">+${f.appreciation}%</div>
                    </div>
                  </div>
                  <div style="display:flex;gap:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.05)">
                    <div style="font-size:9px;color:#64748B"><span style="font-family:JetBrains Mono,monospace;color:#94A3B8;font-weight:600">${f.inventory}</span> listings</div>
                    <div style="font-size:9px;color:#64748B"><span style="font-family:JetBrains Mono,monospace;color:#94A3B8;font-weight:600">${f.daysOnMarket}d</span> avg DOM</div>
                  </div>
                </div>
              `)
              .addTo(map);
          });

          map.on('mouseleave', 'zone-fill', () => {
            map.getCanvas().style.cursor = '';
            zonePopup.remove();
          });

          // ── Blob hover popup (for national metros) ──
          const blobPopup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: 'none',
            offset: 20,
          });

          map.on('mousemove', 'zone-blob-core', (e: any) => {
            if (!e.features || e.features.length === 0) return;
            map.getCanvas().style.cursor = 'pointer';
            const f = e.features[0].properties;
            const heatColor = f.marketHeat >= 85 ? '#EF4444' : f.marketHeat >= 75 ? '#F59E0B' : f.marketHeat >= 65 ? '#10B981' : '#06B6D4';
            blobPopup
              .setLngLat(e.lngLat)
              .setHTML(`
                <div style="width:220px;font-family:DM Sans,sans-serif;padding:12px 14px;background:#0D1117;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                    <span style="font-size:13px;font-weight:700;color:#E2E8F0">${f.name}</span>
                    <span style="font-family:JetBrains Mono,monospace;font-size:12px;font-weight:700;color:${heatColor};background:${heatColor}15;padding:2px 6px;border-radius:2px;border:1px solid ${heatColor}25">${f.investmentGrade}</span>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
                    <div style="padding:6px;background:rgba(255,255,255,0.03);border-radius:2px">
                      <div style="font-size:8px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Market Heat</div>
                      <div style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:700;color:${heatColor}">${f.marketHeat}<span style="font-size:9px;opacity:0.6">/100</span></div>
                    </div>
                    <div style="padding:6px;background:rgba(255,255,255,0.03);border-radius:2px">
                      <div style="font-size:8px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Avg Price</div>
                      <div style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:700;color:#E2E8F0">${formatPrice(f.avgPrice)}</div>
                    </div>
                    <div style="padding:6px;background:rgba(255,255,255,0.03);border-radius:2px">
                      <div style="font-size:8px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">YoY Growth</div>
                      <div style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:700;color:#10B981">+${f.appreciation}%</div>
                    </div>
                    <div style="padding:6px;background:rgba(255,255,255,0.03);border-radius:2px">
                      <div style="font-size:8px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Inventory</div>
                      <div style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:700;color:#94A3B8">${f.inventory}</div>
                    </div>
                  </div>
                  <div style="display:flex;gap:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.05)">
                    <div style="font-size:9px;color:#64748B"><span style="font-family:JetBrains Mono,monospace;color:#94A3B8;font-weight:600">${f.daysOnMarket}d</span> avg DOM</div>
                  </div>
                </div>
              `)
              .addTo(map);
          });

          map.on('mouseleave', 'zone-blob-core', () => {
            map.getCanvas().style.cursor = '';
            blobPopup.remove();
          });

          // ── LAYER: Radar scan rings ──
          map.addLayer({
            id: 'scan-rings',
            type: 'line',
            source: 'scan-rings',
            paint: {
              'line-color': '#06B6D4',
              'line-opacity': [
                'interpolate', ['linear'], ['zoom'],
                8, 0.15,
                13, 0.05,
                15, 0,
              ],
              'line-width': 0.8,
              'line-dasharray': [4, 6],
              'line-emissive-strength': 0.6,
            },
          });

          // ── LAYER: Connection lines — base ──
          map.addLayer({
            id: 'connection-lines-bg',
            type: 'line',
            source: 'connection-lines',
            paint: {
              'line-color': '#06B6D4',
              'line-opacity': [
                'interpolate', ['linear'], ['zoom'],
                8, 0.06,
                13, 0.02,
                15, 0,
              ],
              'line-width': 0.8,
              'line-emissive-strength': 0.4,
            },
          });

          // ── LAYER: Connection lines — animated dashes ──
          map.addLayer({
            id: 'connection-lines-dash',
            type: 'line',
            source: 'connection-lines',
            paint: {
              'line-color': '#06B6D4',
              'line-opacity': [
                'interpolate', ['linear'], ['zoom'],
                8, 0.25,
                13, 0.08,
                15, 0,
              ],
              'line-width': 1.2,
              'line-dasharray': [0, 4, 3],
              'line-emissive-strength': 1,
            },
          });

          // Animate the dashes
          const dashSeq = [
            [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
            [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
            [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5],
            [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
          ];
          let step = 0;
          function animateDash() {
            if (!mapRef.current) return;
            step = (step + 1) % dashSeq.length;
            map.setPaintProperty('connection-lines-dash', 'line-dasharray', dashSeq[step]);
            animFrameRef.current = requestAnimationFrame(animateDash);
          }
          animateDash();

          // ── LAYER: Heatmap — property price density ──
          map.addLayer({
            id: 'property-heatmap',
            type: 'heatmap',
            source: 'properties',
            maxzoom: 15,
            paint: {
              'heatmap-weight': ['get', 'weight'],
              'heatmap-intensity': [
                'interpolate', ['linear'], ['zoom'],
                8, 0.8,
                12, 1.8,
                15, 2.5,
              ],
              'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(0,0,0,0)',
                0.1, 'rgba(6,182,212,0.08)',
                0.25, 'rgba(6,182,212,0.2)',
                0.4, 'rgba(6,182,212,0.35)',
                0.55, 'rgba(16,185,129,0.35)',
                0.7, 'rgba(245,158,11,0.4)',
                0.85, 'rgba(239,68,68,0.4)',
                1, 'rgba(239,68,68,0.55)',
              ],
              'heatmap-radius': [
                'interpolate', ['linear'], ['zoom'],
                8, 35,
                11, 55,
                14, 75,
              ],
              'heatmap-opacity': [
                'interpolate', ['linear'], ['zoom'],
                10, 0.85,
                14, 0.35,
                16, 0,
              ],
            },
          });

          // ── LAYER: Glow circles (outer) — emissive ──
          map.addLayer({
            id: 'property-glow-outer',
            type: 'circle',
            source: 'properties',
            paint: {
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                8, 20,
                12, 30,
                16, 45,
              ],
              'circle-color': [
                'match', ['get', 'status'],
                'flagged', 'rgba(239,68,68,0.06)',
                'pending', 'rgba(245,158,11,0.06)',
                'rgba(6,182,212,0.06)',
              ],
              'circle-blur': 1,
              'circle-emissive-strength': 0.8,
            },
          });

          // ── LAYER: Glow circles (inner) — emissive ──
          map.addLayer({
            id: 'property-glow-inner',
            type: 'circle',
            source: 'properties',
            paint: {
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                8, 8,
                12, 14,
                16, 22,
              ],
              'circle-color': [
                'match', ['get', 'status'],
                'flagged', 'rgba(239,68,68,0.18)',
                'pending', 'rgba(245,158,11,0.18)',
                'rgba(6,182,212,0.18)',
              ],
              'circle-blur': 0.5,
              'circle-emissive-strength': 1,
            },
          });

          // ── DOM Markers ──
          PROPERTIES.forEach((property) => {
            const el = createMarkerElement(property);
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              onSelectRef.current(property);
              if (popupRef.current) popupRef.current.remove();
              popupRef.current = new mapboxgl.Popup({
                closeButton: true,
                closeOnClick: true,
                maxWidth: 'none',
                offset: 18,
              })
                .setLngLat(property.coordinates)
                .setHTML(createPopupHTML(property))
                .addTo(map);
            });
            markersRef.current.push(
              new mapboxgl.Marker({ element: el }).setLngLat(property.coordinates).addTo(map)
            );
          });

          setMapReady(true);
        });

        map.on('error', (e: any) => {
          console.error('Mapbox error:', e);
        });
      } catch (err) {
        console.error('Failed to load mapbox-gl:', err);
      }
    }

    loadMap();

    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to selected property
  useEffect(() => {
    if (selectedProperty && mapRef.current && mapReady && mapboxRef.current) {
      const mapboxgl = mapboxRef.current;
      mapRef.current.flyTo({
        center: selectedProperty.coordinates,
        zoom: 15.5,
        pitch: 60,
        bearing: -20,
        duration: 1800,
        essential: true,
      });
      if (popupRef.current) popupRef.current.remove();
      popupRef.current = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: 'none',
        offset: 18,
      })
        .setLngLat(selectedProperty.coordinates)
        .setHTML(createPopupHTML(selectedProperty))
        .addTo(mapRef.current);
    }
  }, [selectedProperty, mapReady]);

  return (
    <div className="flex-1 relative">
      <div ref={mapContainer} className="w-full h-full" />

      {/* HUD: Location */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none">
        <div className="glass px-3 py-2 rounded-sm hud-panel">
          <div className="flex items-center gap-1.5">
            <div className="hud-icon">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4m10-10h-4M6 12H2" />
              </svg>
            </div>
            <span className="text-[12px] font-semibold text-text-primary tracking-tight">United States</span>
            <div className="w-[5px] h-[5px] rounded-full status-live" style={{ background: 'var(--green)' }} />
          </div>
          <div className="font-mono text-[9px] text-text-tertiary mt-0.5">{NATIONAL_METROS.length + ZONES.length} metros &middot; {PROPERTIES.length} assets &middot; live</div>
        </div>
      </div>

      {/* HUD: Zone + Heatmap legend */}
      <div className="absolute top-14 right-12 z-10 pointer-events-none">
        <div className="glass px-3 py-2.5 rounded-sm hud-panel">
          <div className="text-[9px] font-semibold text-text-tertiary tracking-widest uppercase mb-2.5">Zone Intelligence</div>

          {/* Market heat scale */}
          <div className="mb-2.5">
            <div className="text-[8px] text-text-tertiary mb-1">Market Heat</div>
            <div className="zone-legend-bar mb-1" />
            <div className="flex justify-between">
              <span className="font-mono text-[7px] text-text-tertiary">Cool</span>
              <span className="font-mono text-[7px] text-text-tertiary">Hot</span>
            </div>
          </div>

          {/* Price density */}
          <div>
            <div className="text-[8px] text-text-tertiary mb-1">Price Density</div>
            <div className="heatmap-legend-bar mb-1" />
            <div className="flex justify-between">
              <span className="font-mono text-[7px] text-text-tertiary">Low</span>
              <span className="font-mono text-[7px] text-text-tertiary">High</span>
            </div>
          </div>
        </div>
      </div>

      {/* HUD: Status legend */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
        <div className="glass px-3 py-2 rounded-sm hud-panel">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)', boxShadow: '0 0 6px rgba(6,182,212,0.5)' }} />
              <span className="text-[9px] text-text-tertiary">Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--amber)', boxShadow: '0 0 6px rgba(245,158,11,0.5)' }} />
              <span className="text-[9px] text-text-tertiary">Pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--red)', boxShadow: '0 0 6px rgba(239,68,68,0.5)' }} />
              <span className="text-[9px] text-text-tertiary">Flagged</span>
            </div>
          </div>
        </div>
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(8,12,20,0.5) 100%)',
      }} />

      {/* Left edge fade */}
      <div className="absolute inset-y-0 left-0 w-12 pointer-events-none" style={{
        background: 'linear-gradient(to right, rgba(8,12,20,0.6), transparent)',
      }} />

      {/* Bottom edge fade */}
      <div className="absolute inset-x-0 bottom-0 h-12 pointer-events-none" style={{
        background: 'linear-gradient(to top, rgba(8,12,20,0.4), transparent)',
      }} />

      {/* CRT scanlines */}
      <div className="absolute inset-0 pointer-events-none scanlines" />
    </div>
  );
}
