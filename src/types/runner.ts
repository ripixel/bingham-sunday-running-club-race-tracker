/**
 * Runner data structure matching content/runners/{id}.json
 */
export interface Runner {
  id: string;
  name: string;
  anonymous: boolean;
  photo?: string;
  colorClass?: 'orange' | 'pink' | 'green' | 'blue';
  joinedDate?: string; // ISO date string
  startingValues?: {
    eventsAttended?: number;
    totalKm?: number;
    avgPace?: string; // Format: "MM:SS"
  };
}

/**
 * Runner with runtime-only nickname for tracking multiple guests
 */
export interface TrackedRunner extends Runner {
  nickname?: string; // Runtime only, not persisted
}
