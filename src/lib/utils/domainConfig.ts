export const CURRENT_MIRROR_INDEX = 3; // Change this to 4, 5, etc. whenever a domain gets struck
export const BASE_DOMAIN = "cinevault.xyz";
export const getActiveCatalogUrl = () => `${CURRENT_MIRROR_INDEX}movie.${BASE_DOMAIN}`;
export const getSubdomainForIndex = (index: number) => `${index}movie.${BASE_DOMAIN}`;
