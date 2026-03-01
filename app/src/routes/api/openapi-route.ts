import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env } from 'hono'
import { optionalSessionMiddleware, sessionMiddleware } from '../../middleware/session'

type Method = 'get' | 'post' | 'put' | 'delete' | 'patch'
type AnyHandler = (c: any, next: () => Promise<void>) => any

const isResponseLike = (value: unknown): value is Response => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as any
  return (
    typeof candidate.status === 'number' &&
    candidate.headers instanceof Headers &&
    typeof candidate.arrayBuffer === 'function'
  )
}

const ACTION_VERBS: Record<Method, string> = {
  get: 'Get',
  post: 'Create',
  put: 'Update',
  delete: 'Delete',
  patch: 'Patch',
}

const METHOD_PURPOSES: Record<Method, string> = {
  get: 'Retrieves data',
  post: 'Submits data or triggers an action',
  put: 'Replaces or updates data',
  delete: 'Removes data',
  patch: 'Applies a partial update',
}

const AUTH_SECURITY = [
  { cookieAuth: [] },
  { bearerAuth: [] },
]

const OPTIONAL_AUTH_SECURITY = [
  {},
  ...AUTH_SECURITY,
]

const TITLE_WORDS = new Set(['api', 'id', 'url', 'tmdb', 'sso', 'otp', 'oauth', 'sse'])

const toTitleCase = (value: string): string => {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase()
      if (TITLE_WORDS.has(lower)) return lower.toUpperCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

const extractPathParams = (path: string): string[] => {
  return Array.from(path.matchAll(/:([A-Za-z0-9_]+)/g)).map((m) => m[1])
}

const toPascalCase = (value: string): string => {
  return value
    .split(/[^A-Za-z0-9]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

const buildOperationId = (tag: string, method: Method, path: string): string => {
  const tagPart = toPascalCase(tag)
  const methodPart = method.toLowerCase()
  const pathPart = path
    .replace(/[{}]/g, '')
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      if (seg.startsWith(':')) return `by-${seg.slice(1).replace(/\{[^}]+\}/g, '')}`
      return seg.replace(/\{[^}]+\}/g, '')
    })
    .join('-')

  const suffix = pathPart ? toPascalCase(pathPart) : 'Root'
  return `${methodPart}${tagPart}${suffix}`
}

const describePath = (path: string, includeParams: boolean = true): string => {
  const segments = path
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      if (seg.startsWith(':')) {
        return includeParams ? `by ${toTitleCase(seg.slice(1))}` : ''
      }
      return toTitleCase(seg)
    })
    .filter(Boolean)
  return segments.join(' ')
}

const buildSummary = (tag: string, method: Method, path: string): string => {
  const verb = ACTION_VERBS[method]
  if (tag === 'Gateway') {
    return `${verb} Gateway Request`
  }
  if (path === '/') {
    return `${verb} ${tag}`
  }

  const hasOnlyParams = path
    .split('/')
    .filter(Boolean)
    .every((seg) => seg.startsWith(':'))
  if (hasOnlyParams) {
    const withParams = describePath(path, true)
    return withParams ? `${verb} ${tag} ${withParams}` : `${verb} ${tag}`
  }

  const desc = describePath(path, false) || describePath(path, true)
  return desc ? `${verb} ${desc}` : `${verb} ${tag} Endpoint`
}

const buildDescription = (tag: string, method: Method, path: string): string => {
  if (tag === 'Gateway') {
    return `Local-only sidecar proxy endpoint that forwards allowlisted requests to a configured remote Zentrio server while preserving auth context. Route: \`${method.toUpperCase()} ${path}\`.`
  }

  const paramList = extractPathParams(path)
  const paramInfo = paramList.length > 0
    ? ` Path parameters: ${paramList.map((p) => `\`${p}\``).join(', ')}.`
    : ''
  return `${METHOD_PURPOSES[method]} in the ${tag} API. Route: \`${method.toUpperCase()} ${path}\`.${paramInfo}`
}

const ApiErrorSchema = z.object({
  error: z.string().openapi({ example: 'Unauthorized' }),
}).openapi('ApiError')

const buildDefaultResponses = (withAuthErrors: boolean) => {
  const base: Record<number, any> = {
    200: {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: z.any(),
        },
      },
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorSchema,
        },
      },
    },
  }

  if (withAuthErrors) {
    base[401] = {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ApiErrorSchema,
        },
      },
    }
    base[403] = {
      description: 'Forbidden',
      content: {
        'application/json': {
          schema: ApiErrorSchema,
        },
      },
    }
  }

  return base
}

const inferRouteSecurity = (tag: string, path: string, handlers: AnyHandler[]) => {
  if (handlers.includes(sessionMiddleware as unknown as AnyHandler)) {
    return AUTH_SECURITY
  }

  if (handlers.includes(optionalSessionMiddleware as unknown as AnyHandler)) {
    return OPTIONAL_AUTH_SECURITY
  }

  if (tag === 'User') {
    if (path.startsWith('/settings-profiles')) return OPTIONAL_AUTH_SECURITY
    return AUTH_SECURITY
  }

  if (tag === 'Profiles') {
    return OPTIONAL_AUTH_SECURITY
  }

  if (tag === 'Trakt') {
    if (path === '/available') return undefined
    return OPTIONAL_AUTH_SECURITY
  }

  if (tag === 'Admin') {
    return AUTH_SECURITY
  }

  if (tag === 'Authentication') {
    if (path === '/link-code') return AUTH_SECURITY
    return undefined
  }

  if (tag === 'Sync') {
    if (path === '/token' || path === '/push' || path === '/pull') {
      return AUTH_SECURITY
    }
  }

  return undefined
}

const composeHandlers = (handlers: AnyHandler[]): AnyHandler => {
  return async (c, _next) => {
    let index = -1

    const dispatch = async (i: number): Promise<any> => {
      if (i <= index) {
        throw new Error('next() called multiple times')
      }
      index = i

      const handler = handlers[i]
      if (!handler) {
        return undefined
      }

      const result = await handler(c, () => dispatch(i + 1))

      // Important for middleware compatibility:
      // many Hono middlewares call `await next()` and return `void`.
      // When that happens, we still need to return the finalized response
      // created by downstream handlers.
      if (isResponseLike(result)) {
        c.res = result
        return c.res
      }
      if ((c as any).finalized) return c.res

      return undefined
    }

    const result = await dispatch(0)
    if (isResponseLike(result)) return result
    if ((c as any).finalized) return c.res
    return undefined
  }
}

export const createTaggedOpenAPIRouter = <T extends Env>(app: OpenAPIHono<T>, tag: string) => {
  const native = {
    get: app.get.bind(app),
    post: app.post.bind(app),
    put: app.put.bind(app),
    delete: app.delete.bind(app),
    patch: app.patch.bind(app),
    all: app.all.bind(app),
  }

  const register = (method: Method, path: string, handlers: AnyHandler[]) => {
    if (path.includes('*') || /\{[^}]*[.+*]/.test(path)) {
      // Catch-all routes (wildcards and regex path params like {.+}) are framework
      // passthroughs and not suitable for OpenAPI docs.  Registering them via
      // createRoute strips the regex, breaking multi-segment matching.
      return native[method](path, ...handlers)
    }

    const openApiPath = path.replace(/:([A-Za-z0-9_]+)(\{[^}]+\})?/g, '{$1}')
    const pathParams = extractPathParams(path)

    const request = pathParams.length > 0
      ? {
          params: z.object(
            Object.fromEntries(
              pathParams.map((name) => [
                name,
                z.string().openapi({ description: `Path parameter: ${name}` }),
              ]),
            ),
          ),
        }
      : undefined

    const security = inferRouteSecurity(tag, path, handlers)
    const responses = buildDefaultResponses(Boolean(security))

    const route = createRoute({
      method,
      path: openApiPath,
      tags: [tag],
      operationId: buildOperationId(tag, method, path),
      summary: buildSummary(tag, method, path),
      description: buildDescription(tag, method, path),
      request,
      security,
      responses,
    })

    return app.openapi(route as any, composeHandlers(handlers) as any)
  }

  return {
    get: (path: string, ...handlers: AnyHandler[]) => register('get', path, handlers),
    post: (path: string, ...handlers: AnyHandler[]) => register('post', path, handlers),
    put: (path: string, ...handlers: AnyHandler[]) => register('put', path, handlers),
    delete: (path: string, ...handlers: AnyHandler[]) => register('delete', path, handlers),
    patch: (path: string, ...handlers: AnyHandler[]) => register('patch', path, handlers),
    all: (path: string, ...handlers: AnyHandler[]) => {
      if (path.includes('*')) {
        return native.all(path, ...handlers)
      }
      register('get', path, handlers)
      register('post', path, handlers)
      register('put', path, handlers)
      register('delete', path, handlers)
      register('patch', path, handlers)
      return app
    },
  }
}

export const createTaggedOpenAPIApp = <T extends Env>(tag: string): OpenAPIHono<T> => {
  const app = new OpenAPIHono<T>()
  const routes = createTaggedOpenAPIRouter(app, tag)

  ;(app as any).get = routes.get
  ;(app as any).post = routes.post
  ;(app as any).put = routes.put
  ;(app as any).delete = routes.delete
  ;(app as any).patch = routes.patch
  ;(app as any).all = routes.all

  return app
}

