'use client';

import type { MediaRow } from '@/types/graph';

interface Props {
  media: MediaRow[];
}

export default function MediaGallery({ media }: Props) {
  if (media.length === 0) {
    return (
      <div className="text-slate-500 text-sm italic p-4">
        No media captured.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 p-2">
      {media.map((m) => (
        <div key={m.id} className="relative group">
          <img
            src={m.file_path}
            alt={m.caption || 'Media'}
            className="w-full h-32 object-cover rounded-lg border border-slate-700/50"
          />
          {m.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs text-slate-300 p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
              {m.caption}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
