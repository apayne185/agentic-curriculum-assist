import { notFound } from "next/navigation";
import CvDocumentView from "@/components/CvDocument";
import { cvDocumentSchema } from "@/lib/cv-schema";

export const dynamic = "force-dynamic";

export default async function PrintCvPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { data } = await searchParams;
  if (!data) notFound();

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
  } catch {
    notFound();
  }

  const result = cvDocumentSchema.safeParse(parsed);
  if (!result.success) notFound();

  return <CvDocumentView cv={result.data} />;
}
