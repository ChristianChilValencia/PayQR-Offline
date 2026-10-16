import { useEffect, useRef, useState } from "react";

export function useCopyFeedback() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function confirmCopy() {
    clearTimeout(timer.current);
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }
  return { copied, confirmCopy };
}
