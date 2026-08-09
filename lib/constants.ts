// This MVP's `maintenance_requests` table stores `property` as free text
// (there is no separate properties table), so the "Rental Property" dropdown
// is backed by this hardcoded placeholder list. Edit it to match your actual
// rental properties.
export const PROPERTIES = [
  "Maple Street Duplex - Unit A",
  "Maple Street Duplex - Unit B",
  "Oak Avenue House",
  "Pine Court Apartments - Unit 101",
  "Pine Court Apartments - Unit 102",
  "Riverside Cottage",
];

export const PREFERRED_CONTACT_METHODS = ["Phone", "Email", "Text"];

export const RECEIVED_VIA_OPTIONS = [
  "Phone Call",
  "Email",
  "Text Message",
  "In Person",
  "Tenant Portal",
];

export const RESPONSIBLE_PARTIES = ["Jack", "Tenant", "Contractor"];

export const STATUSES = ["Open", "In Progress", "On Hold", "Complete"];

export const PRIORITIES = ["Emergency", "High", "Medium", "Low"] as const;
