import { useCallback, useEffect, useRef, useState } from 'react';
import type { Exam, Attempt } from '@/lib/examStorage';
import type { Participant } from '@/lib/examParticipant';
import {
  recordProctoringEvent,
  uploadProctoringCapture,
  type ProctoringEventType,
  type ProctoringSeverity,
} from '@/lib/proctoring';
import type { ProctoringStreams } from './ProctoringPreflight';
import { AlertTriangle, Camera, MonitorUp, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  exam: Exam;
  attempt: Attempt;
  participant: Participant;
  streams: ProctoringStreams;
  onAutoSubmit: () => void;
}

type EmitEvent = (
  type: ProctoringEventType,
  severity?: ProctoringSeverity,
  details?: Record<string, unknown>,
  violation?: boolean,
  durationMs?: number,
) => Promise<void>;

export function ProctoringMonitor({ exam, attempt, participant, streams, onAutoSubmit }: Props) {
  const config = exam.proctoring;
  const [violations, setViolations] = useState(0);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const occurrenceRef = useRef<Record<string, number>>({});
  const lostFocusAt = useRef<number | null>(null);
  const hiddenAt = useRef<number | null>(null);
  const lastSize = useRef({ width: window.outerWidth, height: window.outerHeight });
  const captureBusy = useRef(false);
  const started = useRef(false);
  const emitRef = useRef<EmitEvent>(async () => undefined);

  const capture = useCallback(async (trigger: 'manual' | 'periodic' | 'event') => {
    if (captureBusy.current) return;
    const stream = streams.screen ?? streams.camera;
    if (!stream?.getVideoTracks().length) return;
    captureBusy.current = true;
    try {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      if (!video.videoWidth || !video.videoHeight) return;
      const canvas = document.createElement('canvas');
      const maxWidth = 1280;
      const ratio = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * ratio);
      canvas.height = Math.round(video.videoHeight * ratio);
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      let averageLuminance = 100;
      if (config.aiAnalysis && config.detectCameraObstruction && streams.camera && !streams.screen) {
        const pixels = context.getImageData(0, 0, Math.min(canvas.width, 240), Math.min(canvas.height, 160)).data;
        let total = 0;
        let count = 0;
        for (let index = 0; index < pixels.length; index += 40) {
          total += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
          count += 1;
        }
        averageLuminance = count ? total / count : 100;
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', .72));
      if (!blob) return;
      await uploadProctoringCapture({
        examId: exam.id,
        attemptId: attempt.id,
        participantId: participant.id,
        source: streams.screen ? 'screen' : 'webcam',
        trigger,
        blob,
        analysis: { averageLuminance: Math.round(averageLuminance) },
      });
      if (averageLuminance < 15) {
        await emitRef.current('camera_obstructed', 'warning', { averageLuminance: Math.round(averageLuminance) }, true);
      }
    } finally {
      captureBusy.current = false;
    }
  }, [attempt.id, config.aiAnalysis, config.detectCameraObstruction, exam.id, participant.id, streams.camera, streams.screen]);

  const emit = useCallback(async (
    type: ProctoringEventType,
    severity: ProctoringSeverity = 'info',
    details: Record<string, unknown> = {},
    violation = false,
    durationMs?: number,
  ) => {
    occurrenceRef.current[type] = (occurrenceRef.current[type] ?? 0) + 1;
    await recordProctoringEvent({
      examId: exam.id,
      attemptId: attempt.id,
      participantId: participant.id,
      type,
      severity,
      durationMs,
      details: { ...details, occurrence: occurrenceRef.current[type] },
    });
    if (violation) {
      setViolations((current) => {
        const next = current + 1;
        if (config.violationMessage) toast.warning(config.violationMessage, { duration: 6000 });
        if (config.autoSubmitAfterViolations && next >= config.autoSubmitAfterViolations) {
          window.setTimeout(onAutoSubmit, 0);
        }
        return next;
      });
      if (config.screenshotMode === 'event') void capture('event');
    }
  }, [attempt.id, capture, config.autoSubmitAfterViolations, config.screenshotMode, config.violationMessage, exam.id, onAutoSubmit, participant.id]);
  emitRef.current = emit;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void emit('exam_started', 'info', { level: config.level });
  }, [config.level, emit]);

  useEffect(() => {
    if (config.screenshotMode !== 'periodic') return;
    const interval = window.setInterval(() => void capture('periodic'), Math.max(30, config.screenshotIntervalSeconds) * 1000);
    void capture('periodic');
    return () => window.clearInterval(interval);
  }, [capture, config.screenshotIntervalSeconds, config.screenshotMode]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current) {
        const durationMs = Date.now() - hiddenAt.current;
        hiddenAt.current = null;
        const occurrence = (occurrenceRef.current.tab_hidden ?? 0) + 1;
        void emit('tab_hidden', occurrence > config.maxTabSwitches ? 'critical' : 'warning', {}, true, durationMs);
      }
    };
    const onBlur = () => { lostFocusAt.current = Date.now(); };
    const onFocus = () => {
      if (!lostFocusAt.current) return;
      const durationMs = Date.now() - lostFocusAt.current;
      lostFocusAt.current = null;
      void emit(
        'focus_lost',
        durationMs > config.maxOutOfFocusSeconds * 1000 ? 'critical' : 'warning',
        {},
        durationMs > config.maxOutOfFocusSeconds * 1000,
        durationMs,
      );
    };
    const onFullscreen = () => {
      const exited = !document.fullscreenElement;
      setFullscreenWarning(exited);
      if (exited) {
        const occurrence = (occurrenceRef.current.fullscreen_exited ?? 0) + 1;
        void emit('fullscreen_exited', occurrence > config.maxFullscreenExits ? 'critical' : 'warning', {}, true);
      }
    };
    const onResize = () => {
      const widthRatio = Math.abs(window.outerWidth - lastSize.current.width) / Math.max(lastSize.current.width, 1);
      const heightRatio = Math.abs(window.outerHeight - lastSize.current.height) / Math.max(lastSize.current.height, 1);
      lastSize.current = { width: window.outerWidth, height: window.outerHeight };
      if (Math.max(widthRatio, heightRatio) > .3) void emit('abnormal_resize', 'warning', { width: window.outerWidth, height: window.outerHeight }, true);
    };
    const onOffline = () => void emit('network_offline', 'warning');
    const onOnline = () => void emit('network_online', 'info');
    const onBeforeUnload = () => {
      void recordProctoringEvent({
        examId: exam.id,
        attemptId: attempt.id,
        participantId: participant.id,
        type: 'session_closed',
        severity: 'warning',
        details: {},
      });
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('resize', onResize);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [attempt.id, config.maxFullscreenExits, config.maxOutOfFocusSeconds, config.maxTabSwitches, emit, exam.id, participant.id]);

  useEffect(() => {
    if (config.level !== 'standard' && config.level !== 'enhanced') return;
    const prevent = (event: Event, type: ProctoringEventType) => {
      event.preventDefault();
      void emit(type, 'warning', {}, true);
    };
    const onCopy = (event: ClipboardEvent) => prevent(event, 'copy_attempt');
    const onPaste = (event: ClipboardEvent) => prevent(event, 'paste_attempt');
    const onContext = (event: MouseEvent) => prevent(event, 'context_menu_attempt');
    const onKeyDown = (event: KeyboardEvent) => {
      const blocked =
        event.key === 'F12'
        || ((event.ctrlKey || event.metaKey) && ['c', 'v', 'x', 'p', 's', 'u'].includes(event.key.toLowerCase()));
      if (blocked) prevent(event, 'blocked_shortcut');
    };
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [config.level, emit]);

  useEffect(() => {
    const watchTrack = (track: MediaStreamTrack | undefined, type: ProctoringEventType) => {
      if (!track) return () => undefined;
      const ended = () => void emit(type, 'critical', {}, true);
      track.addEventListener('ended', ended);
      return () => track.removeEventListener('ended', ended);
    };
    const cleanups = [
      watchTrack(streams.camera?.getVideoTracks()[0], 'camera_disabled'),
      watchTrack(streams.camera?.getAudioTracks()[0], 'microphone_disabled'),
      watchTrack(streams.screen?.getVideoTracks()[0], 'screen_share_stopped'),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [emit, streams.camera, streams.screen]);

  useEffect(() => {
    if (!config.detectUnusualAudio || !streams.camera?.getAudioTracks().length) return;
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    const source = context.createMediaStreamSource(new MediaStream(streams.camera.getAudioTracks()));
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let loudSamples = 0;
    const interval = window.setInterval(() => {
      analyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / data.length / 255;
      if (average > .28) loudSamples += 1;
      else loudSamples = Math.max(0, loudSamples - 1);
      if (loudSamples >= 5) {
        loudSamples = 0;
        void emit('unusual_audio', 'warning', { normalizedLevel: Number(average.toFixed(2)) }, true);
      }
    }, 1000);
    return () => {
      window.clearInterval(interval);
      source.disconnect();
      void context.close();
    };
  }, [config.detectUnusualAudio, emit, streams.camera]);

  useEffect(() => {
    if (!window.getScreenDetails) return;
    void window.getScreenDetails().then((details) => {
      if (details.screens.length > 1) void emit('multiple_screens', 'warning', { count: details.screens.length }, true);
    }).catch(() => undefined);
  }, [emit]);

  return (
    <>
      <div style={{
        position: 'fixed',
        left: 14,
        bottom: 14,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 10px',
        borderRadius: 'var(--ap-r-sm)',
        background: 'color-mix(in srgb, var(--ap-card) 94%, transparent)',
        border: 'var(--ap-border-w) solid var(--ap-line)',
        boxShadow: '0 6px 20px rgba(20,18,30,.12)',
        fontSize: 11,
        fontWeight: 800,
      }}>
        <ShieldCheck size={15} style={{ color: '#15a575' }} />
        Surveillance active
        {streams.camera && <Camera size={13} style={{ color: 'var(--ap-muted)' }} />}
        {streams.screen && <MonitorUp size={13} style={{ color: 'var(--ap-muted)' }} />}
        {violations > 0 && <span style={{ color: '#b9382d' }}>· {violations} alerte{violations > 1 ? 's' : ''}</span>}
        {config.screenshotMode === 'manual' && (
          <button
            type="button"
            onClick={() => void capture('manual')}
            title="Réaliser une capture horodatée"
            style={{ border: 0, background: 'transparent', color: 'var(--ap-brand)', padding: 0, display: 'flex', cursor: 'pointer' }}
          >
            <Camera size={14} />
          </button>
        )}
      </div>

      {fullscreenWarning && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(20,18,30,.82)',
          display: 'grid',
          placeItems: 'center',
          padding: 20,
        }}>
          <div className="ap-card" style={{ maxWidth: 420, padding: 28, textAlign: 'center' }}>
            <AlertTriangle size={38} style={{ color: '#e45448', margin: '0 auto 12px' }} />
            <h2 className="ap-h2" style={{ fontSize: 20, marginBottom: 8 }}>Plein écran interrompu</h2>
            <p className="ap-muted" style={{ fontSize: 13, marginBottom: 18 }}>
              L’événement a été journalisé. Revenez en plein écran pour poursuivre.
            </p>
            <button
              className="ap-btn ap-btn--pill"
              onClick={() => void document.documentElement.requestFullscreen().then(() => setFullscreenWarning(false))}
            >
              Revenir en plein écran
            </button>
          </div>
        </div>
      )}
    </>
  );
}
