import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/sessao";

export default async function Inicio() {
  const usuario = await usuarioAtual();
  redirect(usuario ? "/dashboard" : "/login");
}
