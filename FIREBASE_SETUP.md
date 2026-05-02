# Firebase Setup

This app now uses:

- Firebase Authentication for email/password sign-in
- Cloud Firestore for user profiles
- A `siteLogins` collection so a site can sign in with either:
  - the account email
  - the shared site username

This guide is written for the current app in this folder.

## Before You Start

Have these ready:

- a Google account you want to own the Firebase project
- a project name
- the first site account you want to create

Suggested values:

- Project name: `TrackOps`
- Web app nickname: `trackops-web`
- First site username: your real site name, for example `Olympus Pines`
- First site email: a shared site email if you have one

## Step 1: Create the Firebase Project

1. Open the Firebase console:
   `https://console.firebase.google.com/`
2. Click `Create a project`.
3. Project name:
   enter `TrackOps` or your preferred production name.
4. Click `Continue`.
5. Google Analytics:
   if you want the fastest setup, choose `Disable Google Analytics for this project`.
6. Click `Create project`.
7. Wait for Firebase to finish provisioning.
8. Click `Continue`.

## Step 2: Register the Web App

1. From the project overview screen, click the web icon `</>`.
2. App nickname:
   enter `trackops-web`.
3. Leave `Also set up Firebase Hosting` unchecked for now.
4. Click `Register app`.
5. Firebase will show you a config snippet with values like:
   `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`
6. Keep this browser tab open. You will copy these values into your local `.env` file in Step 3.

Reference: Firebase web setup docs: https://firebase.google.com/docs/web/setup

## Step 3: Add Your Firebase Keys to This Project

This code expects a local `.env` file in the project root.

1. In this project folder, create a file named `.env`.
2. Copy the contents of `.env.example`.
3. Replace each placeholder with the value from Firebase.

Use this exact format:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Notes:

- `VITE_FIREBASE_AUTH_DOMAIN` usually looks like `your-project-id.firebaseapp.com`
- `VITE_FIREBASE_STORAGE_BUCKET` in newer Firebase projects often looks like `your-project-id.firebasestorage.app`
- do not add quotes around the values

## Step 4: Turn On Email/Password Authentication

1. In the Firebase console left sidebar, click `Build`.
2. Click `Authentication`.
3. Click `Get started`.
4. Open the `Sign-in method` tab.
5. Find `Email/Password`.
6. Click it.
7. Turn on `Enable`.
8. Leave email link sign-in off for now.
9. Click `Save`.

Reference: Firebase password auth docs: https://firebase.google.com/docs/auth/web/password-auth

## Step 5: Create Firestore

1. In the Firebase console left sidebar, click `Build`.
2. Click `Firestore Database`.
3. Click `Create database`.
4. Choose `Start in production mode`.
5. Click `Next`.
6. Choose a region.

Recommended:

- If your team is US-based and you do not already have a region requirement, choose `us-central1`.

Important:

- Firestore location cannot be changed later.

7. Click `Enable`.

## Step 6: Paste the Firestore Rules for This Phase

These rules fit the app as it exists right now:

- one shared account per site
- sites can create their own account
- users can read only their own profile
- public username login is handled through a single `siteLogins/{normalizedSiteName}` document lookup
- each signed-in site account has full access to its own site data

In Firebase:

1. Open `Firestore Database`.
2. Click the `Rules` tab.
3. Replace the current rules with this:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /siteLogins/{siteName} {
      allow get: if true;
      allow list: if false;
      allow create: if request.auth != null
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.siteNameNormalized == siteName;
      allow update, delete: if false;
    }

    match /users/{userId} {
      allow create: if request.auth != null
        && request.auth.uid == userId
        && request.resource.data.email == request.auth.token.email
        && request.resource.data.accountType == "site"
        && request.resource.data.active == true
        && request.resource.data.siteIds.size() == 1;
      allow read: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null
        && request.auth.uid == userId
        && request.resource.data.active == resource.data.active
        && request.resource.data.role == resource.data.role
        && request.resource.data.accountType == resource.data.accountType
        && request.resource.data.siteIds == resource.data.siteIds;
      allow delete: if false;
    }

    match /sites/{siteId} {
      allow read, write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.active == true
        && siteId in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.siteIds;
    }

    match /tasks/{taskId} {
      allow read, write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.active == true
        && request.resource.data.siteId in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.siteIds;
    }

    match /announcements/{announcementId} {
      allow read, write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.active == true
        && request.resource.data.siteId in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.siteIds;
    }
  }
}
```

4. Click `Publish`.

Reference: Firestore rules docs:

- https://firebase.google.com/docs/firestore/security/get-started
- https://firebase.google.com/docs/firestore/security/rules-structure

## Step 7: Run the App Locally

In this project folder:

1. Install dependencies if needed:
   `npm install`
2. Start the dev server:
   `npm run dev`
3. Open the local URL shown in the terminal.
4. Go to `/create-account`.

## Step 8: Create the First Site Account

On the create account page, enter:

1. `Site Username`
   Enter the site name you want people to use at login.
   Example: `Olympus Pines`
2. `Email`
   Enter the shared site email for that location.
3. `Password`
   Create the shared site password.
4. `Confirm Password`
   Enter the same password again.
5. Click `Create Account`.

What the app will do:

- create the Firebase Auth user
- create `users/{uid}` in Firestore
- create `siteLogins/{normalizedSiteName}` in Firestore

The normalized site username is lowercase. For example:

- `Olympus Pines`
- stored lookup key: `olympus pines`

## Step 9: Verify the Email

After signup:

1. Open the inbox for the shared site email.
2. Find the Firebase verification email.
3. Click the verification link.

## Step 10: Test Login Both Ways

Go to `/login` and test:

1. Sign in with the site username plus password
2. Sign in with the email plus password

Both should work.

## Step 11: Confirm the Firestore Data

In Firebase console:

1. Open `Firestore Database`
2. Click `Data`
3. Confirm you now have:

- a `users` collection
- a `siteLogins` collection

The user document should contain fields like:

- `name`
- `siteName`
- `siteNameNormalized`
- `email`
- `accountType`
- `role`
- `siteIds`
- `active`

## If Something Fails

Check these first:

1. `.env` values exactly match Firebase
2. `Email/Password` is enabled in Authentication
3. Firestore has been created
4. Firestore rules were published
5. You restarted the Vite dev server after creating or editing `.env`
