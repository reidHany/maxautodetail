import { useEffect, useRef } from 'react';

interface BookingRoadProps {
  pageSelector?: string;
  variant?: 'booking' | 'home';
}

export function BookingRoad({ pageSelector = '.booking-page', variant = 'booking' }: BookingRoadProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const carRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const path = pathRef.current;
    const car = carRef.current;
    const page = svg?.closest<HTMLElement>(pageSelector);
    if (!svg || !path || !car || !page) return;

    let rafId = 0;
    let pathLength = 0;
    let journeyStart = 0;
    let journeyDistance = 1;
    let lastProgress = -1;
    let dragging = false;
    let dragStartY = 0;
    let dragStartScrollY = 0;

    const buildRoad = () => {
      const pageRect = page.getBoundingClientRect();
      const width = page.offsetWidth;
      const height = page.offsetHeight;
      const isSingleColumn = width < 900;
      const availableRightSpace = window.innerWidth - pageRect.right;
      const outsideOffset = isSingleColumn ? -10 : Math.max(22, Math.min(54, availableRightSpace - 18));
      const roadX = width + outsideOffset;
      const startX = roadX;
      const endX = roadX;
      const endY = height - 24;
      const lane = isSingleColumn ? 4 : Math.min(24, Math.max(12, availableRightSpace * .2));

      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const roadData = [
        `M ${startX} 8`,
        `C ${startX - lane * 2.1} ${endY * .08}, ${startX - lane * 2.1} ${endY * .18}, ${startX} ${endY * .25}`,
        `C ${startX + lane * 2.15} ${endY * .32}, ${startX + lane * 2.15} ${endY * .40}, ${startX} ${endY * .48}`,
        `C ${startX - lane * 2.25} ${endY * .56}, ${startX - lane * 2.25} ${endY * .64}, ${startX} ${endY * .71}`,
        `C ${startX + lane * 1.9} ${endY * .78}, ${startX + lane * 1.9} ${endY * .86}, ${startX} ${endY * .91}`,
        `C ${endX - lane * 1.1} ${endY * .95}, ${endX - lane * .25} ${endY - 42}, ${endX} ${endY}`,
      ].join(' ');
      svg.querySelectorAll<SVGPathElement>('.road-shadow, .road-surface, .road-centerline')
        .forEach((roadPath) => roadPath.setAttribute('d', roadData));
      pathLength = path.getTotalLength();
      journeyStart = pageRect.top + window.scrollY;
      journeyDistance = Math.max(1, height - window.innerHeight * 0.78);
      lastProgress = -1;
      draw();
    };

    const draw = () => {
      rafId = 0;
      if (!pathLength) return;
      const progress = Math.max(0, Math.min(1, (window.scrollY - journeyStart) / journeyDistance));
      if (Math.abs(progress - lastProgress) < 0.0005) return;
      lastProgress = progress;
      const travelled = pathLength * progress;
      const position = path.getPointAtLength(travelled);
      const behind = path.getPointAtLength(Math.max(0, travelled - 3));
      const ahead = path.getPointAtLength(Math.min(pathLength, travelled + 3));
      const angle = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180 / Math.PI - 90;
      car.setAttribute('transform', `translate(${position.x} ${position.y}) rotate(${angle})`);
    };

    const requestDraw = () => {
      if (!rafId) rafId = requestAnimationFrame(draw);
    };

    const startDrag = (event: PointerEvent) => {
      if (window.innerWidth <= 900 || event.button !== 0) return;
      dragging = true;
      dragStartY = event.clientY;
      dragStartScrollY = window.scrollY;
      car.classList.add('is-dragging');
      car.setPointerCapture(event.pointerId);
      event.preventDefault();
    };

    const dragCar = (event: PointerEvent) => {
      if (!dragging) return;
      // Treat the visible viewport as the scrollbar track. The car still
      // follows the curves because draw() derives its position from scrollY.
      const usableTrack = Math.max(180, window.innerHeight - 80);
      const scrollDelta = (event.clientY - dragStartY) * (journeyDistance / usableTrack);
      window.scrollTo({ top: dragStartScrollY + scrollDelta, behavior: 'auto' });
      requestDraw();
      event.preventDefault();
    };

    const stopDrag = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      car.classList.remove('is-dragging');
      if (car.hasPointerCapture(event.pointerId)) car.releasePointerCapture(event.pointerId);
    };

    const resizeObserver = new ResizeObserver(buildRoad);
    resizeObserver.observe(page);
    window.addEventListener('scroll', requestDraw, { passive: true });
    window.addEventListener('resize', buildRoad, { passive: true });
    car.addEventListener('pointerdown', startDrag);
    car.addEventListener('pointermove', dragCar);
    car.addEventListener('pointerup', stopDrag);
    car.addEventListener('pointercancel', stopDrag);
    buildRoad();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', requestDraw);
      window.removeEventListener('resize', buildRoad);
      car.removeEventListener('pointerdown', startDrag);
      car.removeEventListener('pointermove', dragCar);
      car.removeEventListener('pointerup', stopDrag);
      car.removeEventListener('pointercancel', stopDrag);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [pageSelector]);

  return (
    <svg ref={svgRef} className={`booking-road ${variant}-road`} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="car-paint" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b53a31" />
          <stop offset="0.5" stopColor="#69100b" />
          <stop offset="1" stopColor="#310503" />
        </linearGradient>
      </defs>
      <path ref={pathRef} className="road-shadow" />
      <path className="road-surface" />
      <path className="road-centerline" />
      <g ref={carRef} className="road-car">
        <ellipse cx="0" cy="4" rx="13" ry="23" className="car-shadow" />
        <rect x="-11" y="-22" width="22" height="44" rx="8" className="car-body" />
        <path d="M-8-9 Q0-16 8-9 L7 7 Q0 11-7 7Z" className="car-glass" />
        <rect x="-8" y="14" width="16" height="3" rx="1.5" className="car-light" />
        <rect x="-8" y="-17" width="16" height="2.5" rx="1.25" className="car-light front" />
      </g>
    </svg>
  );
}
