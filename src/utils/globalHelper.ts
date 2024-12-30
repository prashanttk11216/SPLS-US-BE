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