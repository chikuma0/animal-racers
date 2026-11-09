/** Portable review files from this harness's own UI recordings only. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, writeFile, stat, unlink } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const processFile = promisify(execFile);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const ownedRoot = fileURLToPath(new URL('../../docs/production/evidence/revision2-tail-runtime/', import.meta.url));
export async function preparePoseMedia(directory, files, onProgress = () => {}) {
  directory = resolve(directory);
  assert.ok(directory.startsWith(ownedRoot) && directory !== ownedRoot, 'only owned pose evidence directories');
  const processOptions = { timeout: 180_000, maxBuffer: 1024 * 1024 }, entries = [];
  const decode = async path => {
    const result = await processFile('ffmpeg', ['-v', 'error', '-nostdin', '-threads', '1', '-i', path, '-map', '0:v:0', '-map', '0:a?', '-fps_mode', 'passthrough', '-enc_time_base', '1:1000000', '-f', 'null', '-'], processOptions);
    assert.equal(result.stderr.trim(), '', 'full recording decode must be clean');
  };
  const probe = async path => JSON.parse((await processFile('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], processOptions)).stdout);
  for (const raw of files) {
    assert.ok(raw.startsWith(directory + sep) && /\.(webm|mp4)$/.test(raw) && !raw.endsWith('-review.mp4'));
    onProgress('media-processing-start', { raw: raw.slice(directory.length + 1) });
    await decode(raw);
    const rawProbe = await probe(raw), rawSha256 = digest(await readFile(raw)), rawBytes = (await stat(raw)).size;
    const destination = raw.slice(0, -extname(raw).length) + '-review.mp4';
    await processFile('ffmpeg', ['-v', 'error', '-nostdin', '-n', '-threads', '1', '-i', raw, '-map', '0:v:0', '-an', '-vf', 'scale=960:-2', '-r', '30', '-c:v', 'libx264', '-threads', '1', '-preset', 'veryfast', '-crf', '25', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', destination], processOptions);
    await decode(destination);
    const outputProbe = await probe(destination), rawDuration = Number(rawProbe.format.duration);
    assert.ok(Number(outputProbe.format.duration) > .2, 'recording must contain playable motion');
    if (Number.isFinite(rawDuration)) assert.ok(Math.abs(Number(outputProbe.format.duration) - rawDuration) < .5, 'compression retains full duration');
    assert.ok(outputProbe.streams.some(s => s.codec_type === 'video' && s.codec_name === 'h264' && s.width === 960));
    assert.ok(!rawProbe.streams.some(s => s.codec_type === 'audio'), 'pose capture has no audio');
    const entry = { rawFile: raw.slice(directory.length + 1), rawSha256, rawBytes, rawDecode: 'complete; no errors with passthrough microsecond output timebase', rawProbe,
      file: destination.slice(directory.length + 1), sha256: digest(await readFile(destination)), bytes: (await stat(destination)).size, outputDecode: 'complete; no errors', outputProbe,
      encoding: 'H264 CRF25,960px wide,30fps,silent canvas capture;1 thread. Constant-rate review copy, not original frame cadence or controlled performance evidence.' };
    await writeFile(destination + '.json', JSON.stringify(entry, null, 2) + '\n', { flag: 'wx' });
    await unlink(raw); // This run's duplicate only; both complete decodes passed.
    entries.push(entry); onProgress('media-processing-end', { file: entry.file, rawBytes, bytes: entry.bytes });
  }
  return entries;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.length >= 4, 'Usage: node prepare-pose-media.mjs OWNED_RUN_DIRECTORY RAW_FILE [RAW_FILE...]');
  const directory = resolve(process.argv[2]);
  const entries = await preparePoseMedia(directory, process.argv.slice(3).map(p => resolve(p)), (kind, data) => console.log(kind, JSON.stringify(data)));
  await writeFile(resolve(directory, `media-recovery-${Date.now()}.json`), JSON.stringify(entries, null, 2) + '\n', { flag: 'wx' });
  console.log('PORTABLE POSE MEDIA VERIFIED');
}
