import { useState } from "react";

type NotesBoxProps = {
  onRetailor: (notes: string) => Promise<void>;
  busy: boolean;
};

export default function NotesBox({ onRetailor, busy }: NotesBoxProps) {
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">Additional notes</h3>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="e.g. emphasize my leadership experience, mention I'm relocating, shorten the skills section…"
        className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        disabled={busy || !notes.trim()}
        onClick={async () => {
          await onRetailor(notes.trim());
          setNotes("");
        }}
        className="w-full bg-zinc-900 text-white rounded px-3 py-1.5 text-sm disabled:opacity-40"
      >
        {busy ? "Re-tailoring…" : "Apply & re-tailor"}
      </button>
    </div>
  );
}
