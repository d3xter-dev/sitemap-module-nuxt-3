import { SitemapIndexOptions, SitemapOptions } from './module'

export function isSitemapIndex(options: SitemapOptions | SitemapIndexOptions): options is SitemapIndexOptions {
  return options && 'sitemaps' in options && Array.isArray(options.sitemaps) && options.sitemaps.length > 0
}
