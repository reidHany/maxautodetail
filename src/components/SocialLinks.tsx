import React, { useEffect, useRef } from 'react';

function pad(num: number, size = 3) {
  return String(num).padStart(size, '0');
}

async function loadManifest(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function SocialLinks() {
  const beforeContainerRef = useRef<HTMLDivElement | null>(null);
  const afterContainerRef = useRef<HTMLDivElement | null>(null);
  const beforeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 640px)').matches;

    const setupMobileVideo = (containerRef: React.RefObject<HTMLDivElement | null>) => {
      const container = containerRef.current;
      const stage = container?.querySelector<HTMLElement>('.video-stage-inner');
      const video = container?.querySelector<HTMLVideoElement>('.mobile-sequence-video');
      if (!container || !stage || !video) return null;

      let rafId = 0;
      let targetProgress = 0;
      let renderedProgress = -1;
      let visible = false;

      const paint = (progress: number) => {
        const sequenceProgress = Math.max(0, Math.min(1, (progress - 0.02) / 0.96));
        stage.style.setProperty('--sequence-progress', sequenceProgress.toFixed(4));
        stage.style.setProperty('--poster-opacity', '0');
        if (Number.isFinite(video.duration) && video.duration > 0) {
          const targetTime = Math.min(video.duration - 0.001, sequenceProgress * video.duration);
          if (Math.abs(video.currentTime - targetTime) > 1 / 60) video.currentTime = targetTime;
        }
      };

      const animate = () => {
        const difference = targetProgress - renderedProgress;
        renderedProgress = renderedProgress < 0 ? targetProgress : renderedProgress + difference * 0.22;
        paint(renderedProgress);
        if (Math.abs(difference) > 0.0005) rafId = requestAnimationFrame(animate);
        else { renderedProgress = targetProgress; paint(renderedProgress); rafId = 0; }
      };

      const measure = () => {
        const rect = container.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        targetProgress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
        if (visible && !rafId) rafId = requestAnimationFrame(animate);
      };

      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          // load() starts one sequential, range-enabled request before the user
          // reaches the pinned portion of the sequence.
          if (video.readyState < HTMLMediaElement.HAVE_METADATA) video.load();
          measure();
        } else if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      }, { rootMargin: '100% 0px', threshold: 0 });

      observer.observe(container);
      window.addEventListener('scroll', measure, { passive: true });
      window.addEventListener('resize', measure, { passive: true });
      video.addEventListener('loadedmetadata', measure);
      measure();

      return () => {
        observer.disconnect();
        window.removeEventListener('scroll', measure);
        window.removeEventListener('resize', measure);
        video.removeEventListener('loadedmetadata', measure);
        if (rafId) cancelAnimationFrame(rafId);
      };
    };

    const setupScrubber = async (folder: string, manifestPath: string, canvasRef: React.RefObject<HTMLCanvasElement | null>, containerRef: React.RefObject<HTMLDivElement | null>) => {
      const manifest = await loadManifest(manifestPath);
      const count = (manifest && manifest.frames) || 0;
      if (!count) return null;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const cache = new Map<number, HTMLImageElement>();
      const stage = container.querySelector<HTMLElement>('.video-stage-inner');
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let rafId = 0;
      let targetProgress = 0;
      let renderedProgress = -1;
      let paintedFrame = -1;
      let desiredFrame = 0;
      let visible = false;
      let preloadTimer = 0;
      const frameStep = isMobile ? 2 : 1;

      const frameForProgress = (progress: number) => {
        const lastPlaybackFrame = Math.floor((count - 1) / frameStep);
        return Math.min(count - 1, Math.round(progress * lastPlaybackFrame) * frameStep);
      };

      const getRevealProgress = (progress: number) => {
        const zoomIn = Math.min(1, progress / 0.24);
        const zoomOut = Math.min(1, Math.max(0, (1 - progress) / 0.18));
        return zoomIn * zoomOut;
      };

      const loadFrame = (i: number) => {
        if (cache.has(i)) return cache.get(i)!;
        const img = new Image();
        img.decoding = 'async';
        img.src = `${folder}/frame_${pad(i + 1)}.jpg`;
        img.onload = () => {
          if (i === desiredFrame) {
            paintedFrame = -1;
            if (visible && !rafId) rafId = requestAnimationFrame(animate);
          }
        };
        cache.set(i, img);
        return img;
      };

      const warmMobileFrames = () => {
        if (!isMobile) return;
        let nextFrame = 0;
        const warmBatch = () => {
          // Small batches prevent a burst of 70+ simultaneous requests while
          // still filling the browser cache well before playback reaches them.
          for (let loaded = 0; loaded < 6 && nextFrame < count; loaded += 1) {
            loadFrame(nextFrame);
            nextFrame += frameStep;
          }
          if (nextFrame < count) preloadTimer = window.setTimeout(warmBatch, 80);
        };
        warmBatch();
      };

      const resize = (force = false) => {
        // Let CSS scale the existing bitmap during the reveal. Reallocating a
        // canvas for every pixel of the expansion causes severe scroll jank.
        if (!force && renderedProgress >= 0 && getRevealProgress(renderedProgress) < 0.99) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
        const nextWidth = Math.round(rect.width * dpr);
        const nextHeight = Math.round(rect.height * dpr);
        if (canvas.width === nextWidth && canvas.height === nextHeight) return;
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintedFrame = -1;
      };
      resize(true);
      const resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(canvas);

      const drawImage = (img: HTMLImageElement) => {
        if (!img.complete || !img.naturalWidth) return;
        const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;
        // Preserve the portrait composition. Fitting by height avoids blowing a
        // 540px-wide source up to desktop width and leaves intentional side bars.
        const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      };

      const paint = (progress: number) => {
        // Expand, play at full screen, then return to the portrait card.
        const revealProgress = getRevealProgress(progress);
        // Desktop reserves the opening portion for its fullscreen reveal. The
        // compact mobile card has no reveal, so begin advancing frames almost
        // as soon as it becomes sticky.
        const sequenceStart = isMobile ? 0.035 : 0.34;
        // On mobile, use essentially the full pinned distance so the section
        // cannot release until the final frame has been reached.
        const sequenceDuration = isMobile ? 0.96 : 0.44;
        const sequenceProgress = Math.max(0, Math.min(1, (progress - sequenceStart) / sequenceDuration));
        const frame = frameForProgress(sequenceProgress);
        desiredFrame = frame;
        stage?.style.setProperty('--reveal-progress', revealProgress.toFixed(4));
        stage?.style.setProperty('--sequence-progress', sequenceProgress.toFixed(4));
        // Keep the undistorted poster visible throughout the expansion, then
        // crossfade once the full-screen canvas has been allocated.
        const posterFadeEnd = isMobile ? 0.075 : 0.34;
        const posterFadeDuration = isMobile ? 0.04 : 0.06;
        const posterOpacity = Math.max(0, Math.min(1, (posterFadeEnd - progress) / posterFadeDuration));
        stage?.style.setProperty('--poster-opacity', posterOpacity.toFixed(4));
        if (frame === paintedFrame) return;

        const img = loadFrame(frame);
        // Keep a small buffer in the likely direction of travel.
        const direction = targetProgress >= renderedProgress ? 1 : -1;
        const preloadDistance = isMobile ? 3 : 5;
        for (let offset = 1; offset <= preloadDistance; offset += 1) {
          const nearby = frame + offset * direction * frameStep;
          if (nearby >= 0 && nearby < count) loadFrame(nearby);
        }
        if (!img.complete || !img.naturalWidth) return;

        const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        drawImage(img);
        paintedFrame = frame;
      };

      const measure = () => {
        const rect = container.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        targetProgress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
        if (visible && !rafId) rafId = requestAnimationFrame(animate);
      };

      const animate = () => {
        const difference = targetProgress - renderedProgress;
        renderedProgress = renderedProgress < 0 || reducedMotion
          ? targetProgress
          : renderedProgress + difference * 0.14;
        paint(renderedProgress);
        if (Math.abs(difference) > 0.0005) rafId = requestAnimationFrame(animate);
        else { renderedProgress = targetProgress; paint(renderedProgress); rafId = 0; }
      };

      loadFrame(0);
      warmMobileFrames();
      window.addEventListener('scroll', measure, { passive: true });
      const onWindowResize = () => { resize(true); measure(); };
      window.addEventListener('resize', onWindowResize, { passive: true });

      const observer = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            visible = true;
            measure();
          } else {
            visible = false;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
          }
        }
      }, { threshold: 0.05 });
      observer.observe(container);

      return () => {
        observer.disconnect();
        resizeObserver.disconnect();
        window.removeEventListener('scroll', measure);
        window.removeEventListener('resize', onWindowResize);
        if (preloadTimer) window.clearTimeout(preloadTimer);
        if (rafId) cancelAnimationFrame(rafId);
      };
    };

    let cleanupBefore: (() => void) | null = null;
    let cleanupAfter: (() => void) | null = null;

    (async () => {
      if (isMobile) {
        cleanupBefore = setupMobileVideo(beforeContainerRef);
        cleanupAfter = setupMobileVideo(afterContainerRef);
      } else {
        cleanupBefore = await setupScrubber('/social/before_frames', '/social/before_frames/manifest.json', beforeCanvasRef, beforeContainerRef) as any;
        cleanupAfter = await setupScrubber('/social/after_frames', '/social/after_frames/manifest.json', afterCanvasRef, afterContainerRef) as any;
      }
    })();

    return () => {
      if (cleanupBefore) cleanupBefore();
      if (cleanupAfter) cleanupAfter();
    };
  }, []);

  return (
    <>
      <section className="video-showcase-section" id="transformations">
        <div className="video-showcase-copy">
          <p className="eyebrow">The transformation</p>
          <h2>See the difference in every detail</h2>
          <p>Scroll through the before and after to experience the full transformation.</p>
        </div>

        <div className="scrub-section" ref={beforeContainerRef}>
          <div className="video-compare-stage">
            <div className="video-stage-inner single before-film">
              <div className="compare-panel">
                <img className="sequence-poster" src="/social/before_frames/frame_001.jpg" alt="" aria-hidden="true" />
                <video className="mobile-sequence-video" src="/social/before-mobile.mp4" muted playsInline preload="metadata" aria-label="Before detailing transformation" />
                <canvas ref={beforeCanvasRef} className="compare-canvas" aria-label="Before image" />
                <div className="cinematic-vignette" />
              </div>
              <div className="video-compare-labels">
                <span className="sequence-number">01</span>
                <span className="label before">Before</span>
              </div>
              <div className="scroll-progress" aria-hidden="true"><span /></div>
            </div>
          </div>
        </div>

        <div className="scrub-section" ref={afterContainerRef}>
          <div className="video-compare-stage">
            <div className="video-stage-inner single after-film">
              <div className="compare-panel">
                <img className="sequence-poster" src="/social/after_frames/frame_001.jpg" alt="" aria-hidden="true" />
                <video className="mobile-sequence-video" src="/social/after-mobile.mp4" muted playsInline preload="metadata" aria-label="After detailing transformation" />
                <canvas ref={afterCanvasRef} className="compare-canvas" aria-label="After image" />
                <div className="cinematic-vignette" />
              </div>
              <div className="video-compare-labels">
                <span className="sequence-number">02</span>
                <span className="label after">After</span>
              </div>
              <div className="scroll-progress" aria-hidden="true"><span /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="social-links-section">
        <div className="social-links-copy">
          <p className="eyebrow">Connect with us</p>
          <h2>Follow Stanbrough Sparkle on social media</h2>
          <p>Stay updated on our latest transformations, special offers, and detailing tips.</p>
        </div>
        <div className="social-links-grid">
          <a className="social-link facebook" href="https://www.facebook.com/share/1EwPhCTJ2U/?mibextid=wwXlfr" target="_blank" rel="noreferrer" aria-label="Facebook">
            <span className="social-icon" aria-hidden="true"><img className="social-image" src="/social/facebook.png" alt="Facebook logo" /></span>
            <span>Facebook</span>
          </a>
          <a className="social-link instagram" href="https://www.instagram.com/stanbroughsparkle/" target="_blank" rel="noreferrer" aria-label="Instagram">
            <span className="social-icon" aria-hidden="true"><img className="social-image" src="/social/instagram.png" alt="Instagram logo" /></span>
            <span>Instagram</span>
          </a>
          <a className="social-link tiktok" href="https://www.tiktok.com/@stanbrough.sparkle/" target="_blank" rel="noreferrer" aria-label="TikTok">
            <span className="social-icon" aria-hidden="true"><img className="social-image" src="/social/tiktok.png" alt="TikTok logo" /></span>
            <span>TikTok</span>
          </a>
        </div>
      </section>
    </>
  );
}
