import { useEffect, useRef } from "react";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { ReferenceArt } from "./ReferenceArt";
import { BrandMark } from "./BrandArt";
import "./welcomeTransition.css";

const SESSION_KEY = "jixiang-welcome-seen-v1";

export function shouldShowWelcome(reduceMotion: boolean, running: boolean) {
  if (reduceMotion || running || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try { return sessionStorage.getItem(SESSION_KEY) !== "yes"; } catch { return true; }
}

export function markWelcomeSeen() {
  try { sessionStorage.setItem(SESSION_KEY, "yes"); } catch { /* The entrance also works without browser storage. */ }
}

export function WelcomeTransition({ onComplete, reduceMotion }: { onComplete: () => void; reduceMotion: boolean }) {
  const finish = useRef(onComplete);
  finish.current = onComplete;
  const enterButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finishImmediately = () => { if (preference.matches) finish.current(); };
    if (reduceMotion || preference.matches) { finish.current(); return; }
    // Native focus/scroll-into-view in a scaled preview can scroll the hidden
    // device overflow while the settings sheet closes. Keep this app transition
    // anchored to its screen; do not move or animate the device chrome.
    enterButton.current?.closest<HTMLElement>("[data-testid='device-screen']")?.scrollTo({ top: 0, left: 0 });
    enterButton.current?.focus({ preventScroll: true });
    // This is a short welcome, not a loading gate; it always finishes even if artwork fails.
    const timeout = window.setTimeout(() => finish.current(), 1500);
    preference.addEventListener("change", finishImmediately);
    return () => { window.clearTimeout(timeout); preference.removeEventListener("change", finishImmediately); };
  }, [reduceMotion]);

  return <section className="welcome-transition" role="dialog" aria-modal="true" aria-labelledby="welcome-heading" data-testid="welcome-transition" onKeyDown={event => { if (event.key === "Escape") finish.current(); }}>
    <div className="welcome-paper-edge" aria-hidden="true" />
    <div className="welcome-brand"><BrandMark/><small>陪伴并记录成长的AI应用</small></div>
    <div className="welcome-scene" aria-hidden="true">
      <span className="welcome-orbit" /><span className="welcome-spark one">✧</span><span className="welcome-spark two">✦</span>
      <ReferenceArt kind="welcome" className="welcome-puppy" eager />
      <span className="welcome-label">把今天，轻轻翻开</span>
    </div>
    <h1 id="welcome-heading">让热爱有位置，<br />让每一步有回响。</h1>
    <p className="welcome-caption">从一个小小的开始，走向自己的方向。</p>
    <div className="welcome-path" aria-hidden="true"><span>安排</span><i /><span>投入</span><i /><span>回声</span><i /><span>印迹</span></div>
    <button type="button" ref={enterButton} className="welcome-enter" onClick={() => finish.current()}>进入知途 <ArrowRightIcon /></button>
    <span className="welcome-footer" aria-hidden="true">每一天，都是值得收藏的一页</span>
  </section>;
}
