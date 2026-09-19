import React from 'react';
import {
  Building2,
  Factory,
  Landmark,
  Anchor,
  Store,
} from 'lucide-react';

export type SidebarTab = 'score' | 'compare' | 'catchment' | 'layers';

export interface BenchmarkSite {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  score?: number;
}

export interface LayerItem {
  id: string;
  name: string;
  source: string;
  vintage: string;
  visible: boolean;
  opacity: number;
}

export const GUJARAT_BENCHMARKS: BenchmarkSite[] = [
  {
    id: 'bench-sg-highway',
    name: 'SG Highway Commercial Corridor',
    category: 'Commercial / Retail',
    lat: 23.0378,
    lng: 72.5112,
    icon: Building2,
    description: 'Ahmedabad arterial growth axis with premier retail density and corporate offices.',
    score: 88,
  },
  {
    id: 'bench-sanand-gidc',
    name: 'Sanand GIDC Industrial Estate',
    category: 'Industrial / Auto',
    lat: 22.9868,
    lng: 72.3814,
    icon: Factory,
    description: 'Mega automotive manufacturing hub with heavy freight accessibility.',
    score: 74,
  },
  {
    id: 'bench-gift-city',
    name: 'GIFT City FinTech Zone',
    category: 'FinTech / Smart City',
    lat: 23.1601,
    lng: 72.6841,
    icon: Landmark,
    description: "India's premier international financial services and high-density tech corridor.",
    score: 92,
  },
  {
    id: 'bench-mundra-sez',
    name: 'Mundra Port SEZ Logistics',
    category: 'Maritime / Logistics',
    lat: 22.8394,
    lng: 69.7214,
    icon: Anchor,
    description: 'Deep-water port terminal and multi-modal container freight logistics center.',
    score: 68,
  },
  {
    id: 'bench-alkapuri',
    name: 'Alkapuri Central Hub, Vadodara',
    category: 'Urban Commercial',
    lat: 22.3106,
    lng: 73.1812,
    icon: Store,
    description: 'High-income urban consumer catchment with dense commercial and civic amenities.',
    score: 82,
  },
];
