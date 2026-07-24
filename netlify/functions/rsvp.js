function normalizeGuest(rawGuest) {
  const allergies = Array.isArray(rawGuest.allergies)
    ? rawGuest.allergies.map((item) => item.toString().trim()).filter(Boolean)
    : [];

  return {
    name: (rawGuest.name || "").toString().trim(),
    mealPreference: (rawGuest.mealPreference || "").toString().trim(),
    allergies,
    dietary: (rawGuest.dietary || "").toString().trim()
  };
}

function guestToSheetRecord(guest) {
  return {
    name: guest.name,
    mealPreference: guest.mealPreference,
    glutenFreeCeliac: guest.allergies.includes("Gluten free/Celiac") ? "Yes" : "",
    nuts: guest.allergies.includes("Nuts") ? "Yes" : "",
    allergies: guest.allergies.join(", "),
    dietary: guest.dietary
  };
}

function buildRsvpPayload(parsedBody) {
  let guests = Array.isArray(parsedBody.guests)
    ? parsedBody.guests.map(normalizeGuest)
    : [];

  if (!guests.length) {
    const legacyAllergies = Array.isArray(parsedBody.allergies)
      ? parsedBody.allergies.map((item) => item.toString().trim()).filter(Boolean)
      : [];
    guests.push(
      normalizeGuest({
        name: parsedBody.fullName || "",
        mealPreference: parsedBody.mealPreference || "",
        allergies: legacyAllergies,
        dietary: parsedBody.dietary || ""
      })
    );
  }

  const submittedAt = (parsedBody.submittedAt || new Date().toISOString()).toString();
  const fullName = (parsedBody.fullName || "").toString();
  const guestCount = (parsedBody.guestCount || guests.length.toString()).toString();
  const sheetGuests = guests.map(guestToSheetRecord);

  return {
    fullName,
    guestCount,
    submittedAt,
    guests: sheetGuests
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, message: "Method not allowed" })
    };
  }

  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, message: "Webhook not configured" })
    };
  }

  try {
    const parsedBody = JSON.parse(event.body || "{}");
    const payload = buildRsvpPayload(parsedBody);

    const upstreamResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    if (!upstreamResponse.ok) {
      const upstreamText = await upstreamResponse.text();
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          message: "Google Sheets webhook request failed",
          details: upstreamText.slice(0, 500)
        })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, rowsAdded: payload.guests.length })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        message: "Unexpected server error",
        details: String(error && error.message ? error.message : error)
      })
    };
  }
};
