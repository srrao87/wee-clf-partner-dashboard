import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import {
  CLF_CONCENTRATION_BUCKETS,
  FILE_PATHS,
  MAP_COLORS,
  PARTNER_BUCKETS,
} from "./config.js";
import {
  formatNumber,
  getDistrictNameFromFeature,
  getStateNameFromFeature,
  normalizeString,
  createDistrictMatcher,
} from "./utils.js";

const geojsonCache = new Map();

function loadGeojson(url) {
  if (geojsonCache.has(url)) {
    return geojsonCache.get(url);
  }

  const request = fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load ${url}`);
    }
    return response.json();
  });

  geojsonCache.set(url, request);
  return request;
}

function colorByBuckets(value, buckets, fallback = MAP_COLORS.muted) {
  const match = buckets.find((bucket) => value >= bucket.min && value <= bucket.max);
  return match ? match.color : fallback;
}

function clearContainer(container) {
  container.innerHTML = "";
  container.style.position = "relative";
}

function createTooltip(container) {
  const tooltip = document.createElement("div");
  tooltip.className = "svg-map-tooltip";
  tooltip.style.position = "absolute";
  tooltip.style.pointerEvents = "none";
  tooltip.style.opacity = "0";
  container.appendChild(tooltip);
  return tooltip;
}

function showTooltip(tooltip, container, event, html) {
  const bounds = container.getBoundingClientRect();
  tooltip.innerHTML = html;
  tooltip.style.left = `${event.clientX - bounds.left + 12}px`;
  tooltip.style.top = `${event.clientY - bounds.top + 12}px`;
  tooltip.style.opacity = "1";
}

function hideTooltip(tooltip) {
  tooltip.style.opacity = "0";
}

function renderLegend(container, title, buckets) {
  const legend = document.createElement("div");
  legend.className = "legend-card";
  legend.innerHTML = `<strong>${title}</strong>`;

  buckets.forEach((bucket) => {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span class="legend-swatch" style="background:${bucket.color}"></span>
      <span>${bucket.label}</span>
    `;
    legend.appendChild(row);
  });

  container.appendChild(legend);
}

function renderSvgMap({
  container,
  geojson,
  fillAccessor,
  strokeAccessor,
  strokeWidthAccessor,
  opacityAccessor,
  tooltipAccessor,
  clickAccessor,
}) {
  clearContainer(container);

  const tooltip = createTooltip(container);
  const width = Math.max(container.clientWidth || 0, 640);
  const height = Math.max(container.clientHeight || 0, 420);

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("class", "svg-map");

  const projection = d3.geoMercator().fitSize([width - 10, height - 10], geojson);
  const path = d3.geoPath(projection);

  svg
    .append("g")
    .selectAll("path")
    .data(geojson.features)
    .join("path")
    .attr("d", path)
    .attr("fill", fillAccessor)
    .attr("stroke", strokeAccessor)
    .attr("stroke-width", strokeWidthAccessor)
    .attr("opacity", opacityAccessor)
    .style("cursor", clickAccessor ? "pointer" : "default")
    .on("mousemove", function onMouseMove(event, feature) {
      if (!tooltipAccessor) {
        return;
      }
      showTooltip(tooltip, container, event, tooltipAccessor(feature));
    })
    .on("mouseleave", function onMouseLeave() {
      hideTooltip(tooltip);
    })
    .on("click", function onClick(event, feature) {
      if (clickAccessor) {
        clickAccessor(feature);
      }
    });
}

export async function renderHomeMap({ stateStats, matchedStateSlugs, messageTarget }) {
  const container = document.getElementById("india-map");

  try {
    const geojson = await loadGeojson(FILE_PATHS.indiaStatesGeojson);
    const statsBySlug = Object.fromEntries(stateStats.map((item) => [item.state_slug, item]));

    renderSvgMap({
      container,
      geojson,
      fillAccessor: (feature) => {
        const name = getStateNameFromFeature(feature);
        const slug = normalizeString(name).replace(/\s+/g, "-");
        const isFocus = Boolean(statsBySlug[slug]);
        if (!isFocus) {
          return "#ece7d7";
        }
        return matchedStateSlugs.has(slug) ? MAP_COLORS.focusState : MAP_COLORS.focusStateSoft;
      },
      strokeAccessor: (feature) => {
        const name = getStateNameFromFeature(feature);
        const slug = normalizeString(name).replace(/\s+/g, "-");
        return statsBySlug[slug] ? "#ffffff" : "#cfc8b7";
      },
      strokeWidthAccessor: (feature) => {
        const name = getStateNameFromFeature(feature);
        const slug = normalizeString(name).replace(/\s+/g, "-");
        return statsBySlug[slug] ? 1.8 : 1;
      },
      opacityAccessor: () => 1,
      tooltipAccessor: (feature) => {
        const name = getStateNameFromFeature(feature);
        const slug = normalizeString(name).replace(/\s+/g, "-");
        const stats = statsBySlug[slug];
        if (!stats) {
          return `<strong>${name}</strong>`;
        }
        return `<strong>${stats.state}</strong><br>Districts covered: ${formatNumber(
          stats.districtsCovered
        )}<br>Partner organizations: ${formatNumber(
          stats.partners
        )}<br>CLFs in dataset: ${formatNumber(stats.clfs)}`;
      },
      clickAccessor: (feature) => {
        const name = getStateNameFromFeature(feature);
        const slug = normalizeString(name).replace(/\s+/g, "-");
        if (statsBySlug[slug]) {
          window.location.hash = `#${slug}`;
        }
      },
    });

    renderLegend(container, "Focus states", [
      { label: "Covered state", color: MAP_COLORS.focusState },
      { label: "Other state", color: "#ece7d7" },
    ]);

    messageTarget.classList.add("hidden");
    messageTarget.textContent = "";
  } catch (error) {
    console.warn("Home map could not be rendered.", error);
    messageTarget.textContent = "India state boundary file not found.";
    messageTarget.className = "inline-message error";
  }
}

export async function renderStateDistrictMap({
  slug,
  stateName,
  containerId,
  crosswalkRows,
  districtStats,
  mapType,
  selectedDistrict,
  selectedDistrictCallback,
  messageTarget,
}) {
  const container = document.getElementById(containerId);
  const matcher = createDistrictMatcher(crosswalkRows);

  try {
    const geojson = await loadGeojson(`${FILE_PATHS.districtGeojsonDir}/${slug}.geojson`);
    const features = Array.isArray(geojson.features) ? geojson.features : [];

    if (!features.length || !districtStats.length) {
      clearContainer(container);
      messageTarget.textContent = "No CLFs found for the current filters.";
      messageTarget.className = "inline-message warning";
      return;
    }

    const geoDistrictNames = features.map((feature) => getDistrictNameFromFeature(feature));
    const unmatched = districtStats
      .map((item) => item.district)
      .filter((district) => district && !matcher(stateName, district, geoDistrictNames));

    if (unmatched.length) {
      messageTarget.textContent =
        "Some districts in the CSV could not be matched to the map boundaries. Check `district_name_crosswalk.csv`.";
      messageTarget.className = "inline-message warning";
    } else {
      messageTarget.classList.add("hidden");
      messageTarget.textContent = "";
    }

    const statByGeoDistrict = new Map();
    districtStats.forEach((item) => {
      const matchedName = matcher(stateName, item.district, geoDistrictNames);
      if (matchedName) {
        statByGeoDistrict.set(matchedName, item);
      }
    });

    renderSvgMap({
      container,
      geojson,
      fillAccessor: (feature) => {
        const districtName = getDistrictNameFromFeature(feature);
        const stat = statByGeoDistrict.get(districtName);
        const value = mapType === "partner" ? stat?.activePartners || 0 : stat?.clfs || 0;
        return colorByBuckets(
          value,
          mapType === "partner" ? PARTNER_BUCKETS : CLF_CONCENTRATION_BUCKETS,
          "#e7e1d1"
        );
      },
      strokeAccessor: (feature) => {
        const districtName = getDistrictNameFromFeature(feature);
        const stat = statByGeoDistrict.get(districtName);
        return stat?.district === selectedDistrict ? "#ffffff" : "#d0c8b9";
      },
      strokeWidthAccessor: (feature) => {
        const districtName = getDistrictNameFromFeature(feature);
        const stat = statByGeoDistrict.get(districtName);
        return stat?.district === selectedDistrict ? 2.2 : 1.1;
      },
      opacityAccessor: (feature) => {
        const districtName = getDistrictNameFromFeature(feature);
        const stat = statByGeoDistrict.get(districtName);
        if (!selectedDistrict) {
          return stat ? 1 : 0.55;
        }
        return stat?.district === selectedDistrict ? 1 : 0.42;
      },
      tooltipAccessor: (feature) => {
        const districtName = getDistrictNameFromFeature(feature);
        const stat = statByGeoDistrict.get(districtName);
        if (mapType === "partner") {
          return `<strong>${districtName}</strong><br>Active Partners: ${formatNumber(
            stat?.activePartners || 0
          )}`;
        }
        return `<strong>${districtName}</strong><br>CLFs: ${formatNumber(stat?.clfs || 0)}`;
      },
      clickAccessor: (feature) => {
        const districtName = getDistrictNameFromFeature(feature);
        const stat = statByGeoDistrict.get(districtName);
        if (stat?.district) {
          selectedDistrictCallback(stat.district);
        }
      },
    });

    renderLegend(
      container,
      mapType === "partner" ? "Active partners" : "CLF concentration",
      mapType === "partner" ? PARTNER_BUCKETS : CLF_CONCENTRATION_BUCKETS
    );
  } catch (error) {
    console.warn(`District map for ${slug} could not be rendered.`, error);
    messageTarget.textContent = "District boundary file not found for this state.";
    messageTarget.className = "inline-message error";
  }
}
