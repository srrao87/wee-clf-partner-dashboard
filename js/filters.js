import { cleanCsvValue, normalizeString } from "./utils.js";

const routeFallback = "home";

const store = {
  route: routeFallback,
  universalSearch: "",
  stateFilters: {},
  selectedDistricts: {},
  selectedPartners: {},
  selectedClfs: {},
};

function defaultFilterState() {
  return {
    district: "",
    partner: "",
    clf: "",
    project: "",
  };
}

export function getRouteFromHash(hash) {
  const value = cleanCsvValue(hash || window.location.hash).replace(/^#/, "");
  return value || routeFallback;
}

export function setRoute(route) {
  store.route = route || routeFallback;
}

export function getRoute() {
  return store.route;
}

export function setUniversalSearch(value) {
  store.universalSearch = cleanCsvValue(value);
}

export function getUniversalSearch() {
  return store.universalSearch;
}

export function getStateFilters(slug) {
  if (!store.stateFilters[slug]) {
    store.stateFilters[slug] = defaultFilterState();
  }
  return store.stateFilters[slug];
}

export function updateStateFilter(slug, key, value) {
  const current = getStateFilters(slug);
  current[key] = cleanCsvValue(value);
}

export function clearStateFilters(slug) {
  store.stateFilters[slug] = defaultFilterState();
  store.selectedDistricts[slug] = "";
  store.selectedPartners[slug] = "";
  store.selectedClfs[slug] = "";
}

export function toggleSelectedDistrict(slug, district) {
  const next = store.selectedDistricts[slug] === district ? "" : district;
  store.selectedDistricts[slug] = next;
}

export function setSelectedDistrict(slug, district) {
  store.selectedDistricts[slug] = district || "";
}

export function getSelectedDistrict(slug) {
  return store.selectedDistricts[slug] || "";
}

export function toggleSelectedPartner(slug, partner) {
  const next = store.selectedPartners[slug] === partner ? "" : partner;
  store.selectedPartners[slug] = next;
}

export function getSelectedPartner(slug) {
  return store.selectedPartners[slug] || "";
}

export function setSelectedClf(slug, clfKey) {
  store.selectedClfs[slug] = clfKey || "";
}

export function getSelectedClf(slug) {
  return store.selectedClfs[slug] || "";
}

function rowMatchesUniversalSearch(row, searchValue) {
  if (!searchValue) {
    return true;
  }
  const haystack = normalizeString(
    [row.district, row.clf_name, row.partner_organization, row.project_title].join(" ")
  );
  return haystack.includes(normalizeString(searchValue));
}

export function applyBaseFilters(rows, slug) {
  const stateFilters = getStateFilters(slug);
  const universalSearch = getUniversalSearch();
  return rows.filter((row) => {
    if (!rowMatchesUniversalSearch(row, universalSearch)) {
      return false;
    }
    if (stateFilters.district && row.district !== stateFilters.district) {
      return false;
    }
    if (stateFilters.partner && row.partner_organization !== stateFilters.partner) {
      return false;
    }
    if (stateFilters.clf && row.clf_key !== stateFilters.clf) {
      return false;
    }
    if (stateFilters.project && row.project_title !== stateFilters.project) {
      return false;
    }
    return true;
  });
}

export function applyDistrictDetailFocus(rows, slug) {
  let focusedRows = [...rows];
  const selectedPartner = getSelectedPartner(slug);
  const selectedDistrict = getSelectedDistrict(slug);
  const selectedClf = getSelectedClf(slug);

  if (selectedPartner) {
    focusedRows = focusedRows.filter((row) => row.partner_organization === selectedPartner);
  }
  if (selectedDistrict) {
    focusedRows = focusedRows.filter((row) => row.district === selectedDistrict);
  }
  if (selectedClf) {
    focusedRows = focusedRows.filter((row) => row.clf_key === selectedClf);
  }
  return focusedRows;
}

export function hasFilterSelection(slug) {
  const filters = getStateFilters(slug);
  return Boolean(
    getUniversalSearch() ||
      filters.district ||
      filters.partner ||
      filters.clf ||
      filters.project
  );
}
