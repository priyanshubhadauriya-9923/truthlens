// ─── Core Types ───────────────────────────────────────────────

export type MediaType = 'image' | 'video' | 'audio';

export type RiskLevel = 'authentic' | 'suspicious' | 'deepfake';

export type PerformanceMode = 'balanced' | 'fast' | 'high-accuracy';

export type ScanSource = 'local' | 'cloud' | 'hybrid';

export interface MediaItem {
  id: string;
  type: MediaType;
  src: string;
  element?: HTMLElement;
  width?: number;
  height?: number;
  isVisible: boolean;
  hash?: string;
}

export interface ScanResult {
  mediaId: string;
  mediaSrc: string;
  mediaType: MediaType;
  confidence: number;
  riskLevel: RiskLevel;
  scanSource: ScanSource;
  scanDuration: number;
  modelUsed: string;
  reasons: string[];
  timestamp: number;
  pageUrl: string;
  domain: string;
  thumbnailDataUrl?: string;
}

export interface QueueItem {
  media: MediaItem;
  priority: number; // lower = higher priority
  addedAt: number;
  isManual: boolean;
}

export interface PageStatus {
  totalMedia: number;
  scannedCount: number;
  suspiciousCount: number;
  deepfakeCount: number;
  authenticCount: number;
  isScanning: boolean;
  isPaused: boolean;
  isOffline: boolean;
  currentlyScanning: string | null;
  queueLength: number;
  averageScanSpeed: number;
}

export interface DetectionEntry {
  id: string;
  result: ScanResult;
  screenshotUrl?: string;
  createdAt: number;
  expiresAt: number;
}

export interface DomainReputation {
  domain: string;
  totalScans: number;
  suspiciousCount: number;
  deepfakeCount: number;
  riskScore: number;
  lastScan: number;
}

export interface AnalyticsSummary {
  totalScans: number;
  suspiciousDetections: number;
  deepfakeDetections: number;
  mostFlaggedDomains: DomainReputation[];
  scanTrends: { date: string; scans: number; flagged: number }[];
}

export interface Settings {
  performanceMode: PerformanceMode;
  autoScan: boolean;
  localOnlyMode: boolean;
  disableCloudAnalysis: boolean;
  showBadges: boolean;
  developerMode: boolean;
  scanImages: boolean;
  scanVideos: boolean;
  scanAudio: boolean;
}

// ─── Message Types (Content <-> Service Worker) ───────────────

export type MessageType =
  | 'SCAN_MEDIA'
  | 'SCAN_RESULT'
  | 'GET_PAGE_STATUS'
  | 'PAGE_STATUS'
  | 'PAUSE_SCANNING'
  | 'RESUME_SCANNING'
  | 'CLEAR_CACHE'
  | 'SCAN_PAGE'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'GET_HISTORY'
  | 'CLEAR_HISTORY'
  | 'GET_ANALYTICS'
  | 'MANUAL_SCAN'
  | 'FETCH_API';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
  tabId?: number;
}

// ─── Badge Colors ─────────────────────────────────────────────

export const BADGE_COLORS: Record<RiskLevel, string> = {
  authentic: '#22c55e',
  suspicious: '#f59e0b',
  deepfake: '#ef4444',
};

export const BADGE_LABELS: Record<RiskLevel, string> = {
  authentic: 'Authentic',
  suspicious: 'Suspicious',
  deepfake: 'Deepfake Risk',
};

// ─── Constants ────────────────────────────────────────────────

export const MONTHLY_CLEANUP_ALARM = 'truthlens-monthly-cleanup';
export const SCAN_DEBOUNCE_MS = 300;
export const MAX_QUEUE_SIZE = 100;
export const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
export const MONTHLY_TTL_MS = 1000 * 60 * 60 * 24 * 30; // ~30 days
export const API_BASE_URL = 'http://localhost:8000/api/v1';
