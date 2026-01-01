# Did You Quit?

A simple, public way to track New Year resolutions weekly.

## Setup

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Variables**
    Copy `.env.example` to `.env.local` and fill in your Firebase details:
    ```bash
    cp .env.example .env.local
    ```

    You need to create a **Firebase Project** and enable:
    -   **Authentication**: Google and Email/Password providers.
    -   **Firestore Database**: Create it in test mode initially, then apply `firestore.rules`.
    -   **Storage** (Optional, if you decide to implement custom avatar uploads later).

3.  **Run Locally**
    ```bash
    npm run dev
    ```

## Deploying to Firebase App Hosting

1.  Initialize Firebase in your project:
    ```bash
    firebase experiments:enable webframeworks
    firebase init hosting
    ```
2.  Deploy:
    ```bash
    firebase deploy
    ```

## Features
-   **Public Profile**: Share your url `didyouquit.com/yourusername`.
-   **Weekly Tracking**: Green/Red dots for every week.
-   **User Settings**: Change country (onboarding) or delete account.
