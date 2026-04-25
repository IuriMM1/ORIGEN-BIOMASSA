import { redirect } from "next/navigation";

/** Cadastro por lote não é utilizado; mantém a rota antiga sem UI. */
export default function LotesPage() {
  redirect("/");
}
