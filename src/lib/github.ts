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

    // Check if file exists and get its SHA
    const sha = await getFileSha(octokit, path);

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      message: `feat(content): Create runner "${runner.name}"`,
      content: base64Encode(content),
      branch: GITHUB_BRANCH,
      ...(sha && { sha }), // Include SHA if file exists
    });
  } catch (error) {
    console.error('Failed to create runner:', error);
    throw error;
  }
}

/**
 * Get the SHA of an existing file, or null if it doesn't exist
 */
async function getFileSha(
  octokit: Octokit,
  path: string
): Promise<string | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      ref: GITHUB_BRANCH,
    });

    if ('sha' in data) {
      return data.sha;
    }
    return null;
  } catch (error: any) {
    // File doesn't exist (404)
    if (error.status === 404) {
      return null;
    }
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

  // Check if file exists and get its SHA
  const sha = await getFileSha(octokit, path);

  await octokit.rest.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path,
    message: commitMessage,
    content: content,
    branch: GITHUB_BRANCH,
    ...(sha && { sha }), // Include SHA if file exists
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
 * Uses Git tree/commit API to batch all changes into a single commit
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
      nickname?: string; // Guest display name
      convertToRunner?: boolean; // Create full runner profile
      runnerNameOverride?: string; // Name for new runner (defaults to nickname)
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

    // Collect all files to create in one commit
    const filesToCreate: Array<{ path: string; content: string; isBase64?: boolean }> = [];
    const runnerIdMap: Record<string, string> = {}; // guest-xxx -> new-runner-id

    // 1. Prepare race photo blob
    const photoPath = `assets/images/races/${dateStr}.jpg`;
    const photoArrayBuffer = await data.photoBlob.arrayBuffer();
    const photoBytes = new Uint8Array(photoArrayBuffer);
    let photoBinary = '';
    for (let i = 0; i < photoBytes.byteLength; i++) {
      photoBinary += String.fromCharCode(photoBytes[i]);
    }
    const photoBase64 = btoa(photoBinary);
    filesToCreate.push({ path: photoPath, content: photoBase64, isBase64: true });
    const photoUrl = `/${photoPath.replace(/^assets\//, '')}`;

    // 2. Prepare any guest-to-runner conversions
    for (const p of data.participants) {
      if (p.convertToRunner && p.runnerId.startsWith('guest-')) {
        const runnerName = p.runnerNameOverride || p.nickname || 'New Runner';
        const runnerId = runnerName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        const newRunner: Runner = {
          id: runnerId,
          name: runnerName,
          anonymous: false,
          joinedDate: dateStr,
        };

        filesToCreate.push({
          path: `content/runners/${runnerId}.json`,
          content: JSON.stringify(newRunner, null, 2),
        });

        runnerIdMap[p.runnerId] = runnerId;
      }
    }

    // 3. Prepare Staging Data
    const stagingData = {
      date: data.date.toISOString(),
      mainPhoto: photoUrl,
      title: data.title || undefined,
      body: data.description || undefined,
      participants: data.participants.map((p) => {
        const isGuest = p.runnerId.startsWith('guest-');
        const convertedId = runnerIdMap[p.runnerId];
        const runnerId = convertedId || (isGuest ? 'guest' : p.runnerId);

        return {
          runner: runnerId,
          ...(isGuest && !convertedId && p.nickname ? { guestName: p.nickname } : {}),
          smallLoops: p.smallLoops,
          mediumLoops: p.mediumLoops,
          longLoops: p.longLoops,
          time: formatTime(p.endTime - p.startTime),
        };
      }),
    };

    const stagingPath = `content/staging/runs/${dateStr}.json`;
    filesToCreate.push({
      path: stagingPath,
      content: JSON.stringify(stagingData, null, 2),
    });

    // 4. Create all files in a single commit using Git Data API
    // Get the current commit SHA
    const { data: refData } = await octokit.rest.git.getRef({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: `heads/${GITHUB_BRANCH}`,
    });
    const latestCommitSha = refData.object.sha;

    // Get the tree SHA of the current commit
    const { data: commitData } = await octokit.rest.git.getCommit({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      commit_sha: latestCommitSha,
    });
    const baseTreeSha = commitData.tree.sha;

    // Create blobs for each file
    const treeItems: Array<{
      path: string;
      mode: '100644';
      type: 'blob';
      sha: string;
    }> = [];

    for (const file of filesToCreate) {
      const { data: blobData } = await octokit.rest.git.createBlob({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        content: file.content,
        encoding: file.isBase64 ? 'base64' : 'utf-8',
      });

      treeItems.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha,
      });
    }

    // Create a new tree with all the files
    const { data: newTree } = await octokit.rest.git.createTree({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      base_tree: baseTreeSha,
      tree: treeItems,
    });

    // Build commit message
    const newRunnerCount = Object.keys(runnerIdMap).length;
    let commitMessage = `feat(runs): add run data for ${dateStr}`;
    if (newRunnerCount > 0) {
      const runnerNames = Object.values(runnerIdMap).join(', ');
      commitMessage += `\n\nNew runners: ${runnerNames}`;
    }

    // Create the commit
    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      message: commitMessage,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    // Update the branch reference
    await octokit.rest.git.updateRef({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: `heads/${GITHUB_BRANCH}`,
      sha: newCommit.sha,
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

/**
 * Staged run data structure for loading previously staged runs
 */
export interface StagedRun {
  date: string;         // YYYY-MM-DD from filename
  dateTime: string;     // Full ISO from JSON
  mainPhoto: string;    // Path to photo
  title?: string;
  body?: string;
  participants: Array<{
    runner: string;
    guestName?: string;
    smallLoops: number;
    mediumLoops: number;
    longLoops: number;
    time: string;       // MM:SS or HH:MM:SS format
  }>;
}

/**
 * Fetch all staged runs from the repository
 */
export async function fetchStagedRuns(octokit: Octokit): Promise<StagedRun[]> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: 'content/staging/runs',
      ref: GITHUB_BRANCH,
    });

    if (!Array.isArray(data)) {
      return [];
    }

    const stagedRuns: StagedRun[] = [];

    // Filter for JSON files only
    const runFiles = data.filter(file =>
      file.type === 'file' &&
      file.name.endsWith('.json')
    );

    for (const file of runFiles) {
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: file.path,
        ref: GITHUB_BRANCH,
      });

      if ('content' in fileData) {
        const content = base64Decode(fileData.content);
        try {
          const runData = JSON.parse(content);
          const dateFromFilename = file.name.replace('.json', '');

          stagedRuns.push({
            date: dateFromFilename,
            dateTime: runData.date,
            mainPhoto: runData.mainPhoto,
            title: runData.title,
            body: runData.body,
            participants: runData.participants,
          });
        } catch (e) {
          console.warn(`Failed to parse staged run file: ${file.path}`, e);
        }
      }
    }

    // Sort by date descending (newest first)
    return stagedRuns.sort((a, b) => b.date.localeCompare(a.date));
  } catch (error: any) {
    // Directory doesn't exist (404) or empty
    if (error.status === 404) {
      return [];
    }
    console.error('Failed to fetch staged runs:', error);
    throw error;
  }
}
