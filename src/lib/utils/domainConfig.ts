export const CURRENT_MIRROR_INDEX = 3; // Change this to 4, 5, etc. whenever a domain gets struck
export const BASE_DOMAIN = "cinevault.xyz";
export const getActiveCatalogUrl = () => `${CURRENT_MIRROR_INDEX}movie.${BASE_DOMAIN}`;
export const getSubdomainForIndex = (index: number) => `${index}movie.${BASE_DOMAIN}`;

// ---- vercel.app mirror setup (added 2026-11-13, on Uzair's order) ----
// Same landing/mirror split as the .xyz setup, using *.vercel.app hosts:
// the landing lives on the landing hosts, the catalog on the numbered mirror host.
export const VERCEL_MIRROR_HOST = "3movie-cinevault.vercel.app";
export const VERCEL_LANDING_HOSTS = ["cinevault786.vercel.app"];

export const isMirrorHostname = (hostname: string) =>
  /movie\.cinevault\.xyz$/i.test(hostname) || hostname === VERCEL_MIRROR_HOST;

// Cross-domain "Explore Movies" target for landing hosts; null = same-domain catalog.
export const getCrossDomainCatalogUrl = (hostname: string): string | null => {
  if (hostname === BASE_DOMAIN || hostname === `www.${BASE_DOMAIN}`)
    return `https://${getActiveCatalogUrl()}/?view=catalog`;
  if (VERCEL_LANDING_HOSTS.includes(hostname))
    return `https://${VERCEL_MIRROR_HOST}/?view=catalog`;
  return null;
};
