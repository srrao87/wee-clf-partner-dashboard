let stateComparisonTable = null;
let districtDetailTable = null;

function dataTableBaseConfig() {
  return {
    paging: true,
    pageLength: 10,
    searching: true,
    info: true,
    lengthChange: false,
    autoWidth: false,
    responsive: true,
  };
}

export function initStateComparisonTable(onRowClick) {
  const $ = window.jQuery;
  if (stateComparisonTable) {
    return stateComparisonTable;
  }

  stateComparisonTable = $("#state-comparison-table").DataTable({
    ...dataTableBaseConfig(),
    columns: [
      { title: "State", data: "state" },
      { title: "Districts Covered", data: "districtsCovered" },
      { title: "Partners", data: "partners" },
      { title: "CLFs", data: "clfs" },
    ],
  });

  $("#state-comparison-table tbody").on("click", "tr", function handleRowClick() {
    const data = stateComparisonTable.row(this).data();
    if (data?.state_slug) {
      onRowClick(data.state_slug);
    }
  });

  return stateComparisonTable;
}

export function updateStateComparisonTable(rows) {
  if (!stateComparisonTable) {
    return;
  }
  stateComparisonTable.clear();
  stateComparisonTable.rows.add(rows);
  stateComparisonTable.draw();
}

export function applyStateComparisonSearch(value) {
  if (!stateComparisonTable) {
    return;
  }
  stateComparisonTable.search(value || "").draw();
}

export function initDistrictDetailTable() {
  const $ = window.jQuery;
  if (districtDetailTable) {
    return districtDetailTable;
  }

  districtDetailTable = $("#district-detail-table").DataTable({
    ...dataTableBaseConfig(),
    dom: "Bfrtip",
    buttons: ["csvHtml5", "excelHtml5", "pdfHtml5"],
    columns: [
      { title: "District" },
      { title: "Block" },
      { title: "CLF Name" },
      { title: "Partner Organization" },
      { title: "Project Title" },
    ],
  });

  return districtDetailTable;
}

export function updateDistrictDetailTable(rows) {
  if (!districtDetailTable) {
    return;
  }
  districtDetailTable.clear();
  districtDetailTable.rows.add(
    rows.map((row) => [
      row.district,
      row.block_display,
      row.clf_name_display,
      row.partner_display,
      row.project_display,
    ])
  );
  districtDetailTable.draw();
}
