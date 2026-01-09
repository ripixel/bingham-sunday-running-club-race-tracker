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
 * Loop distances for the running club
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
 * Participant data for a single run
 */
export interface Participant {
  runner: string; // Runner ID (slug) or "guest"
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
  mainPhoto: string;
  weather?: string;
  isSpecialEvent: boolean;
  participants: Participant[];
  body?: string; // Markdown content after frontmatter
}

/**
 * Live tracking state for a participant during a run
 */
export interface LiveParticipant extends Participant {
  runnerId: string; // Same as runner field
  runnerName: string; // Display name
  runnerPhoto?: string; // Photo URL
  nickname?: string; // Runtime nickname for guests
  startTime: number; // Timestamp in ms
  endTime?: number; // Timestamp in ms when finished
  finished: boolean;
}
