# Next.js Overview

Next.js is a React framework designed for building full-stack web applications. It provides a comprehensive set of features and optimizations that allow developers to focus on product development rather than low-level configuration.

## Core Features

*   **Routing:**
    *   **App Router:** The modern, file-system-based router that leverages React Server Components, nested layouts, and advanced data fetching.
    *   **Pages Router:** The original router, which remains fully supported for existing applications.
*   **Rendering:** Supports both Client-side and Server-side Rendering (SSR). It further optimizes performance with Static and Dynamic rendering on the server and supports streaming for both Edge and Node.js runtimes.
*   **Data Fetching:** Simplifies data fetching using `async/await` in Server Components, alongside built-in support for request memoization, data caching, and revalidation.
*   **Optimizations:** Includes built-in support for optimizing images, fonts, and scripts to improve Core Web Vitals and user experience.
*   **Styling:** Native support for various styling methods, including CSS Modules, Tailwind CSS, and CSS-in-JS.
*   **TypeScript:** Provides improved TypeScript support with better type checking, efficient compilation, and custom plugins.
*   **Tooling (Turbopack):** Next.js uses Turbopack (the successor to Webpack) as its default bundler, offering significantly faster development server startup and build times.

## Modern Capabilities

*   **Partial Pre-Rendering (PPR):** A model for instant loading performance.
*   **React Compiler Support:** Built-in integration for automatic memoization of React components.
*   **Enhanced Caching APIs:** Refined APIs like `updateTag()` and `revalidateTag()` for better control over data caching.

Reference: [Next.js Documentation](https://github.com/vercel/next.js/tree/canary/docs)
