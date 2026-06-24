import {
  CLF_SCOPE_LABELS,
  CLF_SCOPE_SUBLABELS,
  HOME_CLF_FOOTNOTE,
  STATE_ORDER,
  STATE_SLUGS,
} from "./config.js";
import { loadDashboardData } from "./data-loader.js";
import {
  applyBaseFilters,
  applyDistrictDetailFocus,
  clearStateFilters,
  getRoute,
  getRouteFromHash,
  getSelectedClf,
  getSelectedDistrict,
  getSelectedPartner,
  getUniversalSearch,
  getStateFilters,
  hasFilterSelection,
  setRoute,
  setSelectedClf,
  setSelectedDistrict,
  setUniversalSearch,
  toggleSelectedDistrict,
  toggleSelectedPartner,
  updateStateFilter,
} from "./filters.js";
import { renderHomeMap, renderStateDistrictMap } from "./maps.js";
import {
  initDistrictDetailTable,
  initStateComparisonTable,
  applyStateComparisonSearch,
  updateDistrictDetailTable,
  updateStateComparisonTable,
} from "./tables.js";
import {
  cleanCsvValue,
  debounce,
  displayBlock,
  displayClfName,
  displayPartner,
  displayProject,
  formatNumber,
  groupBy,
  hasActiveFilters,
  sortAlpha,
  uniqueValues,
} from "./utils.js";

const els = {
  loading: document.getElementById("app-loading"),
  error: document.getElementById("app-error"),
  homeView: document.getElementById("home-view"),
  stateView: document.getElementById("state-view"),
  navTabs: document.getElementById("nav-tabs"),
  universalSearch: document.getElementById("universal-search"),
  searchStatus: document.getElementById("search-status"),
  nationalKpis: document.getElementById("national-kpis"),
  homeFootnotes: document.getElementById("home-footnotes"),
  indiaMapMessage: document.getElementById("india-map-message"),
  statePageTitle: document.getElementById("state-page-title"),
  stateCoverageNote: document.getElementById("state-coverage-note"),
  stateFilterBar: document.getElementById("state-filter-bar"),
  stateKpis: document.getElementById("state-kpis"),
  stateKpiNote: document.getElementById("state-kpi-note"),
  partnerDirectory: document.getElementById("partner-directory"),
  hotspotList: document.getElementById("hotspot-list"),
  sharedDirectory: document.getElementById("shared-clf-directory"),
  districtSummary: document.getElementById("district-details-summary"),
  geographicMapMessage: document.getElementById("geographic-map-message"),
  clfMapMessage: document.getElementById("clf-map-message"),
  geographicMapSummary: document.getElementById("geographic-map-summary"),
  clfMapSummary: document.getElementById("clf-map-summary"),
};

let dashboardData = null;

function countUniqueClfs(rows) {
  return new Set(rows.map((row) => row.clf_key)).size;
}

function rowsWithPartners(rows) {
  return rows.filter((row) => cleanCsvValue(row.partner_organization));
}

function getStateSummaryRows(allRows, metadata) {
  return metadata.map((stateMeta) => {
    const stateRows = allRows.filter((row) => row.state_slug === stateMeta.state_slug);
    const engagedRows = rowsWithPartners(stateRows);
    return {
      state: stateMeta.state,
      state_slug: stateMeta.state_slug,
      districtsCovered: new Set(engagedRows.map((row) => `${row.state_slug}::${row.district}`))
        .size,
      partners: new Set(
        engagedRows.map((row) => row.partner_organization).filter(Boolean)
      ).size,
      clfs: countUniqueClfs(stateRows),
    };
  });
}

function createKpiCard({ label, value, meta = "", filtered = false }) {
  return `
    <article class="kpi-card">
      <div class="label">${label}</div>
      <div class="value">${formatNumber(value)}</div>
      ${meta ? `<div class="meta">${meta}</div>` : ""}
      ${filtered ? `<div class="filtered-pill">Filtered view</div>` : ""}
    </article>
  `;
}

function renderNav(currentRoute) {
  els.navTabs.innerHTML = STATE_ORDER.map((item) => {
    const active = currentRoute === item.slug ? "active" : "";
    return `<a class="nav-link ${active}" href="${item.route}" role="tab" aria-selected="${
      currentRoute === item.slug
    }">${item.name}</a>`;
  }).join("");
}

function renderHome(allRows) {
  const search = cleanCsvValue(getUniversalSearch());
  const stateSummaryRows = getStateSummaryRows(allRows, dashboardData.metadata);
  const matchedStates =
    search.length > 0
      ? new Set(
          allRows
            .filter((row) =>
              [row.district, row.clf_name, row.partner_organization, row.project_title]
                .join(" ")
                .toLowerCase()
                .includes(search.toLowerCase())
            )
            .map((row) => row.state_slug)
        )
      : new Set(stateSummaryRows.map((item) => item.state_slug));
  const matchedStateSlugs = new Set(
    [...matchedStates]
  );

  const engagedRows = rowsWithPartners(allRows);
  const clfsFootnoteNeeded = dashboardData.metadata.some((item) =>
    ["partner_engaged_clfs_only", "unknown"].includes(item.clf_data_scope)
  );

  els.nationalKpis.innerHTML = [
    createKpiCard({ label: "States Covered", value: 7 }),
    createKpiCard({
      label: "Districts Covered",
      value: new Set(engagedRows.map((row) => `${row.state_slug}::${row.district}`)).size,
    }),
    createKpiCard({
      label: "Partner Organizations",
      value: new Set(engagedRows.map((row) => row.partner_organization)).size,
    }),
    createKpiCard({
      label: "Cluster Level Federations (CLFs)",
      value: countUniqueClfs(allRows),
      meta: clfsFootnoteNeeded ? HOME_CLF_FOOTNOTE : "",
    }),
  ].join("");

  els.homeFootnotes.innerHTML = dashboardData.warnings
    .map((warning) => `<div class="footnote">${warning}</div>`)
    .join("");

  updateStateComparisonTable(
    search ? stateSummaryRows.filter((row) => matchedStateSlugs.has(row.state_slug)) : stateSummaryRows
  );
  applyStateComparisonSearch("");
  renderHomeMap({
    stateStats: stateSummaryRows,
    matchedStateSlugs,
    messageTarget: els.indiaMapMessage,
  });
}

function buildStateFilterOptions(rows) {
  return {
    district: sortAlpha(uniqueValues(rows, (row) => row.district)),
    partner: sortAlpha(uniqueValues(rows, (row) => row.partner_organization)),
    clf: rows
      .map((row) => ({ key: row.clf_key, label: `${row.clf_name} (${row.district})` }))
      .filter(
        (item, index, self) =>
          item.key &&
          self.findIndex((candidate) => candidate.key === item.key) === index
      )
      .sort((a, b) => a.label.localeCompare(b.label)),
    project: sortAlpha(uniqueValues(rows, (row) => row.project_title)),
  };
}

function renderFilterBar(stateSlug, stateRows) {
  const filters = getStateFilters(stateSlug);
  const options = buildStateFilterOptions(stateRows);
  els.stateFilterBar.innerHTML = `
    <div class="filter-group">
      <label for="filter-district">District</label>
      <select id="filter-district" aria-label="Filter by district">
        <option value="">All districts</option>
        ${options.district.map((value) => `<option value="${value}" ${
          filters.district === value ? "selected" : ""
        }>${value}</option>`).join("")}
      </select>
    </div>
    <div class="filter-group">
      <label for="filter-partner">Partner Organization</label>
      <select id="filter-partner" aria-label="Filter by partner organization">
        <option value="">All partners</option>
        ${options.partner.map((value) => `<option value="${value}" ${
          filters.partner === value ? "selected" : ""
        }>${value}</option>`).join("")}
      </select>
    </div>
    <div class="filter-group">
      <label for="filter-clf">CLF</label>
      <select id="filter-clf" aria-label="Filter by CLF">
        <option value="">All CLFs</option>
        ${options.clf.map((item) => `<option value="${item.key}" ${
          filters.clf === item.key ? "selected" : ""
        }>${item.label}</option>`).join("")}
      </select>
    </div>
    <div class="filter-group">
      <label for="filter-project">Project Title</label>
      <select id="filter-project" aria-label="Filter by project title">
        <option value="">All projects</option>
        ${options.project.map((value) => `<option value="${value}" ${
          filters.project === value ? "selected" : ""
        }>${value || "Not specified"}</option>`).join("")}
      </select>
    </div>
    <div class="filter-group">
      <label for="clear-filters">Actions</label>
      <button id="clear-filters" type="button" aria-label="Clear all filters">Clear All Filters</button>
    </div>
  `;

  ["district", "partner", "clf", "project"].forEach((key) => {
    document.getElementById(`filter-${key}`).addEventListener("change", (event) => {
      updateStateFilter(stateSlug, key, event.target.value);
      setSelectedClf(stateSlug, "");
      render();
    });
  });

  document.getElementById("clear-filters").addEventListener("click", () => {
    clearStateFilters(stateSlug);
    render();
  });
}

function getSharedClfGroups(rows) {
  const grouped = groupBy(rows, (row) => row.clf_key);
  return [...grouped.entries()]
    .map(([clfKey, clfRows]) => {
      const partners = sortAlpha(uniqueValues(clfRows, (row) => row.partner_organization));
      return {
        clfKey,
        clfName: clfRows[0]?.clf_name || "Unnamed CLF",
        district: clfRows[0]?.district || "",
        partners,
        rows: clfRows,
      };
    })
    .filter((item) => item.partners.length >= 2)
    .sort((a, b) => a.clfName.localeCompare(b.clfName));
}

function buildDistrictStats(rows, hotspotRows = []) {
  const allDistricts = sortAlpha(uniqueValues(rows, (row) => row.district));
  return allDistricts.map((district) => {
    const districtRows = rows.filter((row) => row.district === district);
    const partnerRows = rowsWithPartners(districtRows);
    const hotspotClfKeys = new Set(
      hotspotRows.filter((item) => item.district === district).map((item) => item.clfKey)
    );
    const hotspotPartners = new Set(
      hotspotRows
        .filter((item) => item.district === district)
        .flatMap((item) => item.partners)
    );
    return {
      district,
      activePartners: new Set(partnerRows.map((row) => row.partner_organization)).size,
      clfs: countUniqueClfs(districtRows),
      hotspots: hotspotClfKeys.size,
      hotspotPartners: hotspotPartners.size,
    };
  });
}

function renderStateView(stateSlug) {
  const stateMeta = dashboardData.metadataBySlug[stateSlug];
  const stateRows = dashboardData.rowsByState[stateSlug] || [];
  const baseRows = applyBaseFilters(stateRows, stateSlug);
  const focusedRows = applyDistrictDetailFocus(baseRows, stateSlug);
  const sharedClfs = getSharedClfGroups(baseRows);
  const districtStats = buildDistrictStats(baseRows, sharedClfs);
  const selectedDistrict = getSelectedDistrict(stateSlug);
  const selectedPartner = getSelectedPartner(stateSlug);
  const selectedClf = getSelectedClf(stateSlug);
  const filterApplied = hasFilterSelection(stateSlug);

  els.statePageTitle.textContent = stateMeta.state;
  els.stateCoverageNote.textContent = stateMeta.clf_data_note;
  renderFilterBar(stateSlug, stateRows);

  const hotspotCount = sharedClfs.length;
  const activePartnerRows = rowsWithPartners(baseRows);

  els.stateKpis.innerHTML = [
    createKpiCard({
      label: "Districts Covered",
      value: new Set(activePartnerRows.map((row) => row.district)).size,
      filtered: filterApplied,
    }),
    createKpiCard({
      label: "Active Partner Organizations",
      value: new Set(activePartnerRows.map((row) => row.partner_organization)).size,
      filtered: filterApplied,
    }),
    createKpiCard({
      label: CLF_SCOPE_LABELS[stateMeta.clf_data_scope],
      value: countUniqueClfs(baseRows),
      meta: CLF_SCOPE_SUBLABELS[stateMeta.clf_data_scope],
      filtered: filterApplied,
    }),
    createKpiCard({
      label: "CLF Hotspots",
      value: hotspotCount,
      meta: "CLFs with two or more partner organizations",
      filtered: filterApplied,
    }),
  ].join("");

  els.stateKpiNote.textContent =
    stateMeta.clf_data_scope === "full_state_clf_list"
      ? "CLF concentration uses the available state CLF list."
      : stateMeta.clf_data_note;

  const partnerDirectoryRows = [...groupBy(activePartnerRows, (row) => row.partner_organization).entries()]
    .map(([partner, partnerRows]) => ({
      partner,
      districts: new Set(partnerRows.map((row) => row.district)).size,
      clfs: countUniqueClfs(partnerRows),
    }))
    .sort((a, b) => a.partner.localeCompare(b.partner));

  els.partnerDirectory.innerHTML = partnerDirectoryRows.length
    ? partnerDirectoryRows
        .map(
          (item) => `
          <button class="directory-item ${selectedPartner === item.partner ? "active" : ""}" type="button" data-partner="${item.partner}" aria-pressed="${
            selectedPartner === item.partner
          }">
            <strong>${item.partner}</strong>
            <div class="directory-meta">${formatNumber(item.districts)} districts covered | ${formatNumber(item.clfs)} CLFs engaged</div>
          </button>`
        )
        .join("")
    : `<div class="empty-state-card">No partner engagement recorded for this selection.</div>`;

  els.partnerDirectory.querySelectorAll("[data-partner]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleSelectedPartner(stateSlug, button.dataset.partner);
      render();
    });
  });

  const hotspotDistricts = districtStats
    .filter((item) => item.hotspots > 0)
    .sort((a, b) => b.hotspots - a.hotspots || a.district.localeCompare(b.district));

  els.hotspotList.innerHTML = hotspotDistricts.length
    ? hotspotDistricts
        .map(
          (item) => `
          <button class="hotspot-item ${selectedDistrict === item.district ? "active" : ""}" type="button" data-district="${item.district}" aria-pressed="${
            selectedDistrict === item.district
          }">
            <strong>${item.district}</strong>
            <div class="hotspot-meta">${formatNumber(item.hotspots)} Shared CLFs | ${formatNumber(item.hotspotPartners)} Partners</div>
          </button>`
        )
        .join("")
    : `<div class="empty-state-card">No shared CLFs found for the current selection.</div>`;

  els.hotspotList.querySelectorAll("[data-district]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleSelectedDistrict(stateSlug, button.dataset.district);
      setSelectedClf(stateSlug, "");
      render();
    });
  });

  els.sharedDirectory.innerHTML = sharedClfs.length
    ? sharedClfs
        .map(
          (item) => `
          <button class="shared-clf-item ${selectedClf === item.clfKey ? "active" : ""}" type="button" data-clf="${item.clfKey}" data-district="${item.district}" aria-pressed="${
            selectedClf === item.clfKey
          }">
            <strong>${item.clfName}</strong>
            <div class="shared-clf-meta">District: ${item.district}</div>
            <div class="shared-clf-meta">Partners: ${item.partners.join(", ")}</div>
          </button>`
        )
        .join("")
    : `<div class="empty-state-card">No shared CLFs found for the current selection.</div>`;

  els.sharedDirectory.querySelectorAll("[data-clf]").forEach((button) => {
    button.addEventListener("click", () => {
      setSelectedDistrict(stateSlug, button.dataset.district);
      setSelectedClf(stateSlug, button.dataset.clf);
      render();
    });
  });

  const detailRows = focusedRows.length ? focusedRows : baseRows;
  const detailTableRows = detailRows.map((row) => ({
    ...row,
    block_display: displayBlock(row.block),
    clf_name_display: displayClfName(row.clf_name),
    partner_display: displayPartner(row.partner_organization),
    project_display: displayProject(row.project_title),
  }));

  if (!baseRows.length) {
    els.districtSummary.className = "district-summary empty-state";
    els.districtSummary.textContent = "No CLFs found for the current filters.";
  } else if (!selectedDistrict && !detailTableRows.length) {
    els.districtSummary.className = "district-summary empty-state";
    els.districtSummary.textContent =
      "Select a district on either map or use the filters to view district-level details.";
  } else if (!selectedDistrict && filterApplied) {
    els.districtSummary.className = "district-summary";
    els.districtSummary.textContent = `Filtered view. Showing ${formatNumber(
      detailTableRows.length
    )} detail rows across ${formatNumber(
      new Set(detailTableRows.map((row) => row.district)).size
    )} districts.`;
  } else if (!selectedDistrict && selectedPartner) {
    els.districtSummary.className = "district-summary";
    els.districtSummary.textContent = `Partner focus: ${selectedPartner}. Showing ${formatNumber(
      detailTableRows.length
    )} detail rows across ${formatNumber(
      new Set(detailTableRows.map((row) => row.district)).size
    )} districts.`;
  } else if (selectedDistrict) {
    const districtRows = baseRows.filter((row) => row.district === selectedDistrict);
    els.districtSummary.className = "district-summary";
    els.districtSummary.textContent = `${selectedDistrict} | ${formatNumber(
      countUniqueClfs(districtRows)
    )} CLFs | ${formatNumber(
      new Set(rowsWithPartners(districtRows).map((row) => row.partner_organization)).size
    )} Active Partners${filterApplied ? " | Filtered view" : ""}`;
  } else {
    els.districtSummary.className = "district-summary empty-state";
    els.districtSummary.textContent =
      "Select a district on either map or use the filters to view district-level details.";
  }

  updateDistrictDetailTable(detailTableRows);

  const geoMapRows = selectedPartner
    ? baseRows.filter((row) => row.partner_organization === selectedPartner)
    : baseRows;
  const geoDistrictStats = buildDistrictStats(geoMapRows, sharedClfs);

  renderStateDistrictMap({
    slug: stateSlug,
    stateName: stateMeta.state,
    containerId: "geographic-map",
    crosswalkRows: dashboardData.crosswalkRows,
    districtStats: geoDistrictStats,
    mapType: "partner",
    selectedDistrict,
    selectedDistrictCallback: (district) => {
      toggleSelectedDistrict(stateSlug, district);
      setSelectedClf(stateSlug, "");
      render();
    },
    messageTarget: els.geographicMapMessage,
  });

  renderStateDistrictMap({
    slug: stateSlug,
    stateName: stateMeta.state,
    containerId: "clf-map",
    crosswalkRows: dashboardData.crosswalkRows,
    districtStats,
    mapType: "clf",
    selectedDistrict,
    selectedDistrictCallback: (district) => {
      toggleSelectedDistrict(stateSlug, district);
      setSelectedClf(stateSlug, "");
      render();
    },
    messageTarget: els.clfMapMessage,
  });

  els.geographicMapSummary.textContent = selectedPartner
    ? `Partner focus: ${selectedPartner}. District shading reflects only this partner's active districts.`
    : "District shading reflects the number of distinct partner organizations active in each district.";

  els.clfMapSummary.textContent =
    stateMeta.clf_data_scope === "full_state_clf_list"
      ? "District shading reflects the available state CLF distribution."
      : "District shading reflects CLFs in the available dataset and should not be interpreted as the full state CLF universe.";
}

function renderSearchStatus() {
  const route = getRoute();
  const search = cleanCsvValue(els.universalSearch.value);
  if (!search) {
    els.searchStatus.textContent = "";
    return;
  }

  if (route === "home") {
    const matches = dashboardData.rows.filter((row) =>
      [row.district, row.clf_name, row.partner_organization, row.project_title]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    ).length;
    els.searchStatus.textContent = `${formatNumber(matches)} matching rows`;
    return;
  }

  const rows = applyBaseFilters(dashboardData.rowsByState[route] || [], route);
  els.searchStatus.textContent = `${formatNumber(rows.length)} matching rows`;
}

function render() {
  const route = getRoute();
  renderNav(route);
  renderSearchStatus();

  els.loading.classList.add("hidden");
  els.error.classList.add("hidden");

  if (route === "home") {
    els.homeView.classList.remove("hidden");
    els.stateView.classList.add("hidden");
    renderHome(dashboardData.rows);
    return;
  }

  if (!STATE_SLUGS.includes(route)) {
    window.location.hash = "#home";
    return;
  }

  els.homeView.classList.add("hidden");
  els.stateView.classList.remove("hidden");
  renderStateView(route);
}

function bindGlobalEvents() {
  window.addEventListener("hashchange", () => {
    setRoute(getRouteFromHash(window.location.hash));
    render();
  });

  const onSearch = debounce((event) => {
    setUniversalSearch(event.target.value);
    render();
  }, 220);
  els.universalSearch.addEventListener("input", onSearch);
}

async function init() {
  try {
    dashboardData = await loadDashboardData();
    initStateComparisonTable((stateSlug) => {
      window.location.hash = `#${stateSlug}`;
    });
    initDistrictDetailTable();

    setRoute(getRouteFromHash(window.location.hash || "#home"));
    bindGlobalEvents();
    render();
  } catch (error) {
    console.error(error);
    els.loading.classList.add("hidden");
    els.error.classList.remove("hidden");
    els.error.textContent = "The dashboard could not load. Check the browser console for details.";
  }
}

init();
