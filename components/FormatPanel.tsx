import { FONT_FAMILIES, PAPER_SIZES, type CvStyle } from "@/lib/cv-schema";

type FormatPanelProps = {
  style: CvStyle;
  onChange: (style: CvStyle) => void;
  onAutofit: () => void;
  autofitting: boolean;
  overflowing: boolean | null;
};

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-zinc-600">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        // While typing, let the field hold whatever value the user is
        // mid-way through entering (e.g. "1" on the way to "12") — the
        // browser's min/max only affect the spinner arrows, not typing, so
        // clamp on blur instead of every keystroke. Otherwise an
        // out-of-range style would pass the live preview fine but fail PDF
        // export server-side with an opaque "Invalid cv" error, since the
        // schema enforces these same bounds.
        onChange={(e) => onChange(Number(e.target.value))}
        onBlur={(e) => onChange(clamp(Number(e.target.value), min, max))}
        className="w-20 border border-zinc-300 rounded px-2 py-1 text-right"
      />
    </label>
  );
}

export default function FormatPanel({ style, onChange, onAutofit, autofitting, overflowing }: FormatPanelProps) {
  const set = (patch: Partial<CvStyle>) => onChange({ ...style, ...patch });
  const setMargin = (side: keyof CvStyle["marginIn"], v: number) =>
    onChange({ ...style, marginIn: { ...style.marginIn, [side]: v } });

  return (
    <div className="space-y-6">
      {overflowing && (
        <div className="rounded border border-amber-300 bg-amber-50 text-amber-900 text-sm p-3">
          <p className="font-medium mb-2">This doesn&apos;t fit on one page.</p>
          <button
            type="button"
            onClick={onAutofit}
            disabled={autofitting}
            className="w-full bg-amber-900 text-white rounded px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {autofitting ? "Fitting…" : "Fit to one page"}
          </button>
        </div>
      )}

      <div>
        <h3 className="font-medium text-sm mb-2">Font</h3>
        <select
          value={style.fontFamily}
          onChange={(e) => set({ fontFamily: e.target.value as CvStyle["fontFamily"] })}
          className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm mb-2"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <div className="space-y-1.5">
          <NumberField
            label="Size (pt)"
            value={style.fontSizePt}
            min={8}
            max={13}
            step={0.5}
            onChange={(v) => set({ fontSizePt: v })}
          />
          <NumberField
            label="Line spacing"
            value={style.lineHeight}
            min={0.9}
            max={1.5}
            step={0.05}
            onChange={(v) => set({ lineHeight: v })}
          />
          <NumberField
            label="Section spacing (pt)"
            value={style.sectionSpacingPt}
            min={2}
            max={24}
            step={1}
            onChange={(v) => set({ sectionSpacingPt: v })}
          />
        </div>
      </div>

      <div>
        <h3 className="font-medium text-sm mb-2">Margins (in)</h3>
        <div className="space-y-1.5">
          <NumberField label="Top" value={style.marginIn.top} min={0.3} max={1.5} step={0.05} onChange={(v) => setMargin("top", v)} />
          <NumberField label="Right" value={style.marginIn.right} min={0.3} max={1.5} step={0.05} onChange={(v) => setMargin("right", v)} />
          <NumberField label="Bottom" value={style.marginIn.bottom} min={0.3} max={1.5} step={0.05} onChange={(v) => setMargin("bottom", v)} />
          <NumberField label="Left" value={style.marginIn.left} min={0.3} max={1.5} step={0.05} onChange={(v) => setMargin("left", v)} />
        </div>
      </div>

      <div>
        <h3 className="font-medium text-sm mb-2">Paper size</h3>
        <select
          value={style.paperSize}
          onChange={(e) => set({ paperSize: e.target.value as CvStyle["paperSize"] })}
          className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm"
        >
          {PAPER_SIZES.map((p) => (
            <option key={p} value={p}>
              {p === "letter" ? "US Letter" : "A4"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
