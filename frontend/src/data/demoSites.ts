/**
 * Benchmark Demo Site Portfolio for Hackathon Demonstration Walkthrough
 * Curated locations across Gujarat showcasing diverse urban, industrial, and coastal profiles.
 */

export interface BenchmarkSite {
  id: string;
  name: string;
  shortName: string;
  siteType: 'EV charging' | 'Retail' | 'Warehouse';
  coordinates: {
    lat: number;
    lng: number;
  };
  district: string;
  recommendedMinutes: number;
  recommendedMode: 'driving' | 'walking' | 'cycling';
  description: string;
  badge: string;
  badgeColor: 'emerald' | 'blue' | 'amber' | 'purple';
  keyHighlights: string[];
}

export const BENCHMARK_SITES: BenchmarkSite[] = [
  {
    id: 'sg-highway-ahmedabad',
    name: 'SG Highway Commercial Hub',
    shortName: 'SG Highway',
    siteType: 'EV charging',
    coordinates: {
      lat: 23.0378,
      lng: 72.5112,
    },
    district: 'Ahmedabad Metro',
    recommendedMinutes: 15,
    recommendedMode: 'driving',
    description: 'Premier arterial expressway corridor linking Ahmedabad and Gandhinagar, characterized by dense retail anchors, corporate towers, and high-income commuter demographics.',
    badge: 'Grade A Prime Candidate',
    badgeColor: 'emerald',
    keyHighlights: [
      'Direct frontage on 6-lane SG Highway arterial corridor',
      'Over 1.7M residents within 15-minute vehicle catchment',
      'Zero recorded flood plain overlap',
      'Top-tier EV fast-charging grid readiness',
    ],
  },
  {
    id: 'gift-city-gandhinagar',
    name: 'GIFT City International Fintech Zone',
    shortName: 'GIFT City',
    siteType: 'EV charging',
    coordinates: {
      lat: 23.1600,
      lng: 72.6840,
    },
    district: 'Gandhinagar Capital Region',
    recommendedMinutes: 10,
    recommendedMode: 'driving',
    description: "India's flagship International Financial Services Centre (IFSC) smart city with dedicated utility tunnels, 24/7 uninterrupted power grid, and high corporate EV fleet density.",
    badge: 'Smart City Benchmark',
    badgeColor: 'blue',
    keyHighlights: [
      'State-of-the-art dual-redundant power substation',
      'Planned walkability & cycling arterial network',
      'Concentrated high-density international corporate workforce',
      'Strict zoning with commercial C-2 classification',
    ],
  },
  {
    id: 'sanand-gidc-automotive',
    name: 'Sanand GIDC Mega Automotive Corridor',
    shortName: 'Sanand GIDC',
    siteType: 'Warehouse',
    coordinates: {
      lat: 22.9868,
      lng: 72.3812,
    },
    district: 'Ahmedabad Rural',
    recommendedMinutes: 20,
    recommendedMode: 'driving',
    description: 'Western India automotive manufacturing capital housing major auto OEMs, tier-1 suppliers, heavy commercial transport routes, and multi-modal freight parks.',
    badge: 'Industrial Fleet Depot',
    badgeColor: 'amber',
    keyHighlights: [
      'Direct freight access to State Highway 17 & Western DFC',
      'Heavy industrial zoning approved for large logistics footprint',
      'Ideal for heavy commercial fleet electrification depot',
      'Low land acquisition friction with GIDC boundary clearance',
    ],
  },
  {
    id: 'mundra-port-logistics',
    name: 'Mundra Port & SEZ Logistics Hub',
    shortName: 'Mundra Port',
    siteType: 'Warehouse',
    coordinates: {
      lat: 22.8390,
      lng: 69.7210,
    },
    district: 'Kutch Coastal District',
    recommendedMinutes: 30,
    recommendedMode: 'driving',
    description: 'Deep-draft commercial maritime port and Special Economic Zone handling containerized cargo, bulk commodities, and extensive hinterland rail-road logistics.',
    badge: 'Maritime Logistics Hub',
    badgeColor: 'purple',
    keyHighlights: [
      'Largest commercial private port terminal in India',
      'Expansive regional catchment covering Kutch freight basin',
      'Evaluates coastal hazard setback & flood resilience buffers',
      'Critical freight decarbonization target corridor',
    ],
  },
];
