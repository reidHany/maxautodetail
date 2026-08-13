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
      let visible = false;

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
          const wantedFrame = Math.round(Math.max(0, renderedProgress) * (count - 1));
          if (i === wantedFrame) {
            paintedFrame = -1;
            if (visible && !rafId) rafId = requestAnimationFrame(animate);
          }
        };
        cache.set(i, img);
        return img;
      };

      const resize = (force = false) => {
        // Let CSS scale the existing bitmap during the reveal. Reallocating a
        // canvas for every pixel of the expansion causes severe scroll jank.
        if (!force && renderedProgress >= 0 && getRevealProgress(renderedProgress) < 0.99) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
        const sequenceProgress = Math.max(0, Math.min(1, (progress - 0.34) / 0.44));
        const frame = Math.round(sequenceProgress * (count - 1));
        stage?.style.setProperty('--reveal-progress', revealProgress.toFixed(4));
        stage?.style.setProperty('--sequence-progress', sequenceProgress.toFixed(4));
        if (frame === paintedFrame) return;

        const img = loadFrame(frame);
        // Keep a small buffer in the likely direction of travel.
        const direction = targetProgress >= renderedProgress ? 1 : -1;
        for (let offset = 1; offset <= 5; offset += 1) {
          const nearby = frame + offset * direction;
          if (nearby >= 0 && nearby < count) loadFrame(nearby);
        }
        if (!img.complete || !img.naturalWidth) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
        if (rafId) cancelAnimationFrame(rafId);
      };
    };

    let cleanupBefore: (() => void) | null = null;
    let cleanupAfter: (() => void) | null = null;

    (async () => {
      cleanupBefore = await setupScrubber('/social/before_frames', '/social/before_frames/manifest.json', beforeCanvasRef, beforeContainerRef) as any;
      cleanupAfter = await setupScrubber('/social/after_frames', '/social/after_frames/manifest.json', afterCanvasRef, afterContainerRef) as any;
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
