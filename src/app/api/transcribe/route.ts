import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

interface ScribeWord {
  text: string;
  start: number;
  end: number;
  type: string;
  speaker_id?: string;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const audioFile = formData.get('audio') as File;
  const diarize = formData.get('diarize') === 'true';
  const numSpeakers = formData.get('num_speakers');

  if (!audioFile) {
    return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
  }

  const body = new FormData();
  body.append('file', audioFile, 'audio.webm');
  body.append('model_id', 'scribe_v1');
  body.append('language_code', 'eng');

  if (diarize) {
    body.append('diarize', 'true');
    if (numSpeakers) {
      body.append('num_speakers', numSpeakers.toString());
    }
  }

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();

  if (diarize && data.words) {
    // Group consecutive words by speaker into turns
    const turns: { speaker: string; text: string }[] = [];
    let currentSpeaker: string | null = null;
    let currentWords: string[] = [];

    for (const word of data.words as ScribeWord[]) {
      const speaker = word.speaker_id ?? 'unknown';
      if (speaker !== currentSpeaker) {
        if (currentSpeaker !== null && currentWords.length > 0) {
          turns.push({ speaker: currentSpeaker, text: currentWords.join(' ') });
        }
        currentSpeaker = speaker;
        currentWords = [word.text];
      } else {
        currentWords.push(word.text);
      }
    }
    if (currentSpeaker !== null && currentWords.length > 0) {
      turns.push({ speaker: currentSpeaker, text: currentWords.join(' ') });
    }

    return NextResponse.json({
      transcript: data.text ?? '',
      words: data.words,
      turns,
    });
  }

  return NextResponse.json({ transcript: data.text ?? '' });
}
