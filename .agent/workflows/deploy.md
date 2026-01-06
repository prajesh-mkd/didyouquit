---
description: Deployment Protocol with Semantic Versioning
---

# Deployment Protocol

## 1. Semantic Versioning Enforcement
We strictly follow **Semantic Versioning (SemVer)** protocol (`Major.Minor.Patch`):

*   **Major (X.0.0)**: Breaking changes or massive rewrites.
    *   *Action*: Increment Left Digit. **Reset Middle and Right digits to 0.**
    *   *Example*: `3.34.15` -> `4.0.0`
*   **Minor (3.X.0)**: New features or substantial non-breaking improvements.
    *   *Action*: Increment Middle Digit. **Reset Right digit to 0.**
    *   *Example*: `3.34.15` -> `3.35.0`
*   **Patch (3.34.X)**: Bug fixes, text changes, or small tweaks.
    *   *Action*: Increment Right Digit.
    *   *Example*: `3.34.15` -> `3.34.16`

## 2. Codebase Version Update
The version displayed in the footer is **Static** (Code-first) to ensure it always matches the deployed bundle.
*   **File**: `src/components/layout/FooterVersion.tsx`
*   **Action**: Update the version string in the `useState` default value.
    ```typescript
    const [version, setVersion] = useState<string | null>("3.35.0");
    ```

## 3. Commit Message Standard
The commit message **MUST** include the version number and a brief description of the change.
*   **Format**: `Deploy v[Major].[Minor].[Patch]: [Description]`
*   **Example**: `Deploy v3.35.0: Add new Community Hub features`

## 4. Execution
Run the standard git chain to trigger the Firebase App Hosting build:
```bash
git add .
git commit -m "Deploy v3.35.0: [Description]"
git push
```
