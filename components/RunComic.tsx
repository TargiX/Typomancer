import React, { useEffect, useRef, useState } from 'react';
import { ComicFrame, Language } from '../types';
import { selectRunComicFrames } from '../services/runComicFrames';

interface StatChip {
  label: string;
  value: string;
}

interface RunComicUI {
  building: string;
  ready: string;
  error: string;
  share: string;
  download: string;
  close: string;
  copied: string;
  replay_label: string;
  watermark: string;
}

interface RunComicProps {
  frames: ComicFrame[];
  title: string;
  endingTitle: string;
  outcome: 'victory' | 'defeat';
  tagline: string;
  stats: StatChip[];
  shareText: string;
  dailyLabel?: string;
  language: Language;
  ui: RunComicUI;
  onClose: () => void;
}

// Ink colours for a printed page: performance reads as a stamp on paper,
// not as neon on a dashboard.
const PERF_COLORS: Record<string, string> = {
  good: '#2c8a55',
  average: '#c98a12',
  bad: '#c92a3e',
  neutral: '#6d655a'
};

const PAPER = '#ece3cf';
const INK = '#15120e';
const INK_SOFT = '#4a4238';
const CAPTION_FILL = '#f4d44a';

const W = 960;
const PAD = 36;
const GUTTER = 14;
const SLANT = 18;
const SCALE = 2;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && line && !lines.includes(line)) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
};

type Point = [number, number];

const tracePolygon = (ctx: CanvasRenderingContext2D, points: Point[]) => {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
};

/** Rows of a comic page by panel count: 1 = a full-width tier, 2 = a split tier. */
const PAGE_TEMPLATES: Record<number, number[]> = {
  1: [1],
  2: [1, 1],
  3: [1, 2],
  4: [1, 2, 1],
  5: [1, 2, 2],
  6: [1, 2, 1, 2]
};

const renderComic = async (
  target: HTMLCanvasElement,
  props: Pick<RunComicProps, 'frames' | 'title' | 'endingTitle' | 'outcome' | 'tagline' | 'stats' | 'dailyLabel' | 'ui'>
): Promise<void> => {
  // Render into a private offscreen canvas and blit at the end. React StrictMode
  // mounts effects twice, so two async renders can run concurrently — sharing one
  // visible context interleaves their save/clip/restore stacks and clips text away.
  const canvas = document.createElement('canvas');
  const { frames, title, endingTitle, outcome, tagline, stats, dailyLabel, ui } = props;
  const selected = selectRunComicFrames(frames, 6);
  const accent = outcome === 'victory' ? '#ff6a2b' : '#d7263d';

  // Wait for the faces before measuring — otherwise wrapText measures with the
  // fallback font while the final draw uses the loaded (wider) one and captions clip.
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('900 34px Unbounded'),
        document.fonts.load('800 40px Unbounded'),
        document.fonts.load('italic 500 17px "Victor Mono"'),
        document.fonts.load('600 14px "Victor Mono"'),
        document.fonts.load('700 11px "Martian Mono"')
      ]);
      await document.fonts.ready;
    } catch { /* render with fallback metrics */ }
  }

  const measureCtx = canvas.getContext('2d');
  if (!measureCtx) throw new Error('no-2d-context');

  const contentW = W - PAD * 2;
  const halfW = (contentW - GUTTER) / 2;
  const fullH = Math.round(contentW * 0.46);
  const halfH = Math.round(halfW * 0.8);
  const rows = PAGE_TEMPLATES[Math.min(6, Math.max(1, selected.length))] || [1];
  const framesH = selected.length
    ? rows.reduce((sum, cols) => sum + (cols === 1 ? fullH : halfH) + GUTTER, 0) - GUTTER
    : 0;

  measureCtx.font = '800 40px Unbounded, sans-serif';
  const endingLines = wrapText(measureCtx, endingTitle, contentW, 2);
  measureCtx.font = 'italic 500 17px "Victor Mono", monospace';
  const taglineLines = tagline ? wrapText(measureCtx, `“${tagline}”`, contentW, 3) : [];

  const MAST_H = 92;
  const headerH = MAST_H + 6 + 46 + endingLines.length * 48 + (taglineLines.length ? 8 + taglineLines.length * 26 : 0) + 28;
  const footerH = selected.length ? 148 : 120;
  const totalH = headerH + framesH + footerH;

  canvas.width = W * SCALE;
  canvas.height = totalH * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-2d-context');
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'alphabetic';

  // --- Paper, with a faint halftone so it prints rather than glows ---
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, totalH);
  ctx.fillStyle = 'rgba(80, 60, 30, 0.07)';
  for (let y = 0, row = 0; y < totalH; y += 5, row++) {
    for (let x = row % 2 ? 2.5 : 0; x < W; x += 5) ctx.fillRect(x, y, 1.1, 1.1);
  }

  // --- Masthead: an ink band with the game's name, like a comic's cover strip ---
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, MAST_H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, MAST_H, W, 6);

  ctx.textAlign = 'left';
  ctx.fillStyle = PAPER;
  ctx.font = '900 34px Unbounded, sans-serif';
  ctx.fillText('TYPOMANCER', PAD, 58);

  ctx.textAlign = 'right';
  ctx.font = '700 11px "Martian Mono", monospace';
  ctx.fillStyle = accent;
  ctx.fillText((dailyLabel || ui.replay_label).toUpperCase(), W - PAD, 42);
  ctx.fillStyle = 'rgba(236, 227, 207, 0.62)';
  ctx.fillText(title.toUpperCase(), W - PAD, 62);
  ctx.textAlign = 'left';

  // --- The ending, set like a chapter title on the page ---
  let y = MAST_H + 6 + 58;
  ctx.fillStyle = INK;
  ctx.font = '800 40px Unbounded, sans-serif';
  for (const line of endingLines) {
    ctx.fillText(line, PAD, y);
    y += 48;
  }
  if (taglineLines.length) {
    y += 2;
    ctx.font = 'italic 500 17px "Victor Mono", monospace';
    ctx.fillStyle = INK_SOFT;
    for (const line of taglineLines) {
      ctx.fillText(line, PAD, y);
      y += 26;
    }
  }

  // --- Panels: tiers of one wide or two split panels, split on a slant ---
  const drawPanel = async (frame: ComicFrame, index: number, shape: Point[]) => {
    const xs = shape.map(p => p[0]);
    const ys = shape.map(p => p[1]);
    const x = Math.min(...xs);
    const top = Math.min(...ys);
    const w = Math.max(...xs) - x;
    const h = Math.max(...ys) - top;

    ctx.save();
    tracePolygon(ctx, shape);
    ctx.clip();
    ctx.fillStyle = '#231f1a';
    ctx.fillRect(x, top, w, h);
    if (frame.image) {
      try {
        const img = await loadImage(frame.image);
        const iw = img.naturalWidth || 960;
        const ih = img.naturalHeight || 540;
        const scale = Math.max(w / iw, h / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        ctx.drawImage(img, x + (w - dw) / 2, top + (h - dh) / 2, dw, dh);
      } catch {
        /* keep the ink fill */
      }
    }
    ctx.restore();

    // Ink border
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    tracePolygon(ctx, shape);
    ctx.stroke();

    // Narration box, top-left — the typed line is the caption.
    const boxX = x + 12;
    const boxY = top + 12;
    const boxMaxW = Math.min(w - 24, 440);
    ctx.font = '600 14px "Victor Mono", monospace';
    const capLines = wrapText(ctx, frame.caption.trim(), boxMaxW - 24, 3);
    const lineH = 19;
    const boxW = Math.min(boxMaxW, Math.max(...capLines.map(line => ctx.measureText(line).width)) + 24);
    const boxH = capLines.length * lineH + 16;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(boxX + 3, boxY + 3, boxW, boxH);
    ctx.fillStyle = CAPTION_FILL;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = INK;
    let cy = boxY + 8 + 14;
    for (const line of capLines) {
      ctx.fillText(line, boxX + 12, cy);
      cy += lineH;
    }

    // Panel number, stamped bottom-right in the colour of how the line went.
    const perfColor = PERF_COLORS[frame.performance] || PERF_COLORS.neutral;
    const bx = Math.max(...shape.filter(p => p[1] === Math.max(...ys)).map(p => p[0])) - 40;
    const by = Math.max(...ys) - 40;
    ctx.fillStyle = PAPER;
    ctx.fillRect(bx, by, 28, 28);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, 28, 28);
    ctx.fillStyle = perfColor;
    ctx.fillRect(bx + 2, by + 22, 24, 4);
    ctx.fillStyle = INK;
    ctx.font = '800 14px Unbounded, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(index + 1), bx + 14, by + 18);
    ctx.textAlign = 'left';
  };

  y = headerH;
  let frameIndex = 0;
  for (let rowIndex = 0; rowIndex < rows.length && frameIndex < selected.length; rowIndex++) {
    const cols = rows[rowIndex];
    if (cols === 1) {
      await drawPanel(selected[frameIndex], frameIndex, [[PAD, y], [PAD + contentW, y], [PAD + contentW, y + fullH], [PAD, y + fullH]]);
      frameIndex += 1;
      y += fullH + GUTTER;
    } else {
      // Alternate the lean of the split so the page has rhythm.
      const lean = rowIndex % 2 ? -SLANT : SLANT;
      const mid = PAD + contentW / 2;
      const leftTop = mid + lean - GUTTER / 2;
      const leftBottom = mid - lean - GUTTER / 2;
      const rightTop = mid + lean + GUTTER / 2;
      const rightBottom = mid - lean + GUTTER / 2;
      await drawPanel(selected[frameIndex], frameIndex, [[PAD, y], [leftTop, y], [leftBottom, y + halfH], [PAD, y + halfH]]);
      frameIndex += 1;
      if (frameIndex < selected.length) {
        await drawPanel(selected[frameIndex], frameIndex, [[rightTop, y], [PAD + contentW, y], [PAD + contentW, y + halfH], [rightBottom, y + halfH]]);
        frameIndex += 1;
      }
      y += halfH + GUTTER;
    }
  }

  // --- Footer: the run's numbers, stamped in ink boxes ---
  const footerY = totalH - footerH;
  const chipCount = Math.min(stats.length, 5);
  if (chipCount > 0) {
    const gap = 10;
    const chipW = (contentW - gap * (chipCount - 1)) / chipCount;
    const chipH = 64;
    const chipY = footerY + 28;
    for (let i = 0; i < chipCount; i++) {
      const cx = PAD + i * (chipW + gap);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, chipY, chipW, chipH);
      ctx.textAlign = 'center';
      ctx.fillStyle = INK_SOFT;
      ctx.font = '700 10px "Martian Mono", monospace';
      ctx.fillText(stats[i].label.toUpperCase(), cx + chipW / 2, chipY + 22);
      ctx.fillStyle = INK;
      ctx.font = '800 22px Unbounded, sans-serif';
      ctx.fillText(stats[i].value, cx + chipW / 2, chipY + 50);
    }
    ctx.textAlign = 'left';
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = INK_SOFT;
  ctx.font = '700 11px "Martian Mono", monospace';
  ctx.fillText(ui.watermark.toUpperCase(), W / 2, totalH - 24);
  ctx.textAlign = 'left';

  // blit the finished page to the visible canvas in one synchronous step
  target.width = canvas.width;
  target.height = canvas.height;
  const out = target.getContext('2d');
  if (!out) throw new Error('no-2d-context');
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.drawImage(canvas, 0, 0);
};

const RunComic: React.FC<RunComicProps> = ({
  frames,
  title,
  endingTitle,
  outcome,
  tagline,
  stats,
  shareText,
  dailyLabel,
  language,
  ui,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'rendering' | 'ready' | 'error'>('rendering');
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderComic(canvas, { frames, title, endingTitle, outcome, tagline, stats, dailyLabel, ui })
      .then(() => { if (!cancelled) setStatus('ready'); })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof (navigator as Navigator).canShare === 'function') {
      try {
        const probe = new File([new Blob()], 'probe.png', { type: 'image/png' });
        setCanShare(navigator.canShare({ files: [probe] }));
      } catch {
        setCanShare(false);
      }
    }
  }, []);

  const toBlob = (): Promise<Blob | null> =>
    new Promise(resolve => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob(blob => resolve(blob), 'image/png');
    });

  const dailyFileTag = dailyLabel
    ? `${dailyLabel.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}-`
    : '';
  const fileName = `narrative-flow-${dailyFileTag}${outcome}-${Date.now()}.png`;

  const downloadComic = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    await downloadComic();
  };

  const handleShare = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title, text: shareText });
    } catch {
      // user cancelled or share failed — fall back to download
      await downloadComic();
    }
  };

  const handleCopy = async () => {
    try {
      const blob = await toBlob();
      if (!blob || !navigator.clipboard || !('write' in navigator.clipboard)) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unsupported — ignore */
    }
  };

  const supportsClipboard =
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    typeof (navigator.clipboard as Clipboard).write === 'function' &&
    typeof ClipboardItem !== 'undefined';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0e0d10]/[.92] backdrop-blur-md p-4 animate-fade-in-up"
      role="dialog"
      aria-modal="true"
      aria-label={ui.replay_label}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[94vh] flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="comic-page-scroll flex-1 min-h-0 overflow-y-auto">
          <canvas
            ref={canvasRef}
            className="comic-page w-full h-auto block"
            style={{ imageRendering: 'auto' }}
            aria-label={`${title} — ${endingTitle}`}
          />
          {status === 'rendering' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/60 pointer-events-none">
              <div className="w-10 h-10 border-4 border-[#ff6a2b]/30 border-t-[#ff6a2b] rounded-full animate-spin"></div>
              <span className="text-[#ff8f5c] fs-body tracking-widest animate-pulse">{ui.building}</span>
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-rose-300 fs-body px-6 text-center">
              {ui.error}
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-3 px-1 pb-2">
          {canShare && (
            <button
              onClick={handleShare}
              disabled={status !== 'ready'}
              className="btn-cyber btn-cyber-primary flex-1 min-w-[120px] py-3 font-display font-bold tracking-[0.06em] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ui.share}
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={status !== 'ready'}
            className="btn-cyber btn-cyber-ghost flex-1 min-w-[120px] py-3 font-display font-bold tracking-[0.06em] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ui.download}
          </button>
          {supportsClipboard && (
            <button
              onClick={handleCopy}
              disabled={status !== 'ready'}
              className="btn-cyber btn-cyber-ghost h-[46px] min-w-[54px] px-4 text-[12px] font-bold uppercase tracking-[0.14em] disabled:opacity-50"
            >
              {copied ? ui.copied : '⧉'}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label={ui.close}
            className="btn-cyber btn-cyber-ghost h-[46px] min-w-[54px] px-4 text-[12px] font-bold uppercase tracking-[0.14em]"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default RunComic;
