export interface Property {
  id: string;
  address: string;
  city: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  status: 'active' | 'pending' | 'flagged';
  coordinates: [number, number];
  yearBuilt: number;
  type: string;
  image: string;
  roi: number;
  riskScore: number;
  zestimate: number;
  daysOnMarket: number;
}

const IMAGES = [
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600566753376-12c8ab7a3de6?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1599809275671-b5942cabc7a2?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1602343168117-bb8ffe3e2e9f?w=600&h=400&fit=crop&q=80',
];

export const PROPERTIES: Property[] = [
  // ── Irvine ──
  { id:'EST-001', address:'15 Avendale', city:'Irvine', price:1285000, beds:4, baths:3, sqft:2450, status:'active', coordinates:[-117.7861,33.6694], yearBuilt:2019, type:'Single Family', image:IMAGES[0], roi:12.4, riskScore:23, zestimate:1310000, daysOnMarket:14 },
  { id:'EST-002', address:'47 Waterleaf', city:'Irvine', price:958000, beds:3, baths:2, sqft:1890, status:'active', coordinates:[-117.8107,33.6490], yearBuilt:2015, type:'Townhome', image:IMAGES[1], roi:8.7, riskScore:31, zestimate:975000, daysOnMarket:22 },
  { id:'EST-005', address:'12 Sunstone', city:'Irvine', price:2150000, beds:6, baths:5, sqft:4100, status:'flagged', coordinates:[-117.7928,33.7125], yearBuilt:2023, type:'Single Family', image:IMAGES[4], roi:4.3, riskScore:72, zestimate:2080000, daysOnMarket:56 },
  { id:'EST-006', address:'331 Jade Tree', city:'Irvine', price:892000, beds:3, baths:2, sqft:1750, status:'active', coordinates:[-117.7693,33.6839], yearBuilt:2017, type:'Townhome', image:IMAGES[5], roi:9.8, riskScore:27, zestimate:915000, daysOnMarket:11 },
  { id:'EST-007', address:'55 Palazzo', city:'Irvine', price:1750000, beds:4, baths:3, sqft:2850, status:'active', coordinates:[-117.8456,33.6389], yearBuilt:2020, type:'Single Family', image:IMAGES[6], roi:11.2, riskScore:19, zestimate:1785000, daysOnMarket:5 },
  { id:'EST-008', address:'142 Edgewood', city:'Irvine', price:1050000, beds:3, baths:3, sqft:2100, status:'pending', coordinates:[-117.7750,33.6950], yearBuilt:2018, type:'Townhome', image:IMAGES[7], roi:7.5, riskScore:35, zestimate:1070000, daysOnMarket:29 },
  { id:'EST-009', address:'80 Cantera', city:'Irvine', price:1420000, beds:4, baths:3, sqft:2680, status:'active', coordinates:[-117.7580,33.6780], yearBuilt:2021, type:'Single Family', image:IMAGES[8], roi:10.1, riskScore:20, zestimate:1455000, daysOnMarket:9 },
  { id:'EST-010', address:'225 Briarwood', city:'Irvine', price:1180000, beds:3, baths:3, sqft:2200, status:'active', coordinates:[-117.8220,33.6620], yearBuilt:2016, type:'Single Family', image:IMAGES[9], roi:8.3, riskScore:28, zestimate:1210000, daysOnMarket:18 },
  { id:'EST-017', address:'9 Silverleaf', city:'Irvine', price:1620000, beds:5, baths:4, sqft:3100, status:'active', coordinates:[-117.7720,33.7050], yearBuilt:2022, type:'Single Family', image:IMAGES[12], roi:13.5, riskScore:15, zestimate:1680000, daysOnMarket:4 },
  { id:'EST-022', address:'310 Heritage', city:'Irvine', price:785000, beds:2, baths:2, sqft:1380, status:'active', coordinates:[-117.8350,33.6560], yearBuilt:2014, type:'Condo', image:IMAGES[14], roi:6.1, riskScore:33, zestimate:810000, daysOnMarket:25 },

  // ── Tustin ──
  { id:'EST-003', address:'203 Retreat Dr', city:'Tustin', price:782000, beds:2, baths:2, sqft:1420, status:'pending', coordinates:[-117.8259,33.7066], yearBuilt:2012, type:'Condo', image:IMAGES[2], roi:6.2, riskScore:45, zestimate:798000, daysOnMarket:38 },
  { id:'EST-011', address:'18 Tustin Ranch', city:'Tustin', price:920000, beds:3, baths:2, sqft:1950, status:'active', coordinates:[-117.7950,33.7200], yearBuilt:2010, type:'Townhome', image:IMAGES[10], roi:7.9, riskScore:30, zestimate:945000, daysOnMarket:16 },

  // ── Lake Forest ──
  { id:'EST-004', address:'88 Canopy Ln', city:'Lake Forest', price:1520000, beds:5, baths:4, sqft:3200, status:'active', coordinates:[-117.6893,33.6469], yearBuilt:2021, type:'Single Family', image:IMAGES[3], roi:15.1, riskScore:18, zestimate:1560000, daysOnMarket:7 },
  { id:'EST-012', address:'44 Ridgeline', city:'Lake Forest', price:1350000, beds:4, baths:3, sqft:2750, status:'active', coordinates:[-117.6780,33.6580], yearBuilt:2019, type:'Single Family', image:IMAGES[11], roi:11.8, riskScore:21, zestimate:1390000, daysOnMarket:12 },
  { id:'EST-018', address:'72 Timberline', city:'Lake Forest', price:1150000, beds:4, baths:3, sqft:2400, status:'pending', coordinates:[-117.6950,33.6350], yearBuilt:2017, type:'Single Family', image:IMAGES[13], roi:9.2, riskScore:26, zestimate:1180000, daysOnMarket:20 },

  // ── Newport Beach ──
  { id:'EST-013', address:'1200 Coast Hwy', city:'Newport Beach', price:3450000, beds:5, baths:5, sqft:4800, status:'active', coordinates:[-117.8780,33.6170], yearBuilt:2022, type:'Single Family', image:IMAGES[12], roi:6.8, riskScore:40, zestimate:3380000, daysOnMarket:42 },
  { id:'EST-014', address:'330 Bayside Dr', city:'Newport Beach', price:2800000, beds:4, baths:4, sqft:3600, status:'active', coordinates:[-117.9050,33.6080], yearBuilt:2020, type:'Single Family', image:IMAGES[13], roi:8.1, riskScore:35, zestimate:2870000, daysOnMarket:19 },
  { id:'EST-023', address:'58 Harbor Is', city:'Newport Beach', price:4200000, beds:5, baths:6, sqft:5200, status:'flagged', coordinates:[-117.8900,33.6030], yearBuilt:2021, type:'Single Family', image:IMAGES[0], roi:3.2, riskScore:68, zestimate:3950000, daysOnMarket:71 },

  // ── Costa Mesa ──
  { id:'EST-015', address:'915 Baker St', city:'Costa Mesa', price:1080000, beds:3, baths:2, sqft:1800, status:'active', coordinates:[-117.9130,33.6450], yearBuilt:2016, type:'Single Family', image:IMAGES[14], roi:9.4, riskScore:25, zestimate:1120000, daysOnMarket:8 },
  { id:'EST-024', address:'2240 Placentia', city:'Costa Mesa', price:875000, beds:3, baths:2, sqft:1650, status:'active', coordinates:[-117.9250,33.6550], yearBuilt:2013, type:'Townhome', image:IMAGES[9], roi:7.6, riskScore:29, zestimate:905000, daysOnMarket:15 },

  // ── Mission Viejo ──
  { id:'EST-016', address:'27 La Paz', city:'Mission Viejo', price:980000, beds:4, baths:3, sqft:2300, status:'active', coordinates:[-117.6600,33.6000], yearBuilt:2008, type:'Single Family', image:IMAGES[15], roi:7.2, riskScore:32, zestimate:1010000, daysOnMarket:27 },
  { id:'EST-019', address:'150 Marguerite', city:'Mission Viejo', price:1100000, beds:4, baths:3, sqft:2500, status:'active', coordinates:[-117.6480,33.6120], yearBuilt:2015, type:'Single Family', image:IMAGES[8], roi:8.5, riskScore:24, zestimate:1140000, daysOnMarket:13 },

  // ── Laguna Niguel / Laguna Beach ──
  { id:'EST-020', address:'8 Monarch Bay', city:'Laguna Niguel', price:1850000, beds:5, baths:4, sqft:3400, status:'active', coordinates:[-117.7100,33.5350], yearBuilt:2019, type:'Single Family', image:IMAGES[6], roi:10.9, riskScore:22, zestimate:1920000, daysOnMarket:6 },
  { id:'EST-021', address:'320 Cliff Dr', city:'Laguna Beach', price:5100000, beds:4, baths:4, sqft:3800, status:'pending', coordinates:[-117.7830,33.5420], yearBuilt:2021, type:'Single Family', image:IMAGES[4], roi:5.4, riskScore:55, zestimate:4900000, daysOnMarket:48 },

  // ── Aliso Viejo / San Juan Cap ──
  { id:'EST-025', address:'42 Pacific Park', city:'Aliso Viejo', price:820000, beds:3, baths:2, sqft:1580, status:'active', coordinates:[-117.7260,33.5750], yearBuilt:2011, type:'Townhome', image:IMAGES[1], roi:8.0, riskScore:28, zestimate:850000, daysOnMarket:17 },
  { id:'EST-026', address:'115 Paseo Real', city:'San Juan Cap.', price:1680000, beds:5, baths:4, sqft:3300, status:'active', coordinates:[-117.6620,33.5010], yearBuilt:2018, type:'Single Family', image:IMAGES[3], roi:12.0, riskScore:19, zestimate:1730000, daysOnMarket:10 },

  // ── Anaheim / Fullerton / Orange ──
  { id:'EST-027', address:'520 Katella Ave', city:'Anaheim', price:680000, beds:3, baths:2, sqft:1500, status:'active', coordinates:[-117.9140,33.8030], yearBuilt:2005, type:'Townhome', image:IMAGES[10], roi:7.1, riskScore:34, zestimate:705000, daysOnMarket:21 },
  { id:'EST-028', address:'1330 Harbor Bl', city:'Anaheim', price:590000, beds:2, baths:2, sqft:1250, status:'pending', coordinates:[-117.9260,33.8150], yearBuilt:2001, type:'Condo', image:IMAGES[15], roi:5.8, riskScore:42, zestimate:610000, daysOnMarket:35 },
  { id:'EST-029', address:'805 Valencia Dr', city:'Fullerton', price:920000, beds:4, baths:2, sqft:2100, status:'active', coordinates:[-117.9300,33.8700], yearBuilt:2009, type:'Single Family', image:IMAGES[2], roi:8.9, riskScore:26, zestimate:955000, daysOnMarket:14 },
  { id:'EST-030', address:'240 Tustin Ave', city:'Orange', price:750000, beds:3, baths:2, sqft:1650, status:'active', coordinates:[-117.8530,33.7870], yearBuilt:2007, type:'Single Family', image:IMAGES[5], roi:7.4, riskScore:31, zestimate:775000, daysOnMarket:19 },

  // ── Huntington Beach / Fountain Valley ──
  { id:'EST-031', address:'610 Pacific Coast', city:'Huntington Bch', price:1950000, beds:4, baths:3, sqft:2600, status:'active', coordinates:[-117.9990,33.6600], yearBuilt:2020, type:'Single Family', image:IMAGES[7], roi:9.6, riskScore:30, zestimate:2010000, daysOnMarket:11 },
  { id:'EST-032', address:'18200 Brookhurst', city:'Fountain Vly', price:820000, beds:3, baths:2, sqft:1700, status:'active', coordinates:[-117.9560,33.7100], yearBuilt:2012, type:'Townhome', image:IMAGES[11], roi:7.8, riskScore:27, zestimate:850000, daysOnMarket:16 },
];

export function formatPrice(price: number): string {
  if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`;
  return `$${(price / 1000).toFixed(0)}K`;
}

export function getStatusColor(status: Property['status']): string {
  switch (status) {
    case 'active': return '#059669';
    case 'pending': return '#D97706';
    case 'flagged': return '#DC2626';
  }
}

export function getStatusLabel(status: Property['status']): string {
  switch (status) {
    case 'active': return 'Active';
    case 'pending': return 'Pending';
    case 'flagged': return 'Review';
  }
}

export function getRiskLabel(score: number): { label: string; color: string } {
  if (score <= 25) return { label: 'Low', color: '#059669' };
  if (score <= 50) return { label: 'Medium', color: '#D97706' };
  return { label: 'High', color: '#DC2626' };
}
