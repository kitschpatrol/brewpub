import { base64ToString, stringToBase64 } from 'uint8array-extras'

/**
 * Encode a UTF-8 string as base64. The GitHub contents API wants base64 bodies.
 */
export function encodeBase64(text: string): string {
	return stringToBase64(text)
}

/**
 * Decode a base64 string to UTF-8. Tolerates the embedded newlines that the
 * GitHub contents API inserts into file content.
 */
export function decodeBase64(base64: string): string {
	return base64ToString(base64.replaceAll(/\s/gv, ''))
}
