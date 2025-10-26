import isPrivateIp from 'private-ip'
import { serverEnv } from './server-env'

/**
 * Internal TLDs commonly used for private/internal services
 */
const INTERNAL_TLDS = [
  '.local',
  '.localhost',
  '.internal',
  '.private',
  '.corp',
  '.home',
  '.lan',
  // Kubernetes
  '.cluster',
  '.cluster.local',
  '.svc',
  '.svc.cluster',
  '.svc.cluster.local',
  // Docker
  '.docker',
  '.docker.internal',
  // Cloud provider internal
  '.internal.cloudapp.net', // Azure
  '.internal.cloudapp.azure.com', // Azure
  '.ec2.internal', // AWS
  '.compute.internal', // GCP
]

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates that a URL points to a public destination (not private IPs or internal hostnames)
 * Only validates if VALIDATE_UPSTREAM_URL environment variable is set to true
 */
export function validatePublicUrl(urlString: string): ValidationResult {
  // Skip validation if disabled in config
  if (!serverEnv.VALIDATE_UPSTREAM_URL) {
    return { valid: true }
  }

  try {
    const url = new URL(urlString)

    // Only allow http and https protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        valid: false,
        error: `Invalid protocol "${url.protocol}". Only http:// and https:// are allowed.`,
      }
    }

    const hostname = url.hostname.toLowerCase()

    // Check if hostname is an IP address
    if (isIpAddress(hostname)) {
      // Use private-ip package to check if it's a private IP
      if (isPrivateIp(hostname)) {
        return {
          valid: false,
          error: `Private IP addresses are not allowed: ${hostname}`,
        }
      }
    } else {
      // Check for internal/private TLDs
      for (const tld of INTERNAL_TLDS) {
        if (hostname.endsWith(tld) || hostname === tld.substring(1)) {
          return {
            valid: false,
            error: `Internal hostname detected: ${hostname}. URLs with "${tld}" are not allowed.`,
          }
        }
      }

      // Additional check for localhost variants
      if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        return {
          valid: false,
          error: 'Localhost URLs are not allowed.',
        }
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: `Invalid URL format: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Simple check if a string is an IP address (IPv4 or IPv6)
 */
function isIpAddress(hostname: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/

  // IPv6 pattern (simplified - matches most common formats)
  const ipv6Pattern = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i

  return ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname)
}
