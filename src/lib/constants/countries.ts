export const COUNTRIES = [
    "United States",
    "United Kingdom",
    "Canada",
    "Australia",
    "India",
    "Germany",
    "France",
    "Brazil",
    "Japan",
    "South Korea",
    "Spain",
    "Italy",
    "Netherlands",
    "Sweden",
    "Singapore",
    "Mexico",
    "United Arab Emirates",
    "South Africa",
    "New Zealand",
    "Ireland"
] as const;

export type Country = typeof COUNTRIES[number];
