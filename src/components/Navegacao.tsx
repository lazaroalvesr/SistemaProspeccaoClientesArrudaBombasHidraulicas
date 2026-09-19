"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/types";

export default function Navegacao({ usuario }: { usuario: SessionUser }) {
  const caminho = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  const itens = [
    { href: "/dashboard", rotulo: "Visão geral", icone: "dashboard" },
    { href: "/buscar", rotulo: "Buscar empresas", icone: "buscar" },
    { href: "/leads", rotulo: "Meus leads", icone: "leads" },
    ...(usuario.role === "admin"
      ? [{ href: "/admin", rotulo: "Usuários", icone: "usuarios" }]
      : []),
  ];

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <div className="barra-mobile">
        <div className="marca" aria-label="Arruda Bombas, prospecção">
          Arruda <span>Bombas</span>
        </div>
        <button
          type="button"
          className="menu-toggle btn-neutro"
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          aria-expanded={aberto}
          aria-controls="menu-principal"
          onClick={() => setAberto(!aberto)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d={aberto ? "M5 5l14 14M19 5L5 19" : "M4 7h16M4 12h16M4 17h16"} />
          </svg>
        </button>
      </div>
      {aberto && <button className="menu-fundo" aria-label="Fechar menu" onClick={() => setAberto(false)} />}
    <aside id="menu-principal" className={`barra ${aberto ? "aberto" : ""}`}>
      <div className="barra-interna">
        <div className="marca" aria-label="Arruda Bombas, prospecção">
          Arruda <span>Bombas</span>
          <small>PROSPECÇÃO</small>
        </div>
        <div className="menu-titulo">MENU PRINCIPAL</div>
        <nav className="menu" aria-label="Navegação principal">
          {itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAberto(false)}
              className={caminho.startsWith(item.href) ? "ativo" : ""}
              aria-current={caminho.startsWith(item.href) ? "page" : undefined}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {item.icone === "dashboard" && <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></>}
                {item.icone === "buscar" && <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2" /></>}
                {item.icone === "leads" && <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></>}
                {item.icone === "usuarios" && <><circle cx="9" cy="8" r="3" /><path d="M3.5 19v-2a5.5 5.5 0 0 1 11 0v2M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 5" /></>}
              </svg>
              {item.rotulo}
            </Link>
          ))}
        </nav>
        <div className="barra-rodape">
          <span className="avatar" aria-hidden="true">{usuario.name.charAt(0).toUpperCase()}</span>
          <span className="quem"><strong>{usuario.name}</strong><small>{usuario.role === "admin" ? "Administrador" : "Vendedor"}</small></span>
          <button className="btn-sair" onClick={sair} aria-label="Sair da conta" title="Sair da conta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 16l4-4-4-4M19 12H9" /></svg>
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
