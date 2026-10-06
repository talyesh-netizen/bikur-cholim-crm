"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The browser's built-in speech-to-text (Chrome, Edge, and Safari on
// iPhone/iPad/Mac). Not in TypeScript's DOM types, so typed loosely here.
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

const noSubscribe = () => () => {};

function getRecognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * One big "Tap to talk" button: speech is turned into text and added to
 * the note as you go. Tap again to stop. Phones stop listening after a
 * pause, so it quietly restarts until you tap Stop. Where the browser
 * has no speech-to-text, it says to use the keyboard's microphone.
 */
export function VoiceButton({
  onText,
  disabled,
  className,
}: {
  /** Called with each finished phrase, to append to the note. */
  onText: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  // null on the server (it can't know the browser), then the real answer.
  const supported = useSyncExternalStore(
    noSubscribe,
    () => getRecognitionClass() !== null,
    () => null
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const wantOn = useRef(false);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  // Stop listening if the page is left mid-sentence.
  useEffect(() => {
    return () => {
      wantOn.current = false;
      recognition.current?.stop();
    };
  }, []);

  const start = () => {
    const Recognition = getRecognitionClass();
    if (!Recognition) return;
    setProblem(null);
    const r = new Recognition();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event) => {
      let heard = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) onTextRef.current(result[0].transcript.trim());
        else heard += result[0].transcript;
      }
      setInterim(heard);
    };
    r.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        wantOn.current = false;
        setProblem("The microphone is blocked. Allow it for this site in your browser settings, or use the keyboard's microphone.");
      }
    };
    r.onend = () => {
      setInterim("");
      // Phones end after a pause; keep going until Stop is tapped.
      if (wantOn.current) {
        try {
          r.start();
          return;
        } catch {
          wantOn.current = false;
        }
      }
      setListening(false);
    };
    recognition.current = r;
    wantOn.current = true;
    try {
      r.start();
      setListening(true);
    } catch {
      wantOn.current = false;
      setProblem("Couldn't start the microphone. Please try again.");
    }
  };

  const stop = () => {
    wantOn.current = false;
    recognition.current?.stop();
    setListening(false);
  };

  if (supported === false) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        To talk instead of type, tap the box, then the microphone on your keyboard.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        type="button"
        size="lg"
        variant={listening ? "destructive" : "default"}
        className="h-16 w-full gap-3 rounded-2xl text-lg"
        disabled={disabled || supported === null}
        onClick={listening ? stop : start}
        aria-pressed={listening}
      >
        {listening ? <Square className="size-6" /> : <Mic className="size-6" />}
        {listening ? "Stop" : "Tap to talk"}
      </Button>
      {listening ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-destructive" aria-hidden />
          {interim ? `“${interim}”` : "Listening… just talk. Tap Stop when you're done."}
        </p>
      ) : null}
      {problem ? <p className="text-sm text-destructive">{problem}</p> : null}
    </div>
  );
}
