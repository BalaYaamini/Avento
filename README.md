# AVENTO - University Event Management Platform

This application is built with React, Vite, Express, and Supabase.
All authentication and database interactions have been migrated to Supabase.

## Requirements
- Node.js >= 20.x

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm run install-all
   ```

2. **Environment Variables**
   Ensure `.env` at the root and `server/.env` have the following Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_key # (Only in server/.env)
   ```

3. **Running the Application**
   ```bash
   npm run dev
   ```
   The client will start on `http://localhost:3000` and the server on `http://localhost:5001`.

## Admin Configuration
Admin accounts cannot be registered through the UI. They must be manually created in Supabase Auth, and the `profiles` table must reflect their role as `["admin"]` (JSON) or `'admin'` (text) depending on schema.
