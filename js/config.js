export const STATE_ORDER = [
  { name: "Home", slug: "home", route: "#home" },
  { name: "Assam", slug: "assam", route: "#assam" },
  { name: "Bihar", slug: "bihar", route: "#bihar" },
  { name: "Chhattisgarh", slug: "chhattisgarh", route: "#chhattisgarh" },
  { name: "Jharkhand", slug: "jharkhand", route: "#jharkhand" },
  { name: "Madhya Pradesh", slug: "madhya-pradesh", route: "#madhya-pradesh" },
  { name: "Odisha", slug: "odisha", route: "#odisha" },
  { name: "Uttar Pradesh", slug: "uttar-pradesh", route: "#uttar-pradesh" },
];

export const STATE_SLUGS = STATE_ORDER.filter((item) => item.slug !== "home").map(
  (item) => item.slug
);

export const FILE_PATHS = {
  metadata: "data/state_metadata.csv",
  crosswalk: "data/district_name_crosswalk.csv",
  indiaStatesGeojson: "data/geojson/india_states.geojson",
  districtGeojsonDir: "data/geojson/districts",
};

export const MAP_COLORS = {
  muted: "#d9e2ea",
  outline: "#7a93a8",
  focusState: "#d07a3f",
  focusStateSoft: "#efc7aa",
  selected: "#a74723",
  geoReach: ["#eff4f7", "#c8d9e6", "#8fb6cd", "#4f87ab", "#1f5c80"],
  clfReach: ["#f1ede4", "#dfd0b6", "#caae79", "#ad8440", "#8b6023"],
};

export const GEOJSON_PROPERTY_CANDIDATES = {
  district: [
    "district",
    "DISTRICT",
    "dtname",
    "DT_NAME",
    "DIST_NAME",
    "DISTRICT_N",
    "DISTRICT_NAME",
    "NAME_2",
    "name",
  ],
  state: ["state", "STATE", "stname", "ST_NAME", "ST_NM", "STATE_NAME", "NAME_1", "name"],
};

export const CLF_SCOPE_LABELS = {
  full_state_clf_list: "Total CLFs",
  partner_engaged_clfs_only: "CLFs in Available Dataset",
  unknown: "CLFs in Available Dataset",
};

export const CLF_SCOPE_SUBLABELS = {
  full_state_clf_list: "Available state CLF list",
  partner_engaged_clfs_only: "Partner-engaged dataset only",
  unknown: "Scope requires verification",
};

export const HOME_CLF_FOOTNOTE =
  "CLF counts reflect the available dataset. For some states, this may include only CLFs with partner engagement.";

export const CLF_CONCENTRATION_BUCKETS = [
  { label: "0–10 CLFs", min: 0, max: 10, color: MAP_COLORS.clfReach[0] },
  { label: "10–20 CLFs", min: 11, max: 20, color: MAP_COLORS.clfReach[1] },
  { label: "20–30 CLFs", min: 21, max: 30, color: MAP_COLORS.clfReach[2] },
  { label: "30–40 CLFs", min: 31, max: 40, color: MAP_COLORS.clfReach[3] },
  { label: "40+ CLFs", min: 41, max: Infinity, color: MAP_COLORS.clfReach[4] },
];

export const PARTNER_BUCKETS = [
  { label: "No active partner in dataset", min: 0, max: 0, color: MAP_COLORS.geoReach[0] },
  { label: "1 Partner", min: 1, max: 1, color: MAP_COLORS.geoReach[1] },
  { label: "2 Partners", min: 2, max: 2, color: MAP_COLORS.geoReach[2] },
  { label: "3 Partners", min: 3, max: 3, color: MAP_COLORS.geoReach[3] },
  { label: "4+ Partners", min: 4, max: Infinity, color: MAP_COLORS.geoReach[4] },
];

export const REQUIRED_STATE_COLUMNS = [
  "district",
  "block",
  "clf_id",
  "clf_name",
  "partner_organization",
  "project_title",
];
