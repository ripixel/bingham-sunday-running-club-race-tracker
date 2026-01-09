import { Octokit } from 'octokit';
import { GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } from './config';
import type { Runner } from '../types/runner';
import type { Participant } from '../types/result';

/**
 * Create Octokit instance with auth token
 */
export function createGitHubClient(token: string): Octokit {
  return new Octokit({ auth: token });
}


/**
 * Decode base64 string to UTF-8
 */
function base64Decode(str: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(str), c => c.charCodeAt(0)));
}

/**
 * Encode UTF-8 string to base64
 */
function base64Encode(str: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}

/**
 * Fetch all runners from the repository
 */
export async function fetchRunners(octokit: Octokit): Promise<Runner[]> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: 'content/runners',
      ref: GITHUB_BRANCH,
    });

    if (!Array.isArray(data)) {
      throw new Error('Expected directory listing');
    }

    const runners: Runner[] = [];

    // Filter out _index.json or Schema definition files if any
    const runnerFiles = data.filter(file =>
      file.type === 'file' &&
      file.name.endsWith('.json') &&
      !file.name.startsWith('_')
    );

    for (const file of runnerFiles) {
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: file.path,
        ref: GITHUB_BRANCH,
      });

      if ('content' in fileData) {
        // Fix: Use browser-native decoding instead of Buffer
        const content = base64Decode(fileData.content);
        try {
          const runner: Runner = JSON.parse(content);
          // Ensure ID matches filename if relying on it
          if (!runner.id) {
            runner.id = file.name.replace('.json', '');
          }
          runners.push(runner);
        } catch (e) {
          console.warn(`Failed to parse runner file: ${file.path}`, e);
        }
      }
    }

    return runners.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Failed to fetch runners:', error);
    throw error;
  }
}

/**
 * Create a new runner file in the repository
 */
export async function createRunner(
  octokit: Octokit,
  runner: Runner
): Promise<void> {
  try {
    const content = JSON.stringify(runner, null, 2);
    const path = `content/runners/${runner.id}.json`;

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      message: `feat(content): Create runner "${runner.name}"`,
      content: base64Encode(content),
      branch: GITHUB_BRANCH,
    });
  } catch (error) {
    console.error('Failed to create runner:', error);
    throw error;
  }
}

/**
 * Format time in MM:SS format
 */
function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Calculate total distance from loop counts
 */
function calculateDistance(smallLoops: number, mediumLoops: number, longLoops: number): number {
  return smallLoops * 0.8 + mediumLoops * 1.0 + longLoops * 1.2;
}

/**
 * Create a run result file in the repository
 */
export async function createRunResult(
  octokit: Octokit,
  result: {
    date: Date;
    title: string;
    eventTitle: string;
    eventDescription?: string;
    location: string;
    mainPhoto: string;
    weather?: string;
    isSpecialEvent: boolean;
    participants: Array<{
      runnerId: string;
      smallLoops: number;
      mediumLoops: number;
      longLoops: number;
      startTime: number;
      endTime: number;
    }>;
    body?: string;
  }
): Promise<void> {
  try {
    // Format date for filename and frontmatter
    const dateStr = result.date.toISOString().split('T')[0]; // YYYY-MM-DD
    const isoDateTime = result.date.toISOString();

    // Build participants array
    const participants: Participant[] = result.participants.map((p) => ({
      runner: p.runnerId,
      distance: parseFloat(calculateDistance(p.smallLoops, p.mediumLoops, p.longLoops).toFixed(1)),
      smallLoops: p.smallLoops,
      mediumLoops: p.mediumLoops,
      longLoops: p.longLoops,
      time: formatTime(p.endTime - p.startTime),
    }));

    // Build YAML frontmatter
    const frontmatter = {
      date: isoDateTime,
      title: result.title,
      eventTitle: result.eventTitle,
      eventDescription: result.eventDescription,
      location: result.location,
      mainPhoto: result.mainPhoto,
      weather: result.weather,
      isSpecialEvent: result.isSpecialEvent,
      participants,
    };

    // Convert to YAML string (simple approach)
    const yamlLines = ['---'];
    yamlLines.push(`date: ${frontmatter.date}`);
    yamlLines.push(`title: "${frontmatter.title}"`);
    yamlLines.push(`eventTitle: "${frontmatter.eventTitle}"`);
    if (frontmatter.eventDescription) {
      yamlLines.push(`eventDescription: "${frontmatter.eventDescription}"`);
    }
    yamlLines.push(`location: "${frontmatter.location}"`);
    yamlLines.push(`mainPhoto: "${frontmatter.mainPhoto}"`);
    if (frontmatter.weather) {
      yamlLines.push(`weather: "${frontmatter.weather}"`);
    }
    yamlLines.push(`isSpecialEvent: ${frontmatter.isSpecialEvent}`);
    yamlLines.push('participants:');

    participants.forEach((p) => {
      yamlLines.push(`  - runner: "${p.runner}"`);
      yamlLines.push(`    distance: ${p.distance}`);
      yamlLines.push(`    smallLoops: ${p.smallLoops}`);
      yamlLines.push(`    mediumLoops: ${p.mediumLoops}`);
      yamlLines.push(`    longLoops: ${p.longLoops}`);
      yamlLines.push(`    time: "${p.time}"`);
    });

    yamlLines.push('---');

    const content = yamlLines.join('\n') + '\n' + (result.body || '');
    const path = `content/results/${dateStr}.md`;

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      message: `feat(content): Create run result "${result.title}"`,
      content: base64Encode(content),
      branch: GITHUB_BRANCH,
    });
  } catch (error) {
    console.error('Failed to create run result:', error);
    throw error;
  }
}
