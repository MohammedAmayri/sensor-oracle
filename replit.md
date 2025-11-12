# The Sensor Whisperer (sensor-oracle)

## Overview
The Sensor Whisperer (sensor-oracle) is a React-based web application designed for IoT device model discovery, database management, and PDF decoder generation. It aims to streamline the process of finding device models, inserting their information into a database, and automatically generating decoder code from PDF documentation using AI-driven capabilities.

The project's vision is to provide a comprehensive tool for managing IoT device data and accelerating the development of device decoders, thereby reducing manual effort and potential errors in IoT deployments. It targets a market need for efficient handling of diverse IoT device ecosystems.

## Recent Changes
- **2025-11-12:** Fixed refinement feedback loop for Milesight and Decentlab workflows. Added refinement notes display section to Step 7, ensuring users can see AI's explanation after clicking "Refine Decoder with Feedback" - matching the functionality available in Step 5 for Dragino and Watteco.

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
    *   Supports Milesight (7 steps), Decentlab (4 steps), Dragino (2 steps), and Watteco (2 steps, text-based input) workflows.
    *   Integrates with manufacturer-specific Azure Functions endpoints.
    *   Includes a "Refine Decoder with Feedback" mechanism across manufacturers, allowing AI-driven refinement of generated decoder code based on user input.
    *   Features a `ContentDisplay` component for unified viewing/editing with syntax highlighting (C#), Markdown rendering, and structured rules display.

### System Design Choices
The application is structured as a frontend-only React application with backend interactions managed via Azure Functions. It leverages shared utility modules for Azure-related operations. Environment variables are used for API keys and base URLs, including manufacturer-specific credentials for enhanced security and flexibility. The development environment is configured for Replit, using Vite for fast development and building.

### Environment Variables
The application requires the following environment secrets (all prefixed with `VITE_` for frontend access):
- **General Azure Functions**:
  - `FUNC_BASE` & `FUNC_KEY`: Main Azure Functions endpoint
- **Manufacturer-specific Decoder Generation**:
  - `VITE_MILESIGHT_BASE` & `VITE_MILESIGHT_KEY`: Milesight decoder generation
  - `VITE_DECENTLAB_BASE` & `VITE_DECENTLAB_KEY`: Decentlab decoder generation
  - `VITE_DRAGINO_BASE` & `VITE_DRAGINO_KEY`: Dragino decoder generation
  - `VITE_WATTECO_BASE` & `VITE_WATTECO_KEY`: Watteco decoder generation
- **Universal Decoder Refinement**:
  - `VITE_REFINE_BASE` & `VITE_REFINE_KEY`: Cross-manufacturer decoder refinement with AI feedback

## External Dependencies

*   **Azure Functions:** Used for backend logic, including:
    *   IoT device model discovery (AI-driven).
    *   PDF document intelligence extraction.
    *   Decoder code generation (C#, Python, JavaScript).
    *   Manufacturer-specific decoder generation (Milesight, Decentlab, Dragino, Watteco).
    *   Decoder refinement with feedback.
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