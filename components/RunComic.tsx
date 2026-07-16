import React, { useEffect, useRef, useState } from 'react';
import { ComicFrame, Language } from '../types';

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

const PERF_COLORS: Record<string, string> = {
  good: '#34d399',
  average: '#fbbf24',
  bad: '#f43f5e',
  neutral: '#64748b'
};

const W = 960;
const PAD = 32;
const COLS = 2;
const GUTTER = 14;
const CAPTION_H = 58;
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

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

// Pick up to `max` frames spread evenly across the run so the comic tells the
// whole arc rather than only the final moments.
const pickFrames = (frames: ComicFrame[], max: number): ComicFrame[] => {
  const usable = frames.filter(f => f.caption && f.caption.trim().length > 0);
  if (usable.length <= max) return usable;
  const picked: ComicFrame[] = [];
  const step = (usable.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) picked.push(usable[Math.round(i * step)]);
  return picked;
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
  const selected = pickFrames(frames, 6);
  const accent = outcome === 'victory' ? '#34d399' : '#f43f5e';

  // Wait for the web fonts before measuring — otherwise wrapText measures with the
  // fallback font while the final draw uses the loaded (wider) one and captions clip.
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* render with fallback metrics */ }
  }

  const measureCtx = canvas.getContext('2d');
  if (!measureCtx) throw new Error('no-2d-context');

  const contentW = W - PAD * 2;

  // Comic grid: 2 panels per row; an odd trailing frame becomes a full-width hero panel.
  const panelW = (contentW - GUTTER * (COLS - 1)) / COLS;
  const panelImgH = Math.round(panelW * 9 / 16);
  const heroImgH = Math.round(contentW * 9 / 21);
  const cellH = panelImgH + CAPTION_H + GUTTER;
  const hasHero = selected.length % COLS !== 0;
  const gridRows = Math.floor(selected.length / COLS);
  const framesH = gridRows * cellH + (hasHero ? heroImgH + CAPTION_H + GUTTER : 0);

  measureCtx.font = '600 16px "JetBrains Mono", monospace';
  const taglineLines = tagline ? wrapText(measureCtx, `“${tagline}”`, contentW, 3) : [];

  measureCtx.font = '700 34px "Space Grotesk", "JetBrains Mono", sans-serif';
  const endingLines = wrapText(measureCtx, endingTitle, contentW, 2);

  const headerH = 46 + endingLines.length * 38 + (taglineLines.length ? 10 + taglineLines.length * 23 : 0) + 26;
  const footerH = 150;
  const totalH = headerH + framesH + footerH;

  canvas.width = W * SCALE;
  canvas.height = totalH * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-2d-context');
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'alphabetic';

  const bg = ctx.createLinearGradient(0, 0, 0, totalH);
  bg.addColorStop(0, '#0b101a');
  bg.addColorStop(1, '#05070c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, totalH);

  // subtle dotted texture
  ctx.fillStyle = 'rgba(148,163,184,0.05)';
  for (let y = 0; y < totalH; y += 22) {
    for (let x = 0; x < W; x += 22) {
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // top accent rule
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 3);

  // --- Header ---
  let y = 40;
  ctx.textAlign = 'left';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillStyle = accent;
  ctx.fillText(title.toUpperCase(), PAD, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = dailyLabel ? accent : 'rgba(148,163,184,0.7)';
  ctx.fillText((dailyLabel || ui.replay_label).toUpperCase(), W - PAD, y);
  ctx.textAlign = 'left';

  y += 28;
  ctx.font = '700 34px "Space Grotesk", "JetBrains Mono", sans-serif';
  ctx.fillStyle = '#f8fafc';
  for (const line of endingLines) {
    ctx.fillText(line, PAD, y);
    y += 38;
  }

  if (taglineLines.length) {
    y += 6;
    ctx.font = 'italic 600 16px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(203,213,225,0.82)';
    for (const line of taglineLines) {
      ctx.fillText(line, PAD, y);
      y += 23;
    }
  }

  // --- Frames: comic grid, 2 per row; odd last frame = full-width hero panel ---
  const drawPanel = async (frame: ComicFrame, index: number, x: number, panelY: number, w: number, imgH: number) => {
    const perfColor = PERF_COLORS[frame.performance] || PERF_COLORS.neutral;

    ctx.save();
    drawRoundedRect(ctx, x, panelY, w, imgH, 10);
    ctx.clip();
    if (frame.image) {
      try {
        const img = await loadImage(frame.image);
        const iw = img.naturalWidth || 960;
        const ih = img.naturalHeight || 540;
        const scale = Math.max(w / iw, imgH / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        ctx.drawImage(img, x + (w - dw) / 2, panelY + (imgH - dh) / 2, dw, dh);
      } catch {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x, panelY, w, imgH);
      }
    } else {
      const grad = ctx.createLinearGradient(x, panelY, x + w, panelY + imgH);
      grad.addColorStop(0, '#111827');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(x, panelY, w, imgH);
    }
    // bottom vignette for legibility
    const vg = ctx.createLinearGradient(0, panelY + imgH - 60, 0, panelY + imgH);
    vg.addColorStop(0, 'rgba(5,7,12,0)');
    vg.addColorStop(1, 'rgba(5,7,12,0.75)');
    ctx.fillStyle = vg;
    ctx.fillRect(x, panelY + imgH - 60, w, 60);
    ctx.restore();

    // frame border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x, panelY, w, imgH, 10);
    ctx.stroke();

    // panel number badge
    ctx.fillStyle = perfColor;
    ctx.beginPath();
    ctx.arc(x + 20, panelY + 20, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#05070c';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), x + 20, panelY + 21);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // caption under the panel
    const capY = panelY + imgH + 6;
    ctx.font = '500 13px "JetBrains Mono", monospace';
    const capLines = wrapText(ctx, frame.caption.trim(), w - 14, 2);
    ctx.fillStyle = 'rgba(226,232,240,0.92)';
    let cy = capY + 17;
    for (const line of capLines) {
      ctx.fillText(line, x + 10, cy);
      cy += 18;
    }
    // perf tick
    ctx.fillStyle = perfColor;
    ctx.fillRect(x, capY + 4, 3, Math.max(1, capLines.length) * 18 - 4);
  };

  y = headerH;
  for (let i = 0; i < selected.length; i++) {
    const isHero = hasHero && i === selected.length - 1;
    if (isHero) {
      await drawPanel(selected[i], i, PAD, y, contentW, heroImgH);
      y += heroImgH + CAPTION_H + GUTTER;
    } else {
      const col = i % COLS;
      const x = PAD + col * (panelW + GUTTER);
      await drawPanel(selected[i], i, x, y, panelW, panelImgH);
      if (col === COLS - 1) y += cellH;
    }
  }

  // --- Footer ---
  const footerY = totalH - footerH;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(PAD, footerY, contentW, 1);

  const chipCount = Math.min(stats.length, 4);
  if (chipCount > 0) {
    const gap = 12;
    const chipW = (contentW - gap * (chipCount - 1)) / chipCount;
    const chipH = 62;
    const chipY = footerY + 22;
    for (let i = 0; i < chipCount; i++) {
      const cx = PAD + i * (chipW + gap);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      drawRoundedRect(ctx, cx, chipY, chipW, chipH, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      drawRoundedRect(ctx, cx, chipY, chipW, chipH, 8);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(148,163,184,0.75)';
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillText(stats[i].label.toUpperCase(), cx + chipW / 2, chipY + 24);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 20px "Space Grotesk", "JetBrains Mono", sans-serif';
      ctx.fillText(stats[i].value, cx + chipW / 2, chipY + 48);
    }
    ctx.textAlign = 'left';
  }

  // watermark
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(148,163,184,0.55)';
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.fillText(ui.watermark, W / 2, totalH - 26);
  ctx.textAlign = 'left';

  // blit the finished poster to the visible canvas in one synchronous step
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fade-in-up"
      role="dialog"
      aria-modal="true"
      aria-label={ui.replay_label}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-slate-900/80 border border-white/10 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.6)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <canvas
            ref={canvasRef}
            className="w-full h-auto rounded-lg block"
            style={{ imageRendering: 'auto' }}
            aria-label={`${title} — ${endingTitle}`}
          />
          {status === 'rendering' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/60 pointer-events-none">
              <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
              <span className="text-emerald-400 text-sm tracking-widest animate-pulse">{ui.building}</span>
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-rose-300 text-sm px-6 text-center">
              {ui.error}
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-2 p-3 border-t border-white/10 bg-slate-950/60">
          {canShare && (
            <button
              onClick={handleShare}
              disabled={status !== 'ready'}
              className="btn-cyber btn-cyber-primary flex-1 min-w-[120px] py-2.5 font-display font-bold tracking-[0.06em] text-[#04120b] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ui.share}
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={status !== 'ready'}
            className="btn-cyber btn-cyber-ghost flex-1 min-w-[120px] py-2.5 font-display font-bold tracking-[0.06em] text-emerald-200 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ui.download}
          </button>
          {supportsClipboard && (
            <button
              onClick={handleCopy}
              disabled={status !== 'ready'}
              className="h-[42px] px-4 text-[11px] font-bold uppercase tracking-[0.14em] rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            >
              {copied ? ui.copied : '⧉'}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label={ui.close}
            className="h-[42px] px-4 text-[11px] font-bold uppercase tracking-[0.14em] rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default RunComic;
