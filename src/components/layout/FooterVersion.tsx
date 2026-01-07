"use client";

// Logic: Version is now strictly tied to the codebase deployment (Commit-based).
// This prevents "Ghost Versions" where the DB says one thing (v3.3.0) but the code is actually newer.
export function FooterVersion() {
    return <span>(v3.36.6)</span>;
}
