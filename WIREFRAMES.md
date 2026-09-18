# Mobile-first public journey wireframes

Target viewport: 320–430 px. Every screen uses a 16 px safe gutter, 48 px minimum actions, no horizontal scrolling, and one clear primary next step.

## 1. Landing / CAC-CNIC entry

```text
┌──────────────────────────────┐
│          ECP • 2026          │
│                              │
│       VOTER AWARENESS        │
│     Learn • Play • Understand│
│                              │
│  Understand voting through   │
│  a short interactive journey.│
│                              │
│  CAC / CNIC                  │
│  ┌────────────────────────┐  │
│  │  Enter without dashes  │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │        CONTINUE        │  │
│  └────────────────────────┘  │
│                              │
│       How does it work?      │
│  Same ID restores progress.  │
└──────────────────────────────┘
```

## 2. Awareness home

```text
┌──────────────────────────────┐
│ ECP                 Sign out │
│ Welcome back                 │
│ Your Awareness Journey       │
│                              │
│ Overall progress        60%  │
│ ████████████────────         │
│                              │
│ ✓  Registration    Complete │
│ 1  Learn how voting works   │
│    [ Start / Continue ]      │
│ 2  Voting Maze Game         │
│    [ Play Game ]             │
│ 3  Awareness Quiz           │
│    [ Start Quiz ]            │
└──────────────────────────────┘
```

## 3. Voting game

```text
┌──────────────────────────────┐
│ ‹ Journey     Voting Journey │
│ Stage 2 of 5                 │
│ Polling Station      ●●○○○  │
├──────────────────────────────┤
│                              │
│      ORIGINAL ECP MAZE       │
│    aspect ratio preserved    │
│  original ↔ display mapping  │
│                              │
├──────────────────────────────┤
│             ▲                │
│        ◀         ▶           │
│             ▼                │
│      Hold a button to move   │
└──────────────────────────────┘

Checkpoint sheet (in place, not a large modal):
┌──────────────────────────────┐
│ ✓ POLLING STATION REACHED    │
│ You reached your assigned    │
│ polling station.             │
│ Next: Find Presiding Officer │
│          [ Continue ]        │
└──────────────────────────────┘
```

## 4. Quiz

```text
┌──────────────────────────────┐
│ ‹ Journey       Question 3/5 │
│ ████████████────────         │
│                              │
│ What should you do after     │
│ receiving your ballot paper? │
│                              │
│ ○  Option A                  │
│ ○  Option B                  │
│ ○  Option C                  │
│ ○  Option D                  │
│                              │
│ [ Previous ]        [ Next ] │
└──────────────────────────────┘
```

Answers remain neutral until final submission. The final question shows **Submit quiz**.

## 5. Completion

```text
┌──────────────────────────────┐
│                              │
│              ✓               │
│ Awareness Journey Completed  │
│ Thank you for completing the │
│ voter awareness activity.    │
│                              │
│ Voting Guide       ✓ Complete│
│ Voting Game        ✓ Complete│
│ Quiz               ✓ Complete│
│ Quiz Score              4 / 5│
│                              │
│       [ View Summary ]       │
└──────────────────────────────┘
```

The completion screen is only reachable when the backend reports all mandatory steps complete.
