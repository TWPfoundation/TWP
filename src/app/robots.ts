import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thewprotocol.online';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/auth/', '/dashboard/', '/gate/', '/instrument/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
