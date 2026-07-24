function appendGuestRow(sheet, meta, guest) {
  var allergies = guest.allergies || "";
  if (Array.isArray(allergies)) {
    allergies = allergies.join(", ");
  }

  sheet.appendRow([
    meta.submittedAt,
    meta.fullName,
    meta.guestCount,
    guest.name || "",
    guest.mealPreference || "",
    guest.glutenFreeCeliac || "",
    guest.nuts || "",
    allergies,
    guest.dietary || guest.dietaryDetails || ""
  ]);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents || "{}");
  var meta = {
    submittedAt: data.submittedAt || new Date().toISOString(),
    fullName: data.fullName || "",
    guestCount: data.guestCount || ""
  };
  var guests = data.guests;
  var rowsAdded = 0;

  if (guests && guests.length) {
    guests.forEach(function (guest) {
      appendGuestRow(sheet, meta, guest);
      rowsAdded += 1;
    });
  } else {
    appendGuestRow(sheet, meta, {
      name: data.fullName || "",
      mealPreference: data.mealPreference || "",
      glutenFreeCeliac: data.glutenFreeCeliac || "",
      nuts: data.nuts || "",
      allergies: data.allergies || "",
      dietary: data.dietaryDetails || data.dietary || ""
    });
    rowsAdded = 1;
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, rowsAdded: rowsAdded }))
    .setMimeType(ContentService.MimeType.JSON);
}
