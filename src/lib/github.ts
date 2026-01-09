import { Octokit } from 'octokit';
import { GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } from './config';
import type { Runner } from '../types/runner';
// import type { Participant } from '../types/result';

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
  runner: Runner,
  photoBlob?: Blob | null
): Promise<void> {
  try {
    // 1. Upload Photo if present
    if (photoBlob) {
      const photoPath = `assets/images/runners/${runner.id}.jpg`;
      const photoUrl = await uploadImage(
        octokit,
        photoBlob,
        photoPath,
        `feat(images): add photo for runner ${runner.name}`
      );
      runner.photo = photoUrl;
    }

    // 2. Commit Runner JSON
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
 * Upload an image to the repository
 */
export async function uploadImage(
  octokit: Octokit,
  imageBlob: Blob,
  path: string,
  commitMessage: string
): Promise<string> {
  const arrayBuffer = await imageBlob.arrayBuffer();
  // Encode as base64
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const content = btoa(binary);

  await octokit.rest.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path,
    message: commitMessage,
    content: content,
    branch: GITHUB_BRANCH,
  });

  return `/${path.replace(/^assets\//, '')}`;
}

/**
 * Format time in MM:SS format or HH:MM:SS if needed
 */
function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Create a run result file in the repository (Staging Flow)
 */
export async function createRunResult(
  octokit: Octokit,
  data: {
    date: Date;
    photoBlob: Blob;
    title?: string;
    description?: string;
    participants: Array<{
      runnerId: string;
      smallLoops: number;
      mediumLoops: number;
      longLoops: number;
      startTime: number;
      endTime: number;
    }>;
  }
): Promise<void> {
  try {
    const dateStr = data.date.toISOString().split('T')[0]; // YYYY-MM-DD

    // 1. Upload Race Photo
    const photoPath = `assets/images/races/${dateStr}.jpg`;
    const photoUrl = await uploadImage(
      octokit,
      data.photoBlob,
      photoPath,
      `feat(images): add race photo for ${dateStr}`
    );

    // 2. Prepare Staging Data
    const stagingData = {
      date: data.date.toISOString(),
      mainPhoto: photoUrl,
      title: data.title || undefined,
      body: data.description || undefined,
      participants: data.participants.map((p) => ({
        runner: p.runnerId.startsWith('guest-') ? 'guest' : p.runnerId,
        smallLoops: p.smallLoops,
        mediumLoops: p.mediumLoops,
        longLoops: p.longLoops,
        time: formatTime(p.endTime - p.startTime),
      })),
    };

    // 3. Commit Staging JSON
    const stagingPath = `content/staging/runs/${dateStr}.json`;
    const content = JSON.stringify(stagingData, null, 2);

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: stagingPath,
      message: `feat(runs): add run data for ${dateStr}`,
      content: base64Encode(content),
      branch: GITHUB_BRANCH,
    });

  } catch (error) {
    console.error('Failed to create run result:', error);
    throw error;
  }
}

/**
 * Fetch the latest run times for sorting (Seed Order)
 */
export async function fetchLatestRunTimes(octokit: Octokit): Promise<Record<string, number>> {
  try {
    // 1. List result files
    const { data } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: 'content/results',
      ref: GITHUB_BRANCH,
    });

    if (!Array.isArray(data)) return {};

    // 2. Find latest file (sort by name desc)
    const resultFiles = data
      .filter(f => f.name.endsWith('.md'))
      .sort((a, b) => b.name.localeCompare(a.name));

    if (resultFiles.length === 0) return {};

    const latestFile = resultFiles[0];

    // 3. Fetch content
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: latestFile.path,
      ref: GITHUB_BRANCH,
    });

    if (!('content' in fileData)) return {};

    const content = base64Decode(fileData.content);

    // 4. Parse simple frontmatter (regex) to extract times
    const times: Record<string, number> = {};

    // Split by indentation to group participants
    const parts = content.split('participants:');
    if (parts.length < 2) return {};

    const participantsBlock = parts[1].split('---')[0]; // simple split

    // Match runner and time blocks
    const lines = participantsBlock.split('\n');
    let currentRunner: string | null = null;

    for (const line of lines) {
      const runnerMatch = line.match(/^\s+-\s+runner:\s+["']?([^"']+)["']?/);
      if (runnerMatch) {
        currentRunner = runnerMatch[1];
        continue;
      }

      const timeMatch = line.match(/^\s+time:\s+["']?(\d+):(\d+)["']?/);
      if (currentRunner && timeMatch) {
        const mins = parseInt(timeMatch[1], 10);
        const secs = parseInt(timeMatch[2], 10);
        const ms = (mins * 60 + secs) * 1000;
        times[currentRunner] = ms;
        currentRunner = null; // Reset
      }
    }

    return times;

  } catch (error) {
    console.warn('Failed to fetch latest run times:', error);
    return {};
  }
}
