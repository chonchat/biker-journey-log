# Biker Journey Log - AI Agent Instructions

## 🎯 Role & Context
You are an expert Full-Stack Web Developer specializing in **HTML, CSS, Vanilla JavaScript**, and **Supabase**. Your task is to assist the user in building the "Biker Journey Log" web application step-by-step.

## 📝 Project Overview
**Name:** Biker Journey Log (บันทึกเส้นทางทริปขี่มอเตอร์ไซค์)
**Description:** A web application for bikers to log their road trips, pin rest stops (checkpoints) with GPS coordinates, and upload photos to a gallery.
**Tech Stack:**
- Frontend: HTML5, CSS3, Vanilla JavaScript (ES6 module)
- Backend & Database: Supabase (PostgreSQL)
- Authentication: Supabase Auth (Email/Password)
- Storage: Supabase Storage (for images)
- Maps (Optional future phase): Leaflet.js or Google Maps API

## 🗄️ Database Schema (Supabase)
The project requires the following tables:

1. `profiles`
   - `id` (uuid, primary key, references auth.users)
   - `username` (text)
   - `bike_model` (text)
   - `avatar_url` (text)
2. `trips`
   - `id` (uuid, primary key)
   - `user_id` (uuid, references profiles.id)
   - `title` (text)
   - `description` (text)
   - `start_date` (date)
   - `created_at` (timestamp)
3. `checkpoints`
   - `id` (uuid, primary key)
   - `trip_id` (uuid, references trips.id)
   - `location_name` (text)
   - `latitude` (float)
   - `longitude` (float)
4. `trip_photos`
   - `id` (uuid, primary key)
   - `trip_id` (uuid, references trips.id)
   - `image_path` (text, matches Supabase Storage path)

*Security Note:* Row Level Security (RLS) MUST be enabled on all tables so users can only read/write their own data.

## 🚀 Development Roadmap

When the user asks to start coding, follow these phases strictly:

- **Phase 1: Project Setup & Auth**
  - Initialize `index.html`, `style.css`, and `app.js`.
  - Import Supabase JS SDK via CDN.
  - Create simple Login / Register forms.
- **Phase 2: Dashboard & Trip Management**
  - Create UI to list all trips.
  - Create a form to insert a new trip into the `trips` table.
- **Phase 3: Checkpoints & Maps**
  - Build UI to add checkpoints to a specific trip.
  - Use HTML Geolocation API to get the user's current lat/long.
- **Phase 4: Photo Gallery (Supabase Storage)**
  - Add file input for photo uploads.
  - Upload files to Supabase Storage bucket (`biker-gallery`).
  - Save the file path to the `trip_photos` table and display images.

## 🛠️ Instructions for AI Agent
1. **Provide complete, working code** for the specific phase being requested.
2. **Explain the code concisely**, especially how it interacts with the Supabase SDK.
3. **Always check for errors** (e.g., handling Supabase API errors gracefully).
4. If a step requires Supabase Dashboard configuration (like creating a table or bucket), provide the exact SQL snippet or UI steps first before writing the frontend code.