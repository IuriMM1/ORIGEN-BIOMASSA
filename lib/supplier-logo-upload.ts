import { supabase } from "@/lib/supabase";

const BUCKET = "supplier-logos";

const extFromMime = (mime: string) => {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
};

/** Faz upload da logo para `supplier-logos/{supplierId}/logo.{ext}` e devolve a URL pública. */
export async function uploadSupplierLogo(supplierId: string, file: File): Promise<string> {
  const ext = extFromMime(file.type || "image/jpeg");
  const path = `${supplierId}/logo.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
    cacheControl: "3600",
  });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Não foi possível obter a URL pública da logo.");
  return data.publicUrl;
}
