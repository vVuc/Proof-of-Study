import { createRootRoute, createRoute, createRouter, Link } from '@tanstack/react-router'
import { AppsPage } from '@/features/apps/AppsPage'
import { AutoanalisePage } from '@/features/autoanalise/AutoanalisePage'
import { BancoPage } from '@/features/banco/BancoPage'
import { HojePage } from '@/features/hoje/HojePage'
import { RelatoPage } from '@/features/relatos/RelatoPage'
import { RotinaPage } from '@/features/rotina/RotinaPage'
import { SessaoPage } from '@/features/sessao/SessaoPage'
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

const hojeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HojePage })
const rotinaRoute = createRoute({ getParentRoute: () => rootRoute, path: '/rotina', component: RotinaPage })

/** `?materia=`: matéria do banco aberta (sem ela, a primeira com meta). */
const bancoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/banco',
  validateSearch: (search: Record<string, unknown>): { materia?: string } =>
    typeof search.materia === 'string' ? { materia: search.materia } : {},
  component: BancoPage,
})

const sessaoRoute = createRoute({ getParentRoute: () => rootRoute, path: '/sessao', component: SessaoPage })

/** `?dia=`: dia lógico do relato final (sem ele, hoje). */
const relatoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/relato',
  validateSearch: (search: Record<string, unknown>): { dia?: string } =>
    typeof search.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.dia) ? { dia: search.dia } : {},
  component: RelatoPage,
})

const autoanaliseRoute = createRoute({ getParentRoute: () => rootRoute, path: '/autoanalise', component: AutoanalisePage })
const appsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/apps', component: AppsPage })

const routeTree = rootRoute.addChildren([hojeRoute, rotinaRoute, bancoRoute, sessaoRoute, relatoRoute, autoanaliseRoute, appsRoute])

export const router = createRouter({ routeTree, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
