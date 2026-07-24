function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents || "{}");

  sheet.appendRow([
    data.submittedAt || new Date().toISOString(),
    data.fullName || "",
    data.guestCount || "",
    data.guestDetails || "",
    data.mealPreference || "",
    data.glutenFreeCeliac || "",
    data.nuts || "",
    data.allergies || "",
    data.dietaryDetails || data.dietary || ""
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
