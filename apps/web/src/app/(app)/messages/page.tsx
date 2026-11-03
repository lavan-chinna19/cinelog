import { MessageCircle } from 'lucide-react';
export default function MessagesIndex() {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center p-10 text-center md:flex">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-amber/20 to-lavender/20 text-amber ring-1 ring-line"><MessageCircle className="h-7 w-7" /></div>
      <h2 className="font-heading text-lg font-semibold">Pick a conversation</h2>
      <p className="mt-1 max-w-xs text-sm text-ink-muted">Chat with friends and drop movie recommendations straight into the thread.</p>
    </div>
  );
}
