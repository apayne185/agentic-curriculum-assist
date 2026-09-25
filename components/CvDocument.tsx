import type { CvDocument, CvSection } from "@/lib/cv-schema";

const PAPER_DIMENSIONS_IN: Record<CvDocument["style"]["paperSize"], { width: number; height: number }> = {
  letter: { width: 8.5, height: 11 },
  a4: { width: 8.27, height: 11.69 },
};

export function paperDimensionsIn(paperSize: CvDocument["style"]["paperSize"]) {
  return PAPER_DIMENSIONS_IN[paperSize];
}

type CvDocumentProps = {
  cv: CvDocument;
};

function SectionHeading({ children }: { children: string }) {
  return (
    <h2
      style={{
        fontSize: "1em",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        borderBottom: "1px solid currentColor",
        paddingBottom: "0.15em",
        marginBottom: "0.35em",
      }}
    >
      {children}
    </h2>
  );
}

function EntryBlock({ section, entryIdx }: { section: CvSection; entryIdx: number }) {
  const entry = section.entries![entryIdx];
  return (
    <div style={{ marginBottom: "0.55em" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1em" }}>
        <span style={{ fontWeight: 700 }}>{entry.title}</span>
        {entry.dateRange && (
          <span style={{ whiteSpace: "nowrap", fontStyle: "italic" }}>{entry.dateRange}</span>
        )}
      </div>
      {(entry.subtitle || entry.location) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1em", fontStyle: "italic" }}>
          <span>{entry.subtitle}</span>
          <span style={{ whiteSpace: "nowrap" }}>{entry.location}</span>
        </div>
      )}
      {entry.bullets.length > 0 && (
        <ul style={{ margin: "0.2em 0 0", paddingLeft: "1.2em", listStyleType: "disc" }}>
          {entry.bullets.map((bullet, i) => (
            <li key={i} style={{ marginBottom: "0.12em" }}>
              {bullet}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function hasContent(section: CvSection): boolean {
  if (section.kind === "entries") return (section.entries?.length ?? 0) > 0;
  if (section.kind === "skills") return Boolean(section.skillsLine?.trim());
  return Boolean(section.freeformText?.trim());
}

function SectionBlock({ section }: { section: CvSection }) {
  // A section with no entries/text yet (e.g. just added, not filled in) is
  // still a heading with nothing under it — skip it entirely rather than
  // rendering a bare underlined heading in the preview and the exported PDF.
  if (!section.visible || !hasContent(section)) return null;
  return (
    <section style={{ marginBottom: "var(--section-spacing)" }}>
      <SectionHeading>{section.heading}</SectionHeading>
      {section.kind === "entries" &&
        section.entries?.map((_, idx) => <EntryBlock key={section.entries![idx].id} section={section} entryIdx={idx} />)}
      {section.kind === "skills" && <p style={{ margin: 0 }}>{section.skillsLine}</p>}
      {section.kind === "freeform" && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{section.freeformText}</p>}
    </section>
  );
}

/**
 * Pure, style-driven CV template (Harvard OCS-style single column layout).
 * Rendered identically in the browser preview and in the Playwright PDF
 * export, so on-screen formatting always matches the downloaded PDF.
 */
export default function CvDocumentView({ cv }: CvDocumentProps) {
  const { header, sections, style } = cv;
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const dims = paperDimensionsIn(style.paperSize);

  return (
    <div
      data-cv-page
      style={{
        // CSS custom property consumed by SectionBlock's inline style above.
        ["--section-spacing" as string]: `${style.sectionSpacingPt}pt`,
        width: `${dims.width}in`,
        minHeight: `${dims.height}in`,
        boxSizing: "border-box",
        paddingTop: `${style.marginIn.top}in`,
        paddingRight: `${style.marginIn.right}in`,
        paddingBottom: `${style.marginIn.bottom}in`,
        paddingLeft: `${style.marginIn.left}in`,
        fontFamily: `${style.fontFamily}, serif`,
        fontSize: `${style.fontSizePt}pt`,
        lineHeight: style.lineHeight,
        color: style.accentColor,
        background: "white",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: "var(--section-spacing)" }}>
        <div style={{ fontSize: "1.6em", fontWeight: 700, letterSpacing: "0.03em" }}>{header.name}</div>
        <div style={{ marginTop: "0.2em" }}>{header.contactLine}</div>
        {header.links && header.links.length > 0 && (
          <div style={{ marginTop: "0.1em" }}>{header.links.join(" | ")}</div>
        )}
      </header>
      {sorted.map((section) => (
        <SectionBlock key={section.id} section={section} />
      ))}
    </div>
  );
}
