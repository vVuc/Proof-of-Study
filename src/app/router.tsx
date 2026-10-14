import { createRootRoute, createRoute, createRouter, Link } from '@tanstack/react-router'
import { paraISO, type DataISO } from '@/shared/lib/datas'
import { AppsPage } from '@/features/apps/AppsPage'
import { BancoPage } from '@/features/banco/BancoPage'
import { AnotacaoDiaPage } from '@/features/dia/AnotacaoDiaPage'
import { HojePage } from '@/features/dia/HojePage'
import { HistoricoPage } from '@/features/historico/HistoricoPage'
import { RotinaPage } from '@/features/rotina/RotinaPage'
import { AppLayout } from './layout/AppLayout'

const rootRoute = createRootRoute({
  component: AppLayout,
  notFoundComponent: () => (
    <p className="text-muted-foreground">
      Página não encontrada.{' '}
      <Link to="/" className="underline">
        Voltar para hoje
      </Link>
    </p>
  ),
})

/** O app abre no dia de hoje: o plano (na primeira abertura do dia) e os objetivos com play/pause. */
const hojeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HojePage })

/** `?data=`: dia a anotar (sem ela, hoje). */
const diaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dia',
  validateSearch: (search: Record<string, unknown>): { data: DataISO } => ({
    data: typeof search.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.data) ? search.data : paraISO(new Date()),
  }),
  component: AnotacaoDiaPage,
})

const rotinaRoute = createRoute({ getParentRoute: () => rootRoute, path: '/rotina', component: RotinaPage })

/** `?materia=`: matéria do banco aberta (sem ela, a primeira com meta). */
const bancoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/banco',
  validateSearch: (search: Record<string, unknown>): { materia?: string } =>
    typeof search.materia === 'string' ? { materia: search.materia } : {},
  component: BancoPage,
})

const historicoRoute = createRoute({ getParentRoute: () => rootRoute, path: '/historico', component: HistoricoPage })
const appsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/apps', component: AppsPage })

const routeTree = rootRoute.addChildren([hojeRoute, diaRoute, rotinaRoute, bancoRoute, historicoRoute, appsRoute])

export const router = createRouter({ routeTree, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
