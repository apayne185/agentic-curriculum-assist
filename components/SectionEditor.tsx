import type { CvDocument, CvSection, CvEntry } from "@/lib/cv-schema";

type SectionEditorProps = {
  cv: CvDocument;
  onChange: (cv: CvDocument) => void;
};

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export default function SectionEditor({ cv, onChange }: SectionEditorProps) {
  const sections = [...cv.sections].sort((a, b) => a.order - b.order);

  function updateSections(next: CvSection[]) {
    onChange({ ...cv, sections: next.map((s, idx) => ({ ...s, order: idx })) });
  }

  function updateSection(id: string, patch: Partial<CvSection>) {
    updateSections(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function updateEntry(sectionId: string, entryId: string, patch: Partial<CvEntry>) {
    updateSections(
      sections.map((s) =>
        s.id === sectionId
          ? { ...s, entries: s.entries?.map((e) => (e.id === entryId ? { ...e, ...patch } : e)) }
          : s,
      ),
    );
  }

  function addEntry(sectionId: string) {
    const entry: CvEntry = { id: newId(), title: "New role", bullets: ["New bullet point"] };
    updateSections(
      sections.map((s) => (s.id === sectionId ? { ...s, entries: [...(s.entries ?? []), entry] } : s)),
    );
  }

  function removeEntry(sectionId: string, entryId: string) {
    updateSections(
      sections.map((s) =>
        s.id === sectionId ? { ...s, entries: s.entries?.filter((e) => e.id !== entryId) } : s,
      ),
    );
  }

  function updateBullet(sectionId: string, entryId: string, bulletIdx: number, text: string) {
    updateSections(
      sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              entries: s.entries?.map((e) =>
                e.id === entryId
                  ? { ...e, bullets: e.bullets.map((b, i) => (i === bulletIdx ? text : b)) }
                  : e,
              ),
            }
          : s,
      ),
    );
  }

  function addBullet(sectionId: string, entryId: string) {
    updateSections(
      sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              entries: s.entries?.map((e) =>
                e.id === entryId ? { ...e, bullets: [...e.bullets, "New bullet point"] } : e,
              ),
            }
          : s,
      ),
    );
  }

  function removeBullet(sectionId: string, entryId: string, bulletIdx: number) {
    updateSections(
      sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              entries: s.entries?.map((e) =>
                e.id === entryId ? { ...e, bullets: e.bullets.filter((_, i) => i !== bulletIdx) } : e,
              ),
            }
          : s,
      ),
    );
  }

  function addSection() {
    const section: CvSection = {
      id: newId(),
      heading: "NEW SECTION",
      kind: "entries",
      entries: [],
      order: sections.length,
      visible: true,
    };
    updateSections([...sections, section]);
  }

  function removeSection(id: string) {
    updateSections(sections.filter((s) => s.id !== id));
  }

  function moveSection(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    updateSections(moveItem(sections, idx, target));
  }

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="cv-name" className="block text-sm font-medium mb-1">
          Name
        </label>
        <input
          id="cv-name"
          value={cv.header.name}
          onChange={(e) => onChange({ ...cv, header: { ...cv.header, name: e.target.value } })}
          className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm"
        />
        <label htmlFor="cv-contact-line" className="block text-sm font-medium mb-1 mt-2">
          Contact line
        </label>
        <input
          id="cv-contact-line"
          value={cv.header.contactLine}
          onChange={(e) => onChange({ ...cv, header: { ...cv.header, contactLine: e.target.value } })}
          className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm"
        />
      </div>

      {sections.map((section, idx) => (
        <div key={section.id} className="border border-zinc-200 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <input
              aria-label={`Heading for section: ${section.heading || "untitled"}`}
              value={section.heading}
              onChange={(e) => updateSection(section.id, { heading: e.target.value })}
              className="flex-1 font-semibold text-sm border border-zinc-300 rounded px-2 py-1"
            />
            <button
              type="button"
              title="Move up"
              aria-label={`Move "${section.heading || "untitled"}" section up`}
              onClick={() => moveSection(idx, -1)}
              disabled={idx === 0}
              className="text-zinc-500 disabled:opacity-30 px-1"
            >
              ↑
            </button>
            <button
              type="button"
              title="Move down"
              aria-label={`Move "${section.heading || "untitled"}" section down`}
              onClick={() => moveSection(idx, 1)}
              disabled={idx === sections.length - 1}
              className="text-zinc-500 disabled:opacity-30 px-1"
            >
              ↓
            </button>
            <label className="flex items-center gap-1 text-xs text-zinc-500">
              <input
                type="checkbox"
                aria-label={`Show "${section.heading || "untitled"}" section on the CV`}
                checked={section.visible}
                onChange={(e) => updateSection(section.id, { visible: e.target.checked })}
              />
              visible
            </label>
            <button
              type="button"
              aria-label={`Delete "${section.heading || "untitled"}" section`}
              onClick={() => removeSection(section.id)}
              className="text-xs text-red-600"
            >
              delete
            </button>
          </div>

          {section.kind === "entries" && (
            <div className="space-y-3 pl-2">
              {section.entries?.map((entry) => (
                <div key={entry.id} className="border-l-2 border-zinc-200 pl-2 space-y-1">
                  <div className="flex gap-2">
                    <input
                      value={entry.title}
                      placeholder="Title"
                      aria-label={`Title for entry in ${section.heading || "untitled"} section`}
                      onChange={(e) => updateEntry(section.id, entry.id, { title: e.target.value })}
                      className="flex-1 text-sm border border-zinc-300 rounded px-2 py-1"
                    />
                    <input
                      value={entry.dateRange ?? ""}
                      placeholder="Dates"
                      aria-label={`Dates for "${entry.title || "entry"}"`}
                      onChange={(e) => updateEntry(section.id, entry.id, { dateRange: e.target.value })}
                      className="w-28 text-sm border border-zinc-300 rounded px-2 py-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={entry.subtitle ?? ""}
                      placeholder="Subtitle (company/institution)"
                      aria-label={`Subtitle for "${entry.title || "entry"}"`}
                      onChange={(e) => updateEntry(section.id, entry.id, { subtitle: e.target.value })}
                      className="flex-1 text-sm border border-zinc-300 rounded px-2 py-1"
                    />
                    <input
                      value={entry.location ?? ""}
                      placeholder="Location"
                      aria-label={`Location for "${entry.title || "entry"}"`}
                      onChange={(e) => updateEntry(section.id, entry.id, { location: e.target.value })}
                      className="w-28 text-sm border border-zinc-300 rounded px-2 py-1"
                    />
                  </div>
                  <div className="space-y-1">
                    {entry.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex gap-1 items-start">
                        <textarea
                          value={bullet}
                          onChange={(e) => updateBullet(section.id, entry.id, bIdx, e.target.value)}
                          rows={2}
                          aria-label={`Bullet ${bIdx + 1} for "${entry.title || "entry"}"`}
                          className="flex-1 text-sm border border-zinc-300 rounded px-2 py-1"
                        />
                        <button
                          type="button"
                          aria-label={`Delete bullet ${bIdx + 1} for "${entry.title || "entry"}"`}
                          onClick={() => removeBullet(section.id, entry.id, bIdx)}
                          className="text-xs text-red-600 mt-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      aria-label={`Add a bullet to "${entry.title || "entry"}"`}
                      onClick={() => addBullet(section.id, entry.id)}
                      className="text-xs text-zinc-500"
                    >
                      + add bullet
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete entry "${entry.title || "entry"}"`}
                    onClick={() => removeEntry(section.id, entry.id)}
                    className="text-xs text-red-600"
                  >
                    delete entry
                  </button>
                </div>
              ))}
              <button
                type="button"
                aria-label={`Add an entry to "${section.heading || "untitled"}" section`}
                onClick={() => addEntry(section.id)}
                className="text-xs text-zinc-600"
              >
                + add entry
              </button>
            </div>
          )}

          {section.kind === "skills" && (
            <input
              value={section.skillsLine ?? ""}
              onChange={(e) => updateSection(section.id, { skillsLine: e.target.value })}
              className="w-full text-sm border border-zinc-300 rounded px-2 py-1"
              placeholder="Skills, comma-separated"
              aria-label={`Skills list for "${section.heading || "untitled"}" section`}
            />
          )}

          {section.kind === "freeform" && (
            <textarea
              value={section.freeformText ?? ""}
              aria-label={`Text for "${section.heading || "untitled"}" section`}
              onChange={(e) => updateSection(section.id, { freeformText: e.target.value })}
              rows={3}
              className="w-full text-sm border border-zinc-300 rounded px-2 py-1"
            />
          )}
        </div>
      ))}

      <button type="button" onClick={addSection} className="text-sm text-zinc-700 underline">
        + add section
      </button>
    </div>
  );
}
