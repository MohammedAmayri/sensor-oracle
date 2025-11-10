# The Sensor Whisperer (sensor-oracle)

## Overview
A React-based web application for IoT device model discovery, database management, and PDF decoder generation. The app features an AI-driven interface for finding device models, inserting model information into a database, and generating decoder code from PDF documentation.

**Project Type:** Frontend-only React Application with Azure Functions integration
**Stack:** Vite + React + TypeScript + shadcn/ui + Tailwind CSS
**Language:** Mixed (Swedish UI for DB tools, English for PDF Decoder Generator)

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
    ui/                       # shadcn/ui components
    DeviceModelFinder.tsx     # IoT device model search component
    ModelDBInsertion.tsx      # Database insertion component
    PdfDecoderGenerator.tsx   # PDF decoder generation workflow
    DecoderGenerator.tsx      # Manufacturer-specific decoder generation workflow
    ContentDisplay.tsx        # Universal content viewer/editor with syntax highlighting
  lib/
    azureDocumentIntelligence.ts  # Shared Azure Functions utilities
  pages/
    Index.tsx                 # Main page with tabs for all features
    NotFound.tsx              # 404 page
  App.tsx                     # App root with routing
  main.tsx                    # Entry point
  index.css                   # Global styles and theme
```

### Key Features
1. **Device Model Finder (Enhetsmodellfinnare)**
   - Search for IoT device models by vendor and model name
   - AI-driven intelligence for device discovery

2. **Model DB Insertion (Modell DB-infogning)**
   - Streamlined single-form interface with all required fields
   - Fields: Model Name, Supplier, Decoder Name, Device Profile, Decoded Data (JSON)
   - Automatic JSON building from form fields
   - Smart malformed JSON detection and repair:
     - Detects missing quotes on property names
     - Detects data type placeholders (string, double, integer, etc.)
     - "Fix JSON" button appears automatically when malformed JSON is detected
     - Auto-fixes: adds missing quotes, replaces type placeholders with example values
   - Reset button to clear all form fields
   - Multi-platform SQL generation (ThingPark, Radonova, Chirpstack, Kameror MKB Net, Netmore)
   - Editable attribute mappings with full control
   - Platform-specific SQL formatting
   - Fixed duplicate attribute issue when updating attributes

3. **PDF Decoder Generator**
   - Complete 3-step workflow for generating decoder code from PDF documentation
   - **Step 1: Upload PDF**
     - Upload PDF files for extraction using Azure Document Intelligence
     - Automatic polling for extraction completion (10-20 seconds typical)
     - Progress indicators and status updates
   - **Step 2: Review & Edit Evidence**
     - Displays extracted evidence content in editable textarea
     - Save functionality with SAS blob storage write
     - Automatic SAS URL refresh and retry on expiry (403 errors)
   - **Step 3: Configure & Generate**
     - Select output type (C#, Python, JavaScript)
     - Customizable general and special prompts (collapsible sections)
     - Automatic polling for generation completion
     - Download artifacts: result.json, fullDecoder, consoleDecoder
     - Automatic SAS URL refresh for downloads on expiry
   - **Error Handling**
     - Comprehensive error messages for all failure scenarios
     - Transparent retry logic for expired SAS URLs
     - Failed state with options to retry or start over
   - **State Machine**: idle → uploaded → extracting → extracted → editing → generating → done/failed
   - **Azure Integration**: Uses FUNC_BASE and FUNC_KEY environment variables for authentication

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
- **Environment Variables (Secrets)**:
  - `FUNC_BASE`: Azure Functions base URL (e.g., https://your-app.azurewebsites.net)
  - `FUNC_KEY`: Azure Functions authentication key
  - **Manufacturer-specific Decoder Generator credentials**:
    - `VITE_MILESIGHT_BASE` & `VITE_MILESIGHT_KEY`: Milesight Azure Functions endpoint
    - `VITE_DECENTLAB_BASE` & `VITE_DECENTLAB_KEY`: Decentlab Azure Functions endpoint
    - `VITE_DRAGINO_BASE` & `VITE_DRAGINO_KEY`: Dragino Azure Functions endpoint
  - Accessed via `import.meta.env.VITE_*` in frontend

## Recent Changes
- **2025-11-10:** Added Dragino manufacturer support to Decoder Generator
  - Enabled Dragino option in manufacturer dropdown
  - Implemented streamlined 2-step Dragino workflow:
    - Step 1: Generate Dragino Rules (`/api/GenerateDraginoRules`) - generates rules from documentation
    - Step 2: Generate Dragino Decoder (`/api/GenerateDraginoDecoder`) - generates C# decoder from rules
  - Simplest workflow compared to Milesight (7 steps) and Decentlab (4 steps)
  - Dragino skips: Composite Spec, Examples Tables, Reconcile, Auto-Repair, and Feedback steps
  - Manufacturer-specific API credentials (`VITE_DRAGINO_BASE`, `VITE_DRAGINO_KEY`)
  - Conditional UI rendering hides irrelevant steps for Dragino
  - Direct flow: Documentation → Rules → Decoder
  - Reuses existing UI infrastructure and ContentDisplay component

- **2025-11-10:** Refactored to manufacturer-specific environment variables
  - Replaced generic `VITE_DECODERGEN_BASE/KEY` with manufacturer-specific credentials
  - Each manufacturer (Milesight, Decentlab, Dragino) now has separate Azure Functions endpoints
  - Improved security and flexibility for multi-backend architecture
  - Updated `getApiCredentials()` function to route API calls to correct endpoints

- **2025-11-10:** Added Decentlab manufacturer support to Decoder Generator
  - Enabled Decentlab option in manufacturer dropdown
  - Implemented 6 Decentlab-specific API endpoints:
    - Generate Rules (`/decentlab/rules/generate`)
    - Refine Rules (`/decentlab/rules/refine`)
    - Extract Examples (`/decentlab/examples/extract`)
    - Generate Decoder (`/decentlab/decoder/generate`)
    - Static Feedback (`/decentlab/decoder/feedback`)
    - Refine Decoder (`/decentlab/decoder/refine`)
  - Streamlined 4-step Decentlab workflow (vs 7 steps for Milesight):
    - Step 1: Generate Rules (with optional Refine Rules button)
    - Step 2: Extract Examples
    - Step 3: Generate Decoder
    - Step 4: Static Feedback (with optional Refine Decoder button)
  - Conditionally hides Milesight-specific steps (Composite Spec, Reconcile, Auto-Repair)
  - Decentlab feedback loop allows iterating on rules or decoder with user feedback
  - Reuses existing navigation system, ContentDisplay component, and Azure integration
  - Both manufacturers work seamlessly with same UI infrastructure

- **2025-11-10:** Enhanced content display across all workflow steps
  - Created `ContentDisplay` component for unified viewing/editing of different content types
  - Features:
    - Syntax highlighting for C# code using react-syntax-highlighter
    - Markdown rendering with proper table formatting using react-markdown
    - Structured rules display with monospace formatting
    - Preview/Edit toggle for all editable content
    - Empty state placeholders
    - Page-level scrolling (removed internal textarea scrolling)
  - Integrated into all 7 Decoder Generator workflow steps:
    - Step 1 (Composite Spec): rules format
    - Step 2 (Rules Block): rules format
    - Step 3 (Examples Tables): markdown with table rendering
    - Step 4 (Reconciled Rules): rules format
    - Step 5 (Decoder Code): C# syntax highlighting
    - Step 6 (Auto-Repaired Code): C# syntax highlighting
    - Step 7 (Feedback): markdown rendering
  - Explicit content types per step for reliable formatting
  - Improved visual clarity and professional presentation

- **2025-11-10:** Fixed markdown preview in Decoder Generator
  - Implemented proper markdown-to-HTML rendering using react-markdown
  - HTML Preview tab now shows rendered markdown (tables, formatting, etc.)
  - Added rehype-raw and rehype-sanitize for safe HTML rendering
  - Side-by-side viewer now works like markdownlivepreview.com

- **2025-11-10:** Fixed PDF upload and created shared Azure utilities
  - Created `src/lib/azureDocumentIntelligence.ts` shared utility module
  - Refactored DecoderGenerator to use shared utilities (fixes PDF upload issue)
  - Both DecoderGenerator and PdfDecoderGenerator now use the same Azure endpoints
  - Shared utilities include: uploadPdfFile, getJob, loadEvidenceWithRefresh, saveEvidence, pollJobUntil
  - All components now use CreateJobAndUpload endpoint with proper headers

- **2025-11-10:** Added Decoder Generator feature (4th tab)
  - Manufacturer-based decoder generation workflow supporting:
    - **Milesight** (7-step process): Composite Spec → Rules → Examples → Reconcile → Decoder → Auto-Repair → Feedback
    - **Decentlab** (4-step process): Rules → Examples → Decoder → Feedback (with optional refinement)
    - **Dragino** (2-step process): Rules → Decoder
    - Watteco, Enginko (coming soon)
  - Integrated with manufacturer-specific Azure Functions endpoints
  - PDF upload with Azure Document Intelligence extraction
  - Side-by-side markdown/HTML viewer for documentation review
  - Step-by-step UI with editable intermediate results
  - Conditional rendering shows only relevant steps per manufacturer

- **2025-10-29:** Added PDF Decoder Generator feature
  - Implemented complete 3-step workflow for PDF → Evidence → Generate → Download
  - Integrated with Azure Functions backend for document intelligence
  - Added SAS blob storage read/write with automatic URL refresh on expiry
  - Created state machine for workflow management with polling for async operations
  - Added comprehensive error handling and user-friendly toast notifications
  - Updated navigation to include third tab for PDF Decoder Generator
  - Fixed duplicate attributes bug in Model DB Insertion component

- **2025-10-06:** Enhanced Model DB Insertion functionality
  - Added smart malformed JSON detection and automatic repair
  - Implemented "Fix JSON" button that appears when JSON needs fixing
  - Auto-fixes missing quotes and replaces data type placeholders
  - Added reset button to clear all form fields
  - Streamlined form with all fields in single interface (removed separate reformat section)
  
- **2025-10-02:** Initial Replit setup
  - Configured Vite for Replit environment (port 5000, host 0.0.0.0)
  - Set up workflow for development server
  - Configured deployment for production
  - Added preview server configuration

## Notes
- The application uses mixed languages: Swedish for DB tools, English for PDF Decoder Generator
- Component tagger (lovable-tagger) is included for development mode
- All UI components are from shadcn/ui library
- The app features a gradient background with animated elements
- PDF Decoder Generator requires Azure Functions backend to be running
- SAS URLs have time-limited tokens; automatic refresh handles expiry transparently
