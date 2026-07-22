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
    const allergyValues = Array.isArray(parsedBody.allergies)
      ? parsedBody.allergies.map((item) => item.toString().trim()).filter(Boolean)
      : [];
    const allergiesText = allergyValues.join(", ");
    const glutenFreeCeliac = allergyValues.includes("Gluten free/Celiac") ? "Yes" : "";
    const nuts = allergyValues.includes("Nuts") ? "Yes" : "";
    const mealPreference = (parsedBody.mealPreference || "").toString().trim();
    const dietaryDetails = (parsedBody.dietary || "").toString().trim();
    const dietaryParts = [];

    if (mealPreference) {
      dietaryParts.push(`Meal: ${mealPreference}`);
    }
    if (allergiesText) {
      dietaryParts.push(`Allergies: ${allergiesText}`);
    }
    if (dietaryDetails) {
      dietaryParts.push(dietaryDetails);
    }

    const payload = {
      fullName: (parsedBody.fullName || "").toString(),
      guestCount: (parsedBody.guestCount || "").toString(),
      mealPreference,
      glutenFreeCeliac,
      nuts,
      allergies: allergiesText,
      dietaryDetails,
      dietary: dietaryParts.join(" | "),
      submittedAt: (parsedBody.submittedAt || new Date().toISOString()).toString()
    };

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
