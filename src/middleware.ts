import type { Nuxt } from '@nuxt/schema'
import { addServerHandler, createResolver } from '@nuxt/kit'
import logger from './runtime/logger'
import { setDefaultSitemapIndexOptions, setDefaultSitemapOptions } from './options'
import type { SitemapOptions, SitemapIndexOptions, GlobalCache } from './module'
import { isSitemapIndex } from './helpers'

/**
 * Register a middleware for each sitemap or sitemapindex
 */
export function registerSitemaps(
  options: SitemapOptions | SitemapIndexOptions,
  globalCache: GlobalCache,
  nuxtInstance: Nuxt,
  depth = 0
) {
  /* istanbul ignore if */
  if (depth > 1) {
    // see https://webmasters.stackexchange.com/questions/18243/can-a-sitemap-index-contain-other-sitemap-indexes
    logger.warn("A sitemap index file can't list other sitemap index files, but only sitemap files")
  }

  if (isSitemapIndex(options)) {
    registerSitemapIndex(options, globalCache, nuxtInstance, depth)
  } else {
    registerSitemap(options, globalCache, nuxtInstance, depth)
  }
}

/**
 * Register a middleware to serve a sitemap
 */
export function registerSitemap(options: SitemapOptions, globalCache: GlobalCache, nuxtInstance: Nuxt, depth = 0) {
  // Init options
  options = setDefaultSitemapOptions(options, nuxtInstance, depth > 0)
  options = prepareOptionPaths(options, nuxtInstance)
  globalCache.options[options.path] = options

  // Allow Nitro to find our files by an alias
  const { resolve } = createResolver(import.meta.url)
  nuxtInstance.options.alias['~sitemap'] = resolve('./')

  if (options.gzip) {
    const _path = options.pathGzip || options.path + '.gz'
    globalCache.options[_path] = options

    // Add server middleware for sitemap.xml.gz
    addServerHandler({
      route: _path,
      handler: resolve('./runtime/sitemap.gzip.mjs'),
    })
  }

  // Add server middleware for sitemap.xml
  addServerHandler({
    route: options.path,
    handler: resolve('./runtime/sitemap.mjs'),
  })
}

/**
 * Register a middleware to serve a sitemapindex
 */
export function registerSitemapIndex(
  options: SitemapIndexOptions,
  globalCache: GlobalCache,
  nuxtInstance: Nuxt,
  depth = 0
) {
  // Init options
  options = setDefaultSitemapIndexOptions(options, nuxtInstance)
  options = prepareOptionPaths(options, nuxtInstance)
  globalCache.options[options.path] = options

  // Allow Nitro to find our files by an alias
  const { resolve } = createResolver(import.meta.url)
  nuxtInstance.options.alias['~sitemap'] = resolve('./')

  if (options.gzip) {
    const _path = options.pathGzip || options.path + '.gz'
    // Add server middleware for sitemapindex.xml.gz
    globalCache.options[_path] = options
    addServerHandler({
      route: _path,
      handler: resolve('./runtime/sitemapindex.gzip.mjs'),
    })
  }

  // Add server middleware for sitemapindex.xml
  addServerHandler({
    route: options.path,
    handler: resolve('./runtime/sitemapindex.mjs'),
  })

  // Register linked sitemaps
  options.sitemaps.forEach((sitemapOptions) => registerSitemaps(sitemapOptions, globalCache, nuxtInstance, depth + 1))
}

function prepareOptionPaths<T extends SitemapOptions | SitemapIndexOptions>(options: T, nuxtInstance: Nuxt): T {
  options.base = nuxtInstance.options.app.baseURL || '/'
  options.path = options.base !== '/' || options.path.startsWith('/') ? options.path : '/' + options.path
  options.pathGzip =
    options.base !== '/' || options.pathGzip.startsWith('/') ? options.pathGzip : '/' + options.pathGzip
  return options
}
