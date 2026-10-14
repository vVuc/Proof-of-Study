import { describe, expect, it } from 'vitest'
import { atalhoDoTeclado, rotuloDoAtalho } from './atalho'

const tecla = (code: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey', boolean>> = {}) => ({
  code,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
})

describe('atalhoDoTeclado', () => {
  it('monta a combinação no formato do plugin', () => {
    expect(atalhoDoTeclado(tecla('Space', { ctrlKey: true, shiftKey: true }))).toBe('CommandOrControl+Shift+Space')
    expect(atalhoDoTeclado(tecla('KeyP', { altKey: true }))).toBe('Alt+P')
  })

  it('recusa tecla comum sem modificador, mas aceita F1 a F24', () => {
    expect(atalhoDoTeclado(tecla('KeyP'))).toBeNull()
    expect(atalhoDoTeclado(tecla('F9'))).toBe('F9')
  })

  it('ignora modificador sozinho', () => {
    expect(atalhoDoTeclado(tecla('ShiftLeft', { shiftKey: true }))).toBeNull()
  })

  it('mostra o atalho em português', () => {
    expect(rotuloDoAtalho('CommandOrControl+Shift+Space')).toBe('Ctrl + Shift + Espaço')
  })
})
