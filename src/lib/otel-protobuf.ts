import * as pako from 'pako'
import * as otelProto from '../generated/otel-proto'

function decompress(uint8Array: Uint8Array, contentEncoding?: string): Uint8Array {
  if (!contentEncoding) return uint8Array

  switch (contentEncoding.toLowerCase()) {
    case 'gzip':
      return pako.inflate(uint8Array)
    case 'deflate':
      return pako.inflateRaw(uint8Array)
    default:
      return uint8Array
  }
}

const fieldNamesConvertToHex = new Set([
  'traceId', 'trace_id', 'parentSpanId', 'parent_span_id', 'span_id', 'spanId',
].map(s => s.toLowerCase()))

// Custom converter to handle field formatting
function formatFieldValue(value: any, fieldName: string): any {
  // Handle trace/span IDs - convert to hex (now they come as arrays)
  if ((fieldNamesConvertToHex.has(fieldName.toLowerCase())) && Array.isArray(value)) {
    return value.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // Handle arrays recursively
  if (Array.isArray(value)) {
    return value.map((item) => formatObject(item))
  } else if (value && typeof value === 'object') {
    return formatObject(value)
  }
  return value
}

// Recursively format objects, by replacing some array fields with hex strings
function formatObject(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  const result: any = {}

  for (const [key, value] of Object.entries(obj)) {
    result[key] = formatFieldValue(value, key)
  }
  return result
}

export async function convertProtobufToJson(buffer: ArrayBuffer, contentEncoding?: string): Promise<string> {
  try {
    // First decompress if needed
    let uint8Array: any = new Uint8Array(buffer)
    try {
      uint8Array = decompress(uint8Array, contentEncoding)
    } catch (error) {
      return `Error decompressing data: ${error instanceof Error ? error.message : 'Unknown error'}`
    }

    // Define message types to try in order
    const messageTypes = [
      otelProto.opentelemetry.proto.trace.v1.TracesData,
    ]

    for (const messageType of messageTypes) {
      try {
        const decoded = messageType.decode(uint8Array)
        return JSON.stringify(decoded);
      } catch {
        // Continue to next message type
      }
    }

    // If all specific parsing fails, return error
    return JSON.stringify({
      error: 'Unable to parse as any known OpenTelemetry protobuf message type',
      dataSize: uint8Array.length,
      hint: 'This could be due to version mismatch or corrupted data',
    }, null, 2)
  } catch (error) {
    return `Error parsing protobuf: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}
