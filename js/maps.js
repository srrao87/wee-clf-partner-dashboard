import {
  CLF_CONCENTRATION_BUCKETS,
  FILE_PATHS,
  MAP_COLORS,
  PARTNER_BUCKETS,
} from "./config.js";
import {
  createDistrictMatcher,
  formatNumber,
  getDistrictNameFromFeature,
  getStateNameFromFeature,
  normalizeString,
} from "./utils.js";

const geojsonCache = new Map();
const mapRegistry = {
  home: null,
  state: {},
};

function createMap(containerId, options = {}) {
  return window.L.map(containerId, {
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: false,
    ...options,
  });
}

async function loadGeojson(url) {
  if (geojsonCache.has(url)) {
    return geojsonCache.get(url);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  const data = await response.json();
  geojsonCache.set(url, data);
  return data;
}

function colorByBuckets(value, buckets, fallback = MAP_COLORS.muted) {
  const match = buckets.find((bucket) => value >= bucket.min && value <= bucket.max);
  return match ? match.color : fallback;
}

function renderLegend(map, title, buckets) {
  const legend = window.L.control({ position: "bottomright" });
  legend.onAdd = function onAdd() {
    const div = window.L.DomUtil.create("div", "legend-card");
    div.innerHTML = `<strong>${title}</strong>`;
    buckets.forEach((bucket) => {
      div.innerHTML += `
        <div class="legend-row">
          <span class="legend-swatch" style="background:${bucket.color}"></span>
          <span>${bucket.label}</span>
        </div>
      `;
    });
    return div;
  };
  legend.addTo(map);
  return legend;
}

function bindTooltip(layer, html) {
  layer.bindTooltip(`<div class="map-tooltip">${html}</div>`, {
    sticky: true,
    direction: "top",
  });
}

function focusMapBounds(map, layer, selectedLayer = null) {
  const targetBounds = selectedLayer ? selectedLayer.getBounds() : layer.getBounds();
  map.fitBounds(targetBounds, { padding: [16, 16], maxZoom: selectedLayer ? 8 : undefined });
}

export async function initHomeMap(onStateClick) {
  if (mapRegistry.home) {
    return mapRegistry.home;
  }

  const map = createMap("india-map", { minZoom: 4, maxZoom: 8 });
  mapRegistry.home = {
    map,
    onStateClick,
    layer: null,
  };
  return mapRegistry.home;
}

export async function renderHomeMap({ stateStats, matchedStateSlugs, messageTarget }) {
  const registry = await initHomeMap((slug) => {
    window.location.hash = slug === "home" ? "#home" : `#${slug}`;
  });

  try {
    const geojson = await loadGeojson(FILE_PATHS.indiaStatesGeojson);
    if (registry.layer) {
      registry.map.removeLayer(registry.layer);
    }

    const statsBySlug = Object.fromEntries(stateStats.map((item) => [item.state_slug, item]));
    registry.layer = window.L.geoJSON(geojson, {
      style: (feature) => {
        const name = getStateNameFromFeature(feature);
        const slug = normalizeString(name).replace(/\s+/g, "-");
        const isFocus = Boolean(statsBySlug[slug]);
        const isMatch = matchedStateSlugs.has(slug);
        return {
          color: MAP_COLORS.outline,
          weight: isFocus ? 1.4 : 0.8,
          fillOpacity: isFocus ? 0.8 : 0.35,
          fillColor: isFocus
            ? isMatch
              ? MAP_COLORS.focusState
              : MAP_COLORS.focusStateSoft
            : MAP_COLORS.muted,
        };
      },
      onEachFeature: (feature, layer) => {
        const name = getStateNameFromFeature(feature);
        const slug = normalizeString(name).replace(/\s+/g, "-");
        const stats = statsBySlug[slug];
        if (stats) {
          bindTooltip(
            layer,
            `<strong>${stats.state}</strong><br>Districts covered: ${formatNumber(
              stats.districtsCovered
            )}<br>Partner organizations: ${formatNumber(
              stats.partners
            )}<br>CLFs in available dataset: ${formatNumber(stats.clfs)}`
          );
          layer.on("click", () => registry.onStateClick(slug));
        }
      },
    }).addTo(registry.map);

    focusMapBounds(registry.map, registry.layer);
    messageTarget.classList.add("hidden");
    messageTarget.textContent = "";
  } catch (error) {
    console.warn("Home map could not be rendered.", error);
    messageTarget.textContent = "India state boundary file not found.";
    messageTarget.className = "inline-message error";
  }
}

async function ensureStateMap(slug, containerId) {
  if (mapRegistry.state[containerId]) {
    return mapRegistry.state[containerId];
  }

  const map = createMap(containerId, { minZoom: 5, maxZoom: 10 });
  mapRegistry.state[containerId] = {
    map,
    layer: null,
    legend: null,
    currentSlug: slug,
  };
  return mapRegistry.state[containerId];
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
  const registry = await ensureStateMap(slug, containerId);
  const matcher = createDistrictMatcher(crosswalkRows);

  try {
    const geojson = await loadGeojson(`${FILE_PATHS.districtGeojsonDir}/${slug}.geojson`);
    const features = Array.isArray(geojson.features) ? geojson.features : [];

    if (registry.layer) {
      registry.map.removeLayer(registry.layer);
      registry.layer = null;
    }
    if (registry.legend) {
      registry.map.removeControl(registry.legend);
      registry.legend = null;
    }

    if (!features.length || !districtStats.length) {
      messageTarget.textContent = "No CLFs found for the current filters.";
      messageTarget.className = "inline-message warning";
      return;
    }

    const geoDistrictNames = features.map((feature) => getDistrictNameFromFeature(feature));
    const unmatched = districtStats
      .map((item) => item.district)
      .filter((district) => district && !matcher(stateName, district, geoDistrictNames));

    if (unmatched.length) {
      console.warn("District matching issue", slug, unmatched);
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

    let selectedFeatureLayer = null;

    registry.layer = window.L.geoJSON(geojson, {
      style: (feature) => {
        const districtName = getDistrictNameFromFeature(feature);
        const stat = statByGeoDistrict.get(districtName);
        const isSelected = selectedDistrict && stat?.district === selectedDistrict;
        const value = mapType === "partner" ? stat?.activePartners || 0 : stat?.clfs || 0;
        const color = colorByBuckets(
          value,
          mapType === "partner" ? PARTNER_BUCKETS : CLF_CONCENTRATION_BUCKETS
        );
        return {
          color: isSelected ? MAP_COLORS.selected : MAP_COLORS.outline,
          weight: isSelected ? 2.4 : 1.2,
          fillColor: color,
          fillOpacity: stat ? 0.88 : 0.35,
        };
      },
      onEachFeature: (feature, layer) => {
        const districtName = getDistrictNameFromFeature(feature);
        const stat = statByGeoDistrict.get(districtName);
        if (selectedDistrict && stat?.district === selectedDistrict) {
          selectedFeatureLayer = layer;
        }
        const fallbackValue = mapType === "partner" ? 0 : 0;
        const value = mapType === "partner" ? stat?.activePartners : stat?.clfs;
        bindTooltip(
          layer,
          mapType === "partner"
            ? `<strong>${districtName}</strong><br>Active Partners: ${formatNumber(
                value ?? fallbackValue
              )}`
            : `<strong>${districtName}</strong><br>CLFs: ${formatNumber(value ?? fallbackValue)}`
        );
        layer.on("click", () => {
          if (stat?.district) {
            selectedDistrictCallback(stat.district);
          }
        });
      },
    }).addTo(registry.map);

    registry.legend = renderLegend(
      registry.map,
      mapType === "partner" ? "Active partners" : "CLF concentration",
      mapType === "partner" ? PARTNER_BUCKETS : CLF_CONCENTRATION_BUCKETS
    );

    focusMapBounds(registry.map, registry.layer, selectedFeatureLayer);
    window.setTimeout(() => registry.map.invalidateSize(), 0);
  } catch (error) {
    console.warn(`District map for ${slug} could not be rendered.`, error);
    messageTarget.textContent = "District boundary file not found for this state.";
    messageTarget.className = "inline-message error";
  }
}
