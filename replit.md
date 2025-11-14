# The Sensor Whisperer (sensor-oracle)

## Overview
The Sensor Whisperer (sensor-oracle) is a React-based web application designed for IoT device model discovery, database management, and PDF decoder generation. It aims to streamline the process of finding device models, inserting their information into a database, and automatically generating decoder code from PDF documentation using AI-driven capabilities.

The project's vision is to provide a comprehensive tool for managing IoT device data and accelerating the development of device decoders, thereby reducing manual effort and potential errors in IoT deployments. It targets a market need for efficient handling of diverse IoT device ecosystems.

## Recent Changes
- **2025-11-14:**
  - **Consolidated Azure Functions architecture**: Migrated all manufacturer-specific decoder generation endpoints and the refinement/feedback loop to a single unified Azure Function resource (`VITE_DECODER_BASE` and `VITE_DECODER_KEY`). This simplifies credential management while maintaining backward compatibility with existing endpoint paths.
- **2025-11-12:** 
  - Fixed refinement feedback loop for Milesight and Decentlab workflows. Added refinement notes display section to Step 7, ensuring users can see AI's explanation after clicking "Refine Decoder with Feedback" - matching the functionality available in Step 5 for Dragino and Watteco.
  - **Added complete Generic manufacturer workflow** with dual-input mode (PDF upload via Azure extraction OR direct text paste), single-call API integration returning all workflow outputs (deviceFormat, compositeSpec, rulesBlock, examplesTablesMarkdown, decoderCode, decoderFeedback), and full integration with universal refinement system. Generic workflow displays outputs progressively through steps 1-5 with refinement capability.

## User Preferences
I want iterative development. Ask before making major changes. I prefer detailed explanations. Do not make changes to the folder Z. Do not make changes to the file Y.

## System Architecture

### UI/UX Decisions
The application uses `shadcn/ui` components built on `Radix UI` primitives, styled with `Tailwind CSS`. It features a gradient background with animated elements for a modern aesthetic. The language is mixed, with Swedish for database tools and English for the PDF Decoder Generator.

### Technical Implementations
- **Build Tool:** Vite
- **Framework:** React with TypeScript
- **State Management:** TanStack Query (React Query)
- **Form Handling:** React Hook Form with Zod validation
- **Routing:** React Router DOM
- **Deployment:** Configured for Replit's `autoscale` target.

### Feature Specifications
1.  **Device Model Finder (Enhetsmodellfinnare):** AI-driven search for IoT device models by vendor and model name.
2.  **Model DB Insertion (Modell DB-infogning):**
    *   Single-form interface for entering device model details (Model Name, Supplier, Decoder Name, Device Profile, Decoded Data (JSON)).
    *   Automatic JSON building with smart malformed JSON detection and repair capabilities (missing quotes, type placeholders).
    *   Multi-platform SQL generation (ThingPark, Radonova, Chirpstack, Kameror MKB Net, Netmore) with editable attribute mappings.
3.  **PDF Decoder Generator:**
    *   **3-step workflow:** Upload PDF → Review & Edit Evidence → Configure & Generate.
    *   Uses Azure Document Intelligence for PDF extraction.
    *   Supports output types: C#, Python, JavaScript.
    *   Customizable general and special AI prompts.
    *   Comprehensive error handling with retry logic for SAS URL expiry.
    *   State machine manages workflow progression.
4.  **Manufacturer-specific Decoder Generator:**
    *   Supports five manufacturer workflows:
        *   **Milesight** (7 steps): Full workflow with composite spec, rules, examples, reconciliation, decoder, repair, and feedback
        *   **Decentlab** (4 steps): Streamlined workflow with composite spec, rules, examples, and static feedback
        *   **Dragino** (2 steps): Quick workflow with device profile and decoder code
        *   **Watteco** (2 steps): Text-based input with device profile and decoder code
        *   **Generic** (5 steps): Dual-input mode (PDF upload OR text paste) with single-call API returning device format, composite spec, rules block, examples tables, decoder code, and AI-generated feedback
    *   Integrates with manufacturer-specific Azure Functions endpoints.
    *   Includes a "Refine Decoder with Feedback" mechanism across all manufacturers, allowing AI-driven refinement of generated decoder code based on user input.
    *   Features a `ContentDisplay` component for unified viewing/editing with syntax highlighting (C#), Markdown rendering, and structured rules display.
    *   Generic workflow supports optional metadata fields (deviceName, sensorSpecificPrompt, manualExamples) for enhanced decoder generation.

### System Design Choices
The application is structured as a frontend-only React application with backend interactions managed via Azure Functions. It leverages shared utility modules for Azure-related operations. The development environment is configured for Replit, using Vite for fast development and building.

**Azure Functions Architecture:** All decoder generation endpoints (previously distributed across manufacturer-specific Azure Functions) have been consolidated into a single unified Azure Function resource. This simplifies credential management while maintaining manufacturer-specific endpoint paths for routing.

### Environment Variables
The application requires the following environment secrets (all prefixed with `VITE_` for frontend access):
- **PDF Extraction (Azure Document Intelligence)**:
  - `VITE_FUNC_BASE` & `VITE_FUNC_KEY`: PDF upload and extraction endpoint
- **Unified Decoder Generation (All Manufacturers + Refinement)**:
  - `VITE_DECODER_BASE` & `VITE_DECODER_KEY`: Single Azure Function resource handling all manufacturer workflows (Milesight, Decentlab, Dragino, Watteco, Generic) and decoder refinement with AI feedback
  - Example base URL: `https://int-func-decodergenerator.azurewebsites.net`
  - Manufacturer-specific endpoints remain unchanged (e.g., `/api/decentlab/examples/extract`, `/api/GenerateCompositeSpec`, `/api/RefineDecoder`)

## External Dependencies

*   **Azure Functions:** Used for backend logic, including:
    *   IoT device model discovery (AI-driven).
    *   PDF document intelligence extraction.
    *   Decoder code generation (C#, Python, JavaScript).
    *   Manufacturer-specific decoder generation (Milesight, Decentlab, Dragino, Watteco, Generic).
    *   Decoder refinement with feedback (universal across all manufacturers).
*   **Azure Blob Storage:** For storing and retrieving PDF evidence, utilizing Shared Access Signature (SAS) URLs for secure access.
*   **Vite:** Build tool.
*   **React:** Frontend framework.
*   **TypeScript:** Language.
*   **shadcn/ui & Radix UI:** UI component libraries.
*   **Tailwind CSS:** Styling framework.
*   **React Router DOM:** For client-side routing.
*   **TanStack Query (React Query):** For data fetching and state management.
*   **React Hook Form & Zod:** For form handling and validation.
*   **react-syntax-highlighter:** For code syntax highlighting.
*   **react-markdown, rehype-raw, rehype-sanitize:** For Markdown rendering.