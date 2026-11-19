type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechHost = {
  speechSynthesis?: { speak: (utterance: unknown) => void; cancel: () => void };
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

function host(): SpeechHost {
  return globalThis as SpeechHost;
}

export function speakText(text: string): boolean {
  const speech = host().speechSynthesis;
  const Utterance = (globalThis as { SpeechSynthesisUtterance?: new (value: string) => unknown }).SpeechSynthesisUtterance;
  const clean = text.trim();
  if (!speech || !Utterance || clean.length === 0) {
    return false;
  }
  speech.cancel();
  const utterance = new Utterance(clean);
  (utterance as { lang: string }).lang = "fr-FR";
  speech.speak(utterance);
  return true;
}

export function startDictation(onText: (text: string) => void): { stop: () => void } | null {
  const Ctor = host().SpeechRecognition ?? host().webkitSpeechRecognition;
  if (!Ctor) {
    return null;
  }
  const recognition = new Ctor();
  recognition.lang = "fr-FR";
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript ?? "";
    if (transcript.trim().length > 0) {
      onText(transcript.trim());
    }
  };
  recognition.start();
  return { stop: () => recognition.stop() };
}
