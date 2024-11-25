import path from 'path'
import { gzipSync } from 'zlib'
// eslint-disable-next-line import/default
import fs from 'fs-extra'
import type { Nuxt } from '@nuxt/schema'
import { createSitemap, createSitemapIndex } from './runtime/builder'
import { createRoutesCache } from './runtime/cache'
import logger from './runtime/logger'
import { setDefaultSitemapIndexOptions, setDefaultSitemapOptions } from './options'
import { excludeRoutes } from './runtime/routes'
import { ModuleOptions, SitemapIndexOptions, SitemapOptions, GlobalCache } from './module'
import { isSitemapIndex } from './helpers'

/**
 * Generate a static file for each sitemap or sitemapindex
 */
export async function generateSitemaps(
  options: ModuleOptions,
  globalCache: GlobalCache,
  nuxtInstance: Nuxt,
  depth = 0
): Promise<void> {
  /* istanbul ignore if */
  if (depth > 1) {
    // see https://webmasters.stackexchange.com/questions/18243/can-a-sitemap-index-contain-other-sitemap-indexes
    logger.warn("A sitemap index file can't list other sitemap index files, but only sitemap files")
  }

  if (!nuxtInstance.options.generate?.dir) {
    nuxtInstance.options.generate.dir = nuxtInstance.options.srcDir
  }

  const publicDir = '/.output/public'

  if (isSitemapIndex(options)) {
    await generateSitemapIndex(options, globalCache, nuxtInstance, depth, publicDir)
  } else {
    await generateSitemap(options, globalCache, nuxtInstance, depth, publicDir)
  }
}

/**
 * Generate a sitemap file
 */
export async function generateSitemap(
  options: SitemapOptions,
  globalCache: GlobalCache,
  nuxtInstance: Nuxt,
  depth = 0,
  publicDir: string
): Promise<void> {
  // Init options
  options = setDefaultSitemapOptions(options, nuxtInstance, depth > 0)

  // Init cache
  const cache = { staticRoutes: null, routes: null }
  cache.staticRoutes = () => excludeRoutes(options.exclude, globalCache.staticRoutes)
  cache.routes = createRoutesCache(cache, options)

  // Generate sitemap.xml
  const routes = await cache.routes.get('routes')
  const base = nuxtInstance.options.router.base
  const sitemap = await createSitemap(options, routes, base)
  const xmlFilePath = path.join(nuxtInstance.options.generate.dir, publicDir, options.path)
  fs.outputFileSync(xmlFilePath, sitemap.toXML())
  logger.success('Generated', getPathname(nuxtInstance.options.generate.dir, xmlFilePath))

  // Generate sitemap.xml.gz
  if (options.gzip) {
    const gzipFilePath = path.join(nuxtInstance.options.generate.dir, publicDir, options.pathGzip)
    fs.outputFileSync(gzipFilePath, sitemap.toGzip())
    logger.success('Generated', getPathname(nuxtInstance.options.generate.dir, gzipFilePath))
  }
}

/**
 * Generate a sitemapindex file
 */
export async function generateSitemapIndex(
  options: SitemapIndexOptions,
  globalCache: GlobalCache,
  nuxtInstance: Nuxt,
  depth = 0,
  publicDir: string
): Promise<void> {
  // Init options
  options = setDefaultSitemapIndexOptions(options, nuxtInstance)

  // Generate sitemapindex.xml
  const base = nuxtInstance.options.router.base
  const xml = createSitemapIndex(options, base)
  const xmlFilePath = path.join(nuxtInstance.options.generate.dir, publicDir, options.path)
  fs.outputFileSync(xmlFilePath, xml)
  logger.success('Generated', getPathname(nuxtInstance.options.generate.dir, xmlFilePath))

  // Generate sitemapindex.xml.gz
  if (options.gzip) {
    const gzip = gzipSync(xml)
    const gzipFilePath = path.join(nuxtInstance.options.generate.dir, publicDir, options.pathGzip)
    fs.outputFileSync(gzipFilePath, gzip)
    logger.success('Generated', getPathname(nuxtInstance.options.generate.dir, gzipFilePath))
  }

  // Generate linked sitemaps
  await Promise.all(
    options.sitemaps.map((sitemapOptions) => generateSitemaps(sitemapOptions, globalCache, nuxtInstance, depth + 1))
  )
}

/**
 * Convert a file path to a URL pathname
 */
function getPathname(dirPath: string, filePath: string): string {
  return [, ...path.relative(dirPath, filePath).split(path.sep)].join('/')
}
