import { redirect } from "next/navigation";
import Navegacao from "@/components/Navegacao";
import { usuarioAtual } from "@/lib/sessao";

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");

  return (
    <>
      <Navegacao usuario={usuario} />
      <main className="pagina">{children}</main>
    </>
  );
}
