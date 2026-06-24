import { FILE_PATHS, REQUIRED_STATE_COLUMNS } from "./config.js";
import {
  cleanCsvValue,
  dedupeRows,
  deterministicClfId,
  displayClfName,
  slugify,
} from "./utils.js";

function parseCsv(url) {
  return new Promise((resolve, reject) => {
    window.Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data || []),
      error: (error) => reject(error),
    });
  });
}

async function safeLoadCsv(url, warnings, label) {
  try {
    return await parseCsv(url);
  } catch (error) {
    warnings.push(`${label} could not be loaded from ${url}.`);
    console.warn(`Failed loading CSV ${url}`, error);
    return [];
  }
}

function validateColumns(rows, requiredColumns, warnings, label) {
  if (!rows.length) {
    return;
  }
  const columns = Object.keys(rows[0] || {});
  const missing = requiredColumns.filter((column) => !columns.includes(column));
  if (missing.length) {
    warnings.push(`${label} is missing expected columns: ${missing.join(", ")}.`);
  }
}

function normalizeStateRow(row, metadata) {
  const district = cleanCsvValue(row.district);
  const block = cleanCsvValue(row.block);
  const clfName = displayClfName(row.clf_name);
  const providedClfId = cleanCsvValue(row.clf_id);
  const clfId =
    providedClfId ||
    deterministicClfId({
      state: metadata.state,
      district,
      block,
      clfName,
    });

  return {
    state: metadata.state,
    state_slug: metadata.state_slug,
    district,
    block,
    clf_id: clfId,
    clf_name: clfName,
    partner_organization: cleanCsvValue(row.partner_organization),
    project_title: cleanCsvValue(row.project_title),
    project_start_date: cleanCsvValue(row.project_start_date),
    project_end_date: cleanCsvValue(row.project_end_date),
    notes: cleanCsvValue(row.notes),
    clf_data_scope: metadata.clf_data_scope,
    clf_data_note: metadata.clf_data_note,
    row_key: "",
    clf_key: `${metadata.state_slug}::${district}::${clfId}`,
  };
}

export async function loadDashboardData() {
  const warnings = [];
  const metadataRows = await safeLoadCsv(FILE_PATHS.metadata, warnings, "State metadata");
  validateColumns(
    metadataRows,
    ["state", "state_slug", "clf_csv_file", "clf_data_scope", "clf_data_note"],
    warnings,
    "state_metadata.csv"
  );

  const crosswalkRows = await safeLoadCsv(
    FILE_PATHS.crosswalk,
    warnings,
    "District crosswalk"
  );
  validateColumns(
    crosswalkRows,
    ["state", "csv_district", "geojson_district"],
    warnings,
    "district_name_crosswalk.csv"
  );

  const stateMetadata = metadataRows.map((row) => ({
    state: cleanCsvValue(row.state),
    state_slug: cleanCsvValue(row.state_slug) || slugify(row.state),
    clf_csv_file: cleanCsvValue(row.clf_csv_file),
    clf_data_scope: cleanCsvValue(row.clf_data_scope) || "unknown",
    clf_data_note: cleanCsvValue(row.clf_data_note),
  }));

  const rows = [];

  for (const metadata of stateMetadata) {
    const stateRows = await safeLoadCsv(
      metadata.clf_csv_file,
      warnings,
      `${metadata.state} CLF file`
    );
    validateColumns(stateRows, REQUIRED_STATE_COLUMNS, warnings, metadata.clf_csv_file);
    rows.push(...stateRows.map((row) => normalizeStateRow(row, metadata)));
  }

  const dedupedRows = dedupeRows(rows, (row) => {
    const key = [
      row.state,
      row.district,
      row.block,
      row.clf_id,
      row.clf_name,
      row.partner_organization,
      row.project_title,
    ].join("::");
    row.row_key = key;
    return key;
  });

  return {
    metadata: stateMetadata,
    metadataBySlug: Object.fromEntries(
      stateMetadata.map((item) => [item.state_slug, item])
    ),
    rows: dedupedRows,
    rowsByState: stateMetadata.reduce((acc, item) => {
      acc[item.state_slug] = dedupedRows.filter((row) => row.state_slug === item.state_slug);
      return acc;
    }, {}),
    crosswalkRows,
    warnings,
  };
}
