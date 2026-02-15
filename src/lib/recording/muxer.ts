import { execSync } from 'child_process'
import fs from 'fs'

export function muxVideoAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string
): void {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`)
  }
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`)
  }

  execSync(
    `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a libopus -shortest "${outputPath}"`,
    { stdio: 'pipe' }
  )
}

export function videoOnlyToWebm(videoPath: string, outputPath: string): void {
  execSync(`ffmpeg -y -i "${videoPath}" -c:v copy "${outputPath}"`, { stdio: 'pipe' })
}
