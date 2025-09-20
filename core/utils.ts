/**
 * Utility Functions for XRPL Integration
 */

import { xrpToDrops, dropsToXrp } from 'xrpl';
import * as crypto from 'crypto';

/**
 * Convert XRP to drops
 */
export function convertXrpToDrops(xrp: number | string): string {
  return xrpToDrops(xrp);
}

/**
 * Convert drops to XRP
 */
export function convertDropsToXrp(drops: string | number): string {
  const dropsString = typeof drops === 'number' ? drops.toString() : drops;
  return dropsToXrp(dropsString).toString();
}

/**
 * Generate unique ID
 */
export function generateUniqueId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate data hash for health data
 */
export function generateDataHash(
  content: any,
  userId: string,
  dataType: string
): string {
  const dataString = JSON.stringify({ content, userId, dataType, timestamp: Date.now() });
  return crypto.createHash('sha256').update(dataString).digest('hex');
}

/**
 * Convert string to hex (for XRPL memos and NFT URIs)
 */
export function stringToHex(str: string): string {
  return Buffer.from(str, 'utf8').toString('hex').toUpperCase();
}

/**
 * Convert hex to string
 */
export function hexToString(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf8');
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format XRP amount for display
 */
export function formatXRPAmount(amount: string | number): string {
  const xrp = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${xrp.toFixed(6)} XRP`;
}

/**
 * Calculate data quality score
 */
export function calculateDataQualityScore(
  accuracy: number,
  completeness: number,
  consistency: number
): number {
  // Weighted average: accuracy (40%), completeness (30%), consistency (30%)
  return (accuracy * 0.4) + (completeness * 0.3) + (consistency * 0.3);
}

/**
 * Get grade from score
 */
export function getGradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Validate wallet address
 */
export function isValidWalletAddress(address: string): boolean {
  // XRPL addresses start with 'r' and are 25-34 characters long
  return /^r[a-zA-Z0-9]{24,33}$/.test(address);
}

/**
 * Encrypt data with AES-256
 */
export function encryptData(data: any, key: string): string {
  const algorithm = 'aes-256-cbc';
  const iv = crypto.randomBytes(16);
  const keyBuffer = crypto.scryptSync(key, 'salt', 32);

  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt data with AES-256
 */
export function decryptData(encryptedData: string, key: string): any {
  const algorithm = 'aes-256-cbc';
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const keyBuffer = crypto.scryptSync(key, 'salt', 32);

  const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

/**
 * Calculate median value
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

/**
 * Calculate standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Parse XRPL timestamp (Ripple time to Unix time)
 */
export function rippleTimeToUnixTime(rippleTime: number): number {
  // Ripple time is seconds since Jan 1, 2000 00:00:00
  // Unix time is seconds since Jan 1, 1970 00:00:00
  // Difference is 946,684,800 seconds
  return rippleTime + 946684800;
}

/**
 * Convert Unix time to Ripple time
 */
export function unixTimeToRippleTime(unixTime: number): number {
  return unixTime - 946684800;
}