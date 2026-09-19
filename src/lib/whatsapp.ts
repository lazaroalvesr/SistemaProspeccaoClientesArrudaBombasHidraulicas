/** Reduz o telefone ao formato E.164 brasileiro (55DDNNNNNNNNN). */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  let d = bruto.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length === 8 || d.length === 9) return null; // sem DDD, nao da para discar
  if (d.length < 10 || d.length > 11) return null;
  return `55${d}`;
}

/** Celular brasileiro: 11 digitos com o nono digito 9. Fixo nao tem WhatsApp. */
export function ehCelular(e164: string | null): boolean {
  if (!e164) return false;
  const nacional = e164.slice(2);
  return nacional.length === 11 && nacional[2] === "9";
}

export function formatarTelefone(e164: string | null): string {
  if (!e164) return "—";
  const n = e164.slice(2);
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return e164;
}

export function mensagemPadrao(empresa: string) {
  return (
    `Olá, ${empresa}! Falo da Arruda Bombas. ` +
    `Trabalhamos com bombas e equipamentos para concreto e gostaria de entender ` +
    `como está a operação de vocês hoje. Posso te mandar algumas informações?`
  );
}

/** Abre a conversa no WhatsApp com a mensagem já digitada. O envio é sempre manual. */
export function linkWhatsapp(e164: string | null, empresa: string): string | null {
  if (!e164) return null;
  return `https://wa.me/${e164}?text=${encodeURIComponent(mensagemPadrao(empresa))}`;
}
