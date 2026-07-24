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

function formatGuestLine(guest, index) {
  const parts = [`Guest ${index + 1} - ${guest.name || "Unnamed"}: ${guest.mealPreference || "Not specified"}`];

  if (guest.allergies.length) {
    parts.push(`Allergies: ${guest.allergies.join(", ")}`);
  }
  if (guest.dietary) {
    parts.push(guest.dietary);
  }

  return parts.join("; ");
}

function buildRsvpPayload(parsedBody) {
  const guests = Array.isArray(parsedBody.guests)
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

  const guestDetails = guests.map(formatGuestLine).join("\n");
  const mealPreference = guests.map((guest) => guest.mealPreference).filter(Boolean).join("; ");
  const allergyValues = guests.flatMap((guest) => guest.allergies);
  const allergiesText = [...new Set(allergyValues)].join(", ");
  const glutenFreeCeliac = allergyValues.includes("Gluten free/Celiac") ? "Yes" : "";
  const nuts = allergyValues.includes("Nuts") ? "Yes" : "";
  const dietaryDetails = guests
    .map((guest) => guest.dietary)
    .filter(Boolean)
    .join(" | ");

  const dietaryParts = guests.map(formatGuestLine);

  return {
    fullName: (parsedBody.fullName || "").toString(),
    guestCount: (parsedBody.guestCount || guests.length.toString()).toString(),
    guestDetails,
    mealPreference,
    glutenFreeCeliac,
    nuts,
    allergies: allergiesText,
    dietaryDetails,
    dietary: dietaryParts.join(" | "),
    submittedAt: (parsedBody.submittedAt || new Date().toISOString()).toString()
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
      body: JSON.stringify({ ok: true })
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
