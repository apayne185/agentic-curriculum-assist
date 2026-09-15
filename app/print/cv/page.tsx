import { notFound } from "next/navigation";
import CvDocumentView from "@/components/CvDocument";
import { takeForPrint } from "@/lib/print-cache";

export const dynamic = "force-dynamic";

export default async function PrintCvPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const cv = token ? takeForPrint(token) : null;
  if (!cv) notFound();

  return <CvDocumentView cv={cv} />;
}
