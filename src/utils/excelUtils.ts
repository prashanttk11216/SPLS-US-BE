import * as XLSX from "xlsx";

/**
 * Generates an Excel file from multiple JSON datasets and returns a buffer.
 * @param dataSheets - Object where keys are sheet names and values are arrays of objects to be exported.
 * @returns Buffer containing the Excel file data.
 */
export const generateExcelBuffer = (dataSheets: Record<string, any[]>): Buffer => {
  if (!dataSheets || Object.keys(dataSheets).length === 0) {
    throw new Error("No data provided to export.");
  }

  const workbook = XLSX.utils.book_new();
  let hasValidSheet = false;

  for (const [sheetName, data] of Object.entries(dataSheets)) {
    if (!Array.isArray(data)) {
      throw new Error(`Invalid data format for sheet: ${sheetName}`);
    }

    // Ensure the sheet name is valid
    const validSheetName = sheetName.slice(0, 31).replace(/[\[\]*?:/\\]/g, "_");

    if (data.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(data);

      // Set column widths automatically
      const columnWidths = Object.keys(data[0]).map((key) => ({
        wch: Math.max(key.length, ...data.map((row) => (row[key] ? row[key].toString().length : 0))),
      }));
      worksheet["!cols"] = columnWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, validSheetName);
      hasValidSheet = true;
    }
  }

  if (!hasValidSheet) {
    throw new Error("All provided datasets are empty. At least one sheet must have data.");
  }

  // Generate Excel file as buffer
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
};
