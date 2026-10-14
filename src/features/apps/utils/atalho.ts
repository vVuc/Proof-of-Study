/** Teclas de um evento de teclado no formato do plugin de atalho global ("CommandOrControl+Shift+Space"). */
export function atalhoDoTeclado(e: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'code'>): string | null {
  const tecla = teclaDoCodigo(e.code)
  if (!tecla) return null
  const modificadores = [
    (e.ctrlKey || e.metaKey) && 'CommandOrControl',
    e.altKey && 'Alt',
    e.shiftKey && 'Shift',
  ].filter(Boolean)
  // Sem modificador, o atalho roubaria a tecla de todos os outros apps (exceto F1 a F24).
  if (modificadores.length === 0 && !/^F\d+$/.test(tecla)) return null
  return [...modificadores, tecla].join('+')
}

/** Só letras, números, espaço e teclas de função; modificadores sozinhos não contam. */
function teclaDoCodigo(codigo: string): string | null {
  if (/^Key[A-Z]$/.test(codigo)) return codigo.slice(3)
  if (/^Digit\d$/.test(codigo)) return codigo.slice(5)
  if (/^F\d{1,2}$/.test(codigo)) return codigo
  if (codigo === 'Space') return 'Space'
  return null
}

/** "CommandOrControl+Shift+Space" → "Ctrl + Shift + Espaço". */
export const rotuloDoAtalho = (atalho: string) =>
  atalho
    .split('+')
    .map((p) => (p === 'CommandOrControl' ? 'Ctrl' : p === 'Space' ? 'Espaço' : p))
    .join(' + ')
