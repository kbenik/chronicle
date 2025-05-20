# Evoly - Photo Journey Tracker

Evoly is a simple web application to track your journeys, one photo at a time. Users can create collections (e.g., "My Garden Progress," "Fitness Journey") and add dated entries with photos, titles, notes, and tags.

## Features

*   User authentication (Sign up, Sign In, Sign Out) via Supabase.
*   Create, view, and delete collections.
*   Add entries to collections with:
    *   Multiple image uploads (stored on Supabase Storage).
    *   Date (with EXIF extraction attempt from the first image).
    *   Title.
    *   Notes/Observations.
    *   Tags (with AI suggestions for the first image using Google Cloud Vision API).
*   View entries in a chronological timeline grid.
*   View entry details with image carousel and lightbox for zooming.
*   Edit existing entries (images, text, tags).
*   Delete entries.
*   Clickable tags to view all entries with a specific tag across collections.
*   Responsive design.

## Tech Stack

*   HTML5
*   CSS3 (Vanilla)
*   JavaScript (Vanilla)
*   Supabase (Backend-as-a-Service for Auth, Database, Storage)
*   EXIF.js (for reading image metadata)
*   Google Cloud Vision API (for AI-powered tag suggestions - optional)

## Setup

1.  **Clone the repository (if applicable) or download the files.**
2.  **Supabase Setup:**
    *   Create a Supabase project.
    *   Enable Email authentication.
    *   Create the following tables:
        *   `profiles` (id (uuid, primary key, references auth.users), username (text), phone (text))
        *   `collections` (id (uuid, primary key), user_id (uuid, foreign key to auth.users), name (text), created_at (timestamp with time zone, default now()))
        *   `entries` (id (uuid, primary key), collection_id (uuid, foreign key to collections), title (text), notes (text), date (date), image_urls (jsonb or text[]), tags (text[]), created_at (timestamp with time zone, default now()))
    *   Create a Supabase Storage bucket named `entry-images` (public or private with appropriate policies).
3.  **Google Cloud Vision API (Optional):**
    *   If you want AI tag suggestions, create a project in Google Cloud Platform, enable the Vision API, and get an API Key.
4.  **Update Configuration:**
    *   Open `script.js`.
    *   Replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` with your Supabase project's URL and Anon Key.
    *   Replace `GOOGLE_CLOUD_VISION_API_KEY` with your Google Cloud Vision API Key. If you don't want to use this feature, you can leave it as is or remove the tag prediction logic.
5.  **Run the App:**
    *   Open `index.html` in your web browser.

## How to Use

1.  Sign up for an account or sign in if you already have one.
2.  Create a new collection for your journey.
3.  Open a collection and click the "+" button to add a new entry.
4.  Upload photos, set the date, title, notes, and tags.
5.  View your entries in the timeline or click an entry for details.
6.  Click on tags to see related entries.

## GitHub Organization

The project is organized with:
* `index.html`: Main HTML structure.
* `style.css`: All CSS styles.
* `script.js`: All JavaScript logic.
* `README.md`: This file.
* `assets/` (optional): For any local static assets like images (though this app primarily uses remote images).
