# Construction Inspection Pro (CIP)

A comprehensive construction inspection management application for teams to create, manage, and report on property inspections.

## Overview

CIP enables inspectors to document inspection findings in the field (mobile and web) with structured checklists, categorized items, photos, and notes. The app integrates with Housecall Pro for job scheduling and includes subscription-based team management and PDF report generation.

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npx expo start
```

### Running the App

- **Web**: Press `w` in the terminal or visit the URL shown
- **iOS**: Press `i` to open in iOS Simulator (requires Xcode)
- **Android**: Press `a` to open in Android Emulator (requires Android Studio)
- **Physical Device**: Scan the QR code with Expo Go app

### Building for Production

```bash
# Build for web
npm run build:web

# Deploy to Vercel (web)
./deploy-web.sh
```

## Features

### Inspections

- Create and manage property inspections
- Multiple item types for flexible data collection:
  - **Status**: Satisfactory / Recommended / Unsafe / N/A
  - **Measurements**: Feet and inches input
  - **Numbers**: Numeric values
  - **Yes/No**: Toggle switches
  - **Pass/Fail**: Quick status buttons
  - **Text**: Free-form text input
  - **Selection**: Dropdown options
- Organize items into collapsible categories
- Track completion percentage
- Add photos from camera or gallery
- Add notes to individual items or the overall inspection

### Templates

- Use predefined system templates for common inspection types
- Create custom templates for your company
- Apply templates to new inspections
- Change templates mid-inspection

### PDF Reports

- Generate professional PDF reports
- Include all inspection items, photos, and notes
- Download or share reports
- Email reports directly to clients

### Schedule

- View inspections by date
- 7-day calendar view
- Sync with Housecall Pro for job scheduling
- Auto-import scheduled jobs

### Team Management

- Invite team members via email
- Assign roles:
  - **Owner**: Full access, billing management
  - **Admin**: Manage team and inspections
  - **Inspector**: Create and complete inspections
- Track pending invitations
- Remove team members

### Housecall Pro Integration

- Connect your Housecall Pro account
- Auto-sync scheduled jobs
- Upload completed inspections back to HCP
- Two-way sync for job status

## Subscription Plans

| Plan | Price/Month | Employees | Features |
|------|-------------|-----------|----------|
| **Basic** | $79 | 1 | Unlimited inspections, PDF reports, Email delivery, HCP integration |
| **Plus** | $99 | 2-9 | Everything in Basic + Team management, Priority support |
| **Pro** | $119 | 10-20 | Everything in Plus + Advanced reporting, Dedicated support |
| **Enterprise** | Custom | 20+ | Unlimited employees, Custom integrations, Account manager |

## App Structure

```
app/
├── (auth)/                 # Authentication screens
│   ├── login.tsx          # Sign in
│   ├── register.tsx       # Sign up
│   └── forgot-password.tsx
├── (tabs)/                 # Main app tabs
│   ├── index.tsx          # Inspections list
│   ├── schedule.tsx       # Calendar view
│   ├── team.tsx           # Team management
│   └── profile.tsx        # User profile & settings
├── inspection/
│   ├── [id].tsx           # Inspection detail/editor
│   └── create.tsx         # New inspection
├── settings/
│   ├── templates.tsx      # Manage templates
│   ├── template-builder.tsx
│   ├── integrations.tsx   # HCP connection
│   ├── subscription.tsx   # Plan management
│   └── ...
└── add-to-homescreen.tsx  # PWA install instructions

src/
├── components/ui/         # Reusable UI components
├── contexts/              # React contexts (Auth, Company)
├── services/              # API services
│   ├── auth.service.ts
│   ├── company.service.ts
│   ├── inspection.service.ts
│   ├── checklist-template.service.ts
│   ├── pdf.service.ts
│   ├── housecallpro.service.ts
│   └── subscription.service.ts
├── lib/                   # Utilities and constants
└── types/                 # TypeScript type definitions
```

## Tech Stack

- **Framework**: React Native + Expo
- **Routing**: Expo Router (file-based)
- **Language**: TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Payments**: Stripe
- **Deployment**: Vercel (web)

## Adding to Home Screen

For the best experience, add CIP to your device's home screen:

### Android (Chrome)
1. Open Chrome and go to www.cipro.us
2. Tap the three dots menu
3. Tap "Add to Home screen" or "Install app"
4. Tap "Add" to confirm

### iOS (Safari)
1. Open Safari and go to www.cipro.us
2. Tap the Share button
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm

## Environment Variables

Create a `.env.local` file with:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Support

For help or feedback, contact support through the app's Help section or visit the settings page.
