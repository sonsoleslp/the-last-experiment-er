/**
 * The opening cinematic.
 *
 * Replaces what used to be a page of briefing prose. It plays as timed beats
 * with subtitle-style captions, and adapts to whatever media is available:
 *
 *   1. `public/media/intro-1.mp3` ... one clip per beat -> PREFERRED, and what
 *      the shipped recording uses. Each clip plays while its own caption is on
 *      screen and the next beat begins when the clip ends, so words, captions
 *      and visuals cannot drift apart however the narrator paced it.
 *   2. `public/media/intro.mp4`  -> plays that video, captions off
 *   3. `public/media/intro.mp3`  -> one continuous take; captions follow the
 *      audio clock against the derived beat times
 *   4. none of the above         -> animated beats on their own timers
 *
 * Detection is by media-element events, not by guessing: a hidden probe fires
 * `loadeddata` or `error`, with a timeout so a slow or missing file can never
 * hang the opening. Drop a file in and it is used; remove it and nothing
 * breaks.
 *
 * Playback starts on a click ("BEGIN TRANSMISSION") rather than autoplaying.
 * That is deliberate on two counts: browsers block autoplay with sound, and a
 * class needs a moment to settle before the narration starts.
 *
 * Captions are always rendered in audio and silent modes; the narration is
 * never the only way to receive the story.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { setScene, unlock } from '../audio/engine';
import { useGame } from '../game/GameProvider';
import { BEAT_GAP_MS, INTRO_BEATS, INTRO_DURATION, assetUrl, beatAudioUrl } from '../game/intro';
import { IntroVignette } from './IntroVignette';

type Mode = 'probing' | 'sequence' | 'video' | 'audio' | 'silent';

const VIDEO_SRC = assetUrl('media/intro.mp4');
const AUDIO_SRC = assetUrl('media/intro.mp3');
const PROBE_TIMEOUT_MS = 2500;

export const Intro = () => {
  const { dispatch } = useGame();
  const [mode, setMode] = useState<Mode>('probing');
  const [started, setStarted] = useState(false);
  const [t, setT] = useState(0);
  /** Which beat is playing, in per-beat clip mode. */
  const [clipIndex, setClipIndex] = useState(0);
  /** Fraction through the current clip, for the progress bar. */
  const [clipProgress, setClipProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const finish = useCallback(() => {
    try {
      audioRef.current?.pause();
      videoRef.current?.pause();
    } catch {
      /* ignore */
    }
    dispatch({ type: 'seeBriefing' });
  }, [dispatch]);

  /* ----------------------------------------------------- media detection */

  useEffect(() => {
    let done = false;
    const settle = (m: Mode) => {
      if (done) return;
      done = true;
      setMode(m);
    };

    const timer = window.setTimeout(() => settle('silent'), PROBE_TIMEOUT_MS);

    const probeAudio = () => {
      const a = document.createElement('audio');
      a.preload = 'auto';
      a.src = AUDIO_SRC;
      a.addEventListener('loadeddata', () => settle('audio'), { once: true });
      a.addEventListener('error', () => settle('silent'), { once: true });
      a.load();
    };

    const probeVideo = () => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = VIDEO_SRC;
      v.addEventListener('loadeddata', () => settle('video'), { once: true });
      v.addEventListener('error', probeAudio, { once: true });
      v.load();
    };

    // Per-beat clips win if the first one is there.
    const first = document.createElement('audio');
    first.preload = 'auto';
    first.src = beatAudioUrl(0);
    first.addEventListener('loadeddata', () => settle('sequence'), { once: true });
    first.addEventListener('error', probeVideo, { once: true });
    first.load();

    return () => {
      done = true;
      window.clearTimeout(timer);
    };
  }, []);

  /* ------------------------------------------------------------ playback */

  // Audio mode: follow the real audio clock so captions stay in sync even if
  // the narration is a slightly different length than the beat table.
  useEffect(() => {
    if (!started || mode !== 'audio') return;
    const tick = () => {
      const a = audioRef.current;
      if (a) setT(a.currentTime);
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [started, mode]);

  /*
   * Per-beat clips: play clip N, and when it ends wait a breath and start clip
   * N+1. The beat on screen is simply the clip that is playing, so there is no
   * timing table to keep in sync with the recording.
   */
  useEffect(() => {
    if (!started || mode !== 'sequence') return;
    const el = audioRef.current;
    if (!el) return;

    let cancelled = false;
    let gap: number | undefined;

    const onEnded = () => {
      if (cancelled) return;
      if (clipIndex + 1 >= INTRO_BEATS.length) {
        finish();
        return;
      }
      setClipProgress(1);
      gap = window.setTimeout(() => {
        if (!cancelled) setClipIndex((i) => i + 1);
      }, BEAT_GAP_MS);
    };

    // A missing or broken clip must not strand the intro: treat it as ended.
    const onError = () => onEnded();
    const onTime = () => {
      if (el.duration > 0) setClipProgress(el.currentTime / el.duration);
    };

    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    el.addEventListener('timeupdate', onTime);

    el.src = beatAudioUrl(clipIndex);
    setClipProgress(0);
    void el.play().catch(() => {
      // Autoplay refused mid-sequence: fall back to captions on timers.
      if (!cancelled) setMode('silent');
    });

    return () => {
      cancelled = true;
      if (gap !== undefined) window.clearTimeout(gap);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      el.removeEventListener('timeupdate', onTime);
    };
  }, [started, mode, clipIndex, finish]);

  // Silent mode: advance on a plain interval.
  useEffect(() => {
    if (!started || mode !== 'silent') return;
    const id = window.setInterval(() => {
      setT((prev) => {
        const next = prev + 0.1;
        if (next >= INTRO_DURATION) {
          window.clearInterval(id);
          finish();
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [started, mode, finish]);

  const begin = () => {
    // This click is the user gesture browsers require before any audio can
    // start, so it is the only place the engine can be unlocked.
    unlock();
    setScene('boot');
    setStarted(true);
    if (mode === 'sequence') {
      // The sequence effect starts playback; nothing to do here beyond the
      // gesture itself, which is what unlocks audio.
    } else if (mode === 'audio') {
      void audioRef.current?.play().catch(() => setMode('silent'));
    } else if (mode === 'video') {
      void videoRef.current?.play().catch(() => setMode('silent'));
    }
  };

  // Allow Escape and Enter to skip, like any cutscene.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'Enter' && !started) begin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /*
   * Which beat to show. With per-beat clips it is simply the clip that is
   * playing; otherwise it is the last beat whose derived start time has
   * passed. Written as a loop rather than findLastIndex to keep the ES2020
   * target for older school browsers.
   */
  let beatIndex = 0;
  if (mode === 'sequence') {
    beatIndex = Math.min(clipIndex, INTRO_BEATS.length - 1);
  } else {
    for (let i = 0; i < INTRO_BEATS.length; i += 1) {
      if (t >= INTRO_BEATS[i].at) beatIndex = i;
    }
  }
  const beat = INTRO_BEATS[beatIndex];
  const progress =
    mode === 'sequence'
      ? Math.min(100, ((beatIndex + clipProgress) / INTRO_BEATS.length) * 100)
      : Math.min(100, (t / INTRO_DURATION) * 100);

  /* ------------------------------------------------------------- render  */

  return (
    <div className="intro" role="region" aria-label="Opening cinematic">
      {/* Video mode renders the file full-bleed. */}
      {mode === 'video' && (
        <video
          ref={videoRef}
          className="intro-video"
          src={VIDEO_SRC}
          playsInline
          onEnded={finish}
        />
      )}

      {mode === 'audio' && (
        <audio ref={audioRef} src={AUDIO_SRC} onEnded={finish} preload="auto" />
      )}

      {/* Per-beat clips reuse one element, with its src swapped per beat. */}
      {mode === 'sequence' && <audio ref={audioRef} preload="auto" />}

      {/* Animated beats back the audio and silent modes. */}
      {mode !== 'video' && (
        <div className="intro-stage">
          <IntroVignette beat={beat.visual} active={started} />
        </div>
      )}

      {!started ? (
        <div className="intro-gate">
          <div className="intro-title">
            <span className="intro-kicker">Meridian Research Facility · Emergency Response</span>
            <h1>
              THE LAST EXPERIMENT
              <em>Containment Failure</em>
            </h1>
          </div>
          <button className="btn btn-primary intro-begin" onClick={begin} autoFocus>
            ▶ Begin transmission
          </button>
          {mode === 'silent' && (
            <p className="intro-note">
              Narration audio is not installed, so captions will play instead.
            </p>
          )}
          <button className="intro-skip" onClick={finish}>
            Skip intro
          </button>
        </div>
      ) : (
        <>
          {/* Captions: the story never depends on hearing the narration. */}
          {mode !== 'video' && (
            <div className="intro-caption" aria-live="polite">
              {beat.caption}
            </div>
          )}
          <div className="intro-progress" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
          <button className="intro-skip" onClick={finish}>
            Skip ↵
          </button>
        </>
      )}
    </div>
  );
};
