import { FORMA_PAGINA, type FormaDaPagina } from '@/shared/lib/formas'

export type RotaMenu = '/' | '/rotina' | '/banco' | '/sessao' | '/relato' | '/autoanalise' | '/apps'

/** Abas da barra lateral. A forma é a mesma do título de cada tela. */
export const ITENS_MENU: { to: RotaMenu; rotulo: string; forma: FormaDaPagina }[] = [
  { to: '/', rotulo: 'Hoje', forma: FORMA_PAGINA.hoje },
  { to: '/rotina', rotulo: 'Rotina', forma: FORMA_PAGINA.rotina },
  { to: '/banco', rotulo: 'Banco de horas', forma: FORMA_PAGINA.banco },
  { to: '/sessao', rotulo: 'Sessão', forma: FORMA_PAGINA.sessao },
  { to: '/relato', rotulo: 'Relato', forma: FORMA_PAGINA.relato },
  { to: '/autoanalise', rotulo: 'Autoanálise', forma: FORMA_PAGINA.autoanalise },
  { to: '/apps', rotulo: 'Apps e sites', forma: FORMA_PAGINA.apps },
]
