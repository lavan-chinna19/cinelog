'use client';
const EMOJI = ['😀','😂','🥹','😍','🤩','😎','🤔','😮','😢','😭','😱','🥶','😴','🙌','👏','👍','👎','🙏','🔥','💯','❤️','💜','🧡','✨','🎬','🍿','🎥','🎞️','📽️','🎟️','⭐','🌟','🏆','👀','💀','🤯','🫶','😅','🤝','🎉'];
export function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1 rounded-2xl border border-line bg-surface p-2 shadow-card animate-scale-in">
      {EMOJI.map((e) => <button key={e} type="button" onClick={() => onPick(e)} className="rounded-lg p-1.5 text-xl hover:bg-surface-raised" aria-label={`Insert ${e}`}>{e}</button>)}
    </div>
  );
}
