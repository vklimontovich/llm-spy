import '@opentelemetry/api'

/**
 * Next.js attempts to eagerly load its OpenTelemetry vendor chunk for server
 * routes. In some environments the chunk is not emitted unless the module is
 * explicitly imported, causing runtime "Cannot find module
 * './vendor-chunks/@opentelemetry.js'" errors. Importing the API here ensures
 * the chunk is produced while keeping the instrumentation hook a no-op.
 */
export function register() {
  // No custom instrumentation at the moment.
}
