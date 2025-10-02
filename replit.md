# The Sensor Whisperer (sensor-oracle)

## Overview
A React-based web application for IoT device model discovery and database management. The app features an AI-driven interface for finding device models and inserting model information into a database.

**Project Type:** Frontend-only React Application
**Stack:** Vite + React + TypeScript + shadcn/ui + Tailwind CSS
**Language:** Swedish (Swedish interface)

## Current State
- ✅ Vite dev server configured for Replit (port 5000, host 0.0.0.0)
- ✅ Workflow configured and running
- ✅ Deployment configuration set up
- ✅ All dependencies installed
- ✅ Application tested and working

## Project Architecture

### Technology Stack
- **Build Tool:** Vite 5.4.19
- **Framework:** React 18.3.1 with TypeScript
- **UI Library:** shadcn/ui components with Radix UI primitives
- **Styling:** Tailwind CSS with custom theme
- **Routing:** React Router DOM
- **State Management:** TanStack Query (React Query)
- **Form Handling:** React Hook Form with Zod validation

### Project Structure
```
src/
  components/
    ui/                    # shadcn/ui components
    DeviceModelFinder.tsx  # IoT device model search component
    ModelDBInsertion.tsx   # Database insertion component
  pages/
    Index.tsx              # Main page with tabs
    NotFound.tsx           # 404 page
  App.tsx                  # App root with routing
  main.tsx                 # Entry point
  index.css              # Global styles and theme
```

### Key Features
1. **Device Model Finder (Enhetsmodellfinnare)**
   - Search for IoT device models by vendor and model name
   - AI-driven intelligence for device discovery

2. **Model DB Insertion (Modell DB-infogning)**
   - Interface for inserting model information into database
   - Form-based data entry

## Configuration

### Vite Configuration
- Dev server: `0.0.0.0:5000`
- Preview server: `0.0.0.0:5000`
- HMR configured for Replit proxy
- Path aliases: `@` → `./src`

### Workflow
- **Name:** Start application
- **Command:** `npm run dev`
- **Port:** 5000
- **Output:** webview

### Deployment
- **Target:** autoscale
- **Build:** `npm run build`
- **Run:** `npm run preview`

## Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Environment Setup
- Node.js 20 (nodejs-20)
- Package manager: npm
- All dependencies managed via package.json

## Recent Changes
- **2025-10-02:** Initial Replit setup
  - Configured Vite for Replit environment (port 5000, host 0.0.0.0)
  - Set up workflow for development server
  - Configured deployment for production
  - Added preview server configuration

## Notes
- The application uses Swedish language for the UI
- Component tagger (lovable-tagger) is included for development mode
- All UI components are from shadcn/ui library
- The app features a gradient background with animated elements
