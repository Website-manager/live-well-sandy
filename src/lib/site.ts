// ---------------------------------------------------------------------------
// Site-level config (not day-to-day content — Carson sets these, not Sandy).
// ---------------------------------------------------------------------------

// NEWSLETTER (Kit / ConvertKit) — the ONE switch to turn the signup form on.
//
// Paste Sandy's Kit *Form ID* between the quotes below. Find it in Kit:
//   Kit → Grow → Forms → (open/create her form) → Embed → it's the number in
//   the form's action URL:  app.convertkit.com/forms/THIS_NUMBER/subscriptions
//
// While this is empty (""), the Contact page shows the friendly "email me"
// fallback. The moment a real ID is here, the live signup form appears — that's
// the whole switch.
export const KIT_FORM_ID = "9615559";

// Built automatically from the ID above — no need to edit this.
export const KIT_FORM_ACTION = KIT_FORM_ID
  ? `https://app.kit.com/forms/${KIT_FORM_ID}/subscriptions`
  : "";
