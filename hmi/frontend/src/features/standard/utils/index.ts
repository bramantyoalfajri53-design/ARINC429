import { STANDARD_MODE_CONFIG } from "../config";

export function getStandardApiPath(endpoint: string): string {
  return `${STANDARD_MODE_CONFIG.apiPrefix}${endpoint}`;
}

