/**
 * Loop configuration
 */
export interface LoopConfig {
  id: 'small' | 'medium' | 'long';
  distance: number; // in km
  title: string;
  color: 'pink' | 'green' | 'blue';
}

/**
 * Loop distances for the running club (simple accessor)
 */
export const LOOP_DISTANCES = {
  small: 0.8,
  medium: 1.0,
  long: 1.2,
} as const;

/**
 * Loop configurations with full metadata
 */
export const LOOP_CONFIGS: Record<'small' | 'medium' | 'long', LoopConfig> = {
  small: {
    id: 'small',
    distance: 0.8,
    title: 'Small Loop',
    color: 'pink',
  },
  medium: {
    id: 'medium',
    distance: 1.0,
    title: 'Medium Loop',
    color: 'green',
  },
  long: {
    id: 'long',
    distance: 1.2,
    title: 'Long Loop',
    color: 'blue',
  },
};

/**
 * Participant data for a single run (persisted to GitHub)
 */
export interface Participant {
  runner: string; // Runner ID (slug) or "guest"
  guestName?: string; // Display name for guests (only when runner="guest")
  distance: number; // Total distance in km
  smallLoops: number;
  mediumLoops: number;
  longLoops: number;
  time: string; // Format: "MM:SS"
}

/**
 * Run result data structure matching content/results/{YYYY-MM-DD}.md
 */
export interface RunResult {
  date: string; // ISO datetime string
  title: string;
  eventTitle: string;
  eventDescription?: string;
  location: string;
  mainPhoto?: string;
  weather?: string;
  isSpecialEvent: boolean;
  participants: Participant[];
  body?: string; // Markdown content after frontmatter
}

/**
 * Live tracking state for a participant during a run (runtime only)
 */
export interface LiveParticipant {
  runnerId: string; // Runner ID or "guest"
  repoId?: string; // Original ID to use when committing (e.g. 'guest')
  runnerName: string; // Display name
  runnerPhoto?: string; // Photo URL
  nickname?: string; // Runtime nickname for guests
  smallLoops: number;
  mediumLoops: number;
  longLoops: number;
  startTime: number; // Timestamp in ms
  finishTime?: number; // Elapsed time in ms when finished
  status: 'running' | 'finished' | 'completed';
  convertToRunner?: boolean; // Flag to create full runner on submit
  runnerNameOverride?: string; // Custom name for runner conversion (defaults to nickname)
}
