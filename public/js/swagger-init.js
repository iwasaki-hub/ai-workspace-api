"use strict";

// Swagger UI assets are served locally, and the contract is loaded from this same host.
// Keep "Try it out" limited to explicitly supported, read-only GET operations.
window.addEventListener("DOMContentLoaded", () => {
  window.ui = SwaggerUIBundle({
    url: "/openapi.json",
    dom_id: "#swagger-ui",
    deepLinking: true,
    tryItOutEnabled: false,
    supportedSubmitMethods: ["get"],
    displayRequestDuration: true,
    validatorUrl: null,
    persistAuthorization: false,
    presets: [SwaggerUIBundle.presets.apis],
    layout: "BaseLayout",
  });
});
