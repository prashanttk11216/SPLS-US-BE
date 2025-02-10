// Utility function to calculate the distance between two lat/lng points (Haversine formula)
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  unit: 'km' | 'miles' = 'miles' // Default unit is kilometers
): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  let distance = R * c; // Distance in km

  // Convert to the desired unit
  if (unit === 'miles') {
    distance *= 0.621371; // Convert km to miles
  }

  return Math.round(distance); // Return rounded distance
}

export async function streamToBuffer(stream: any): Promise<Buffer> { 
  const chunks: Uint8Array[] = [];
  return new Promise((resolve, reject) => {
      stream.on('data', (chunk: any) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
  });
}


/**
 * Calculate the time difference between two dates and return it in a formatted string.
 *
 * @param {Date | number} startDate - The start date/time (or timestamp in milliseconds).
 * @param {Date | number} endDate - The end date/time (or timestamp in milliseconds).
 * @returns {string} - The formatted time difference (e.g., "2y", "3m", "5d", "4h", "10m", "20s").
 */
export function formatTimeDifference(differenceInTime: number): string {
  const ageInSeconds = Math.floor(differenceInTime / 1000); // Seconds
  const ageInMinutes = Math.floor(ageInSeconds / 60); // Minutes
  const ageInHours = Math.floor(ageInMinutes / 60); // Hours
  const ageInDays = Math.floor(ageInHours / 24); // Days
  const ageInMonths = Math.floor(ageInDays / 30.44); // Approximate months
  const ageInYears = Math.floor(ageInDays / 365.25); // Approximate years

  if (ageInYears > 0) {
    return `${ageInYears}y`;
  } else if (ageInMonths > 0) {
    return `${ageInMonths}mo`;
  } else if (ageInDays > 0) {
    return `${ageInDays}d`;
  } else if (ageInHours > 0) {
    return `${ageInHours}h`;
  } else if (ageInMinutes > 0) {
    return `${ageInMinutes}min`;
  } else if (ageInSeconds > 0) {
    return `${ageInSeconds}s`;
  } else {
    return "0s"; // Default to 0 seconds if no difference
  }
}