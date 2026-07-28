import { supabase } from './supabase';

export type ProctoringLevel = 'none' | 'light' | 'standard' | 'enhanced';
export type ScreenshotMode = 'none' | 'manual' | 'periodic' | 'event';
export type ProctoringSeverity = 'info' | 'warning' | 'critical';
export type ProctoringDecision = 'compliant' | 'review' | 'non-compliant';
export type ProctoringReviewStatus = 'pending' | 'reviewed';

export type ProctoringEventType =
  | 'exam_started'
  | 'exam_finished'
  | 'tab_hidden'
  | 'focus_lost'
  | 'fullscreen_exited'
  | 'abnormal_resize'
  | 'page_reload'
  | 'network_offline'
  | 'network_online'
  | 'session_closed'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'context_menu_attempt'
  | 'blocked_shortcut'
  | 'camera_disabled'
  | 'microphone_disabled'
  | 'screen_share_stopped'
  | 'multiple_screens'
  | 'capture_created'
  | 'camera_obstructed'
  | 'unusual_audio'
  | 'seb_verified'
  | 'seb_verification_failed';

export interface ProctoringConfig {
  enabled: boolean;
  level: ProctoringLevel;
  sebRequired: boolean;
  sebMinVersion: string;
  sebKeyConfigured: boolean;
  allowedUrls: string[];
  blockedUrls: string[];
  webcamRequired: boolean;
  microphoneRequired: boolean;
  audioRecording: boolean;
  screenshotMode: ScreenshotMode;
  screenshotIntervalSeconds: number;
  aiAnalysis: boolean;
  detectNoFace: boolean;
  detectMultipleFaces: boolean;
  detectGazeAway: boolean;
  detectCameraObstruction: boolean;
  detectUnusualAudio: boolean;
  maxTabSwitches: number;
  maxFullscreenExits: number;
  maxOutOfFocusSeconds: number;
  violationMessage: string;
  autoSubmitAfterViolations: number | null;
  retentionDays: number;
  consentRequired: boolean;
}

export const DEFAULT_PROCTORING_CONFIG: ProctoringConfig = {
  enabled: false,
  level: 'none',
  sebRequired: false,
  sebMinVersion: '3.3.2',
  sebKeyConfigured: false,
  allowedUrls: [],
  blockedUrls: [],
  webcamRequired: false,
  microphoneRequired: false,
  audioRecording: false,
  screenshotMode: 'none',
  screenshotIntervalSeconds: 120,
  aiAnalysis: false,
  detectNoFace: false,
  detectMultipleFaces: false,
  detectGazeAway: false,
  detectCameraObstruction: false,
  detectUnusualAudio: false,
  maxTabSwitches: 3,
  maxFullscreenExits: 2,
  maxOutOfFocusSeconds: 30,
  violationMessage: "Veuillez rester sur la page de l'examen.",
  autoSubmitAfterViolations: null,
  retentionDays: 90,
  consentRequired: true,
};

export const PROCTORING_LEVEL_PRESETS: Record<ProctoringLevel, Partial<ProctoringConfig>> = {
  none: {
    enabled: false,
    level: 'none',
    sebRequired: false,
    webcamRequired: false,
    microphoneRequired: false,
    screenshotMode: 'none',
    aiAnalysis: false,
  },
  light: {
    enabled: true,
    level: 'light',
    sebRequired: false,
    webcamRequired: false,
    microphoneRequired: false,
    screenshotMode: 'none',
    aiAnalysis: false,
  },
  standard: {
    enabled: true,
    level: 'standard',
    sebRequired: false,
    webcamRequired: false,
    microphoneRequired: false,
    screenshotMode: 'event',
    aiAnalysis: false,
  },
  enhanced: {
    enabled: true,
    level: 'enhanced',
    sebRequired: true,
    webcamRequired: true,
    microphoneRequired: true,
    screenshotMode: 'periodic',
    aiAnalysis: true,
    detectNoFace: true,
    detectMultipleFaces: true,
    detectGazeAway: true,
    detectCameraObstruction: true,
    detectUnusualAudio: true,
  },
};

export function normalizeProctoringConfig(value?: Partial<ProctoringConfig> | null): ProctoringConfig {
  const config = { ...DEFAULT_PROCTORING_CONFIG, ...(value ?? {}) };
  if (!config.enabled || config.level === 'none') {
    return { ...config, ...PROCTORING_LEVEL_PRESETS.none };
  }
  return config;
}

export function applyProctoringLevel(
  current: ProctoringConfig,
  level: ProctoringLevel,
): ProctoringConfig {
  return normalizeProctoringConfig({ ...current, ...PROCTORING_LEVEL_PRESETS[level], level });
}

export interface ProctoringEvent {
  id: string;
  examId: string;
  attemptId: string;
  participantId: string;
  type: ProctoringEventType;
  severity: ProctoringSeverity;
  occurredAt: string;
  durationMs: number | null;
  occurrence: number;
  details: Record<string, unknown>;
}

export interface ProctoringAlert {
  id: string;
  examId: string;
  attemptId: string;
  type: string;
  severity: ProctoringSeverity;
  title: string;
  details: string;
  occurredAt: string;
  reviewStatus: ProctoringReviewStatus;
}

export interface ProctoringCapture {
  id: string;
  examId: string;
  attemptId: string;
  source: 'webcam' | 'screen';
  trigger: 'manual' | 'periodic' | 'event';
  occurredAt: string;
  storagePath: string;
  signedUrl?: string;
}

export interface ProctoringReport {
  id: string;
  examId: string;
  attemptId: string;
  decision: ProctoringDecision;
  teacherDecision: ProctoringDecision | null;
  teacherNote: string;
  validationStatus: ProctoringReviewStatus;
  eventCount: number;
  alertCount: number;
  captureCount: number;
  tabSwitchCount: number;
  fullscreenExitCount: number;
  focusLostSeconds: number;
  generatedAt: string;
  validatedAt: string | null;
}

export interface ProctoringAttemptOverview {
  attemptId: string;
  participantName: string;
  events: ProctoringEvent[];
  alerts: ProctoringAlert[];
  captures: ProctoringCapture[];
  report: ProctoringReport | null;
}

interface SafeExamBrowserApi {
  version?: string;
  security?: {
    browserExamKey?: string;
    configKey?: string;
    updateKeys?: (callback: () => void) => void;
  };
}

declare global {
  interface Window {
    SafeExamBrowser?: SafeExamBrowserApi;
    getScreenDetails?: () => Promise<{ screens: unknown[] }>;
  }
}

export interface SebEnvironment {
  detected: boolean;
  version: string | null;
  browserExamKey: string | null;
  configKey: string | null;
}

function readSebValues(): SebEnvironment {
  const api = window.SafeExamBrowser;
  return {
    detected: Boolean(api?.version || api?.security),
    version: api?.version ?? null,
    browserExamKey: api?.security?.browserExamKey ?? null,
    configKey: api?.security?.configKey ?? null,
  };
}

export async function readSebEnvironment(): Promise<SebEnvironment> {
  const api = window.SafeExamBrowser;
  if (!api?.security?.updateKeys) return readSebValues();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(readSebValues());
    };
    try {
      api.security?.updateKeys?.(finish);
      window.setTimeout(finish, 2500);
    } catch {
      finish();
    }
  });
}

export async function verifyProctoringEnvironment(
  examId: string,
  participantId: string,
  environment: SebEnvironment,
): Promise<{ valid: boolean; reason?: string }> {
  const { data, error } = await supabase.functions.invoke('proctoring-api', {
    body: {
      action: 'verify-environment',
      examId,
      participantId,
      pageUrl: window.location.href.split('#')[0],
      environment,
    },
  });
  if (error) return { valid: false, reason: 'verification_unavailable' };
  return data as { valid: boolean; reason?: string };
}

export async function recordProctoringEvent(input: {
  examId: string;
  attemptId: string;
  participantId: string;
  type: ProctoringEventType;
  severity?: ProctoringSeverity;
  durationMs?: number;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('proctoring-api', {
    body: { action: 'record-event', ...input },
  });
  if (error) console.error('[proctoring] event persistence failed', error);
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(blob);
  });
}

export async function uploadProctoringCapture(input: {
  examId: string;
  attemptId: string;
  participantId: string;
  source: 'webcam' | 'screen';
  trigger: 'manual' | 'periodic' | 'event';
  blob: Blob;
  analysis?: Record<string, unknown>;
}): Promise<void> {
  const base64 = await blobToBase64(input.blob);
  const { error } = await supabase.functions.invoke('proctoring-api', {
    body: {
      action: 'upload-capture',
      examId: input.examId,
      attemptId: input.attemptId,
      participantId: input.participantId,
      source: input.source,
      trigger: input.trigger,
      contentType: input.blob.type || 'image/jpeg',
      base64,
      analysis: input.analysis ?? {},
    },
  });
  if (error) console.error('[proctoring] capture persistence failed', error);
}

export async function getProctoringOverview(examId: string): Promise<ProctoringAttemptOverview[]> {
  const { data, error } = await supabase.functions.invoke('proctoring-api', {
    body: { action: 'get-overview', examId },
  });
  if (error) throw error;
  return ((data as { attempts?: ProctoringAttemptOverview[] })?.attempts ?? []);
}

export async function reviewProctoringReport(input: {
  examId: string;
  attemptId: string;
  decision: ProctoringDecision;
  note: string;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('proctoring-api', {
    body: { action: 'review-report', ...input },
  });
  if (error) throw error;
}
