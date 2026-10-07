import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useScreenPortal } from "./mobile";
import type { StampGroup } from "./stampBook";
import { describeTimeStampOccurrence, resolveTimeStampDefinition, stampAsset, stampCategoryLabel, type StampDefinition } from "./stampDefinitions";

type CalendarStampProps = {index?:number;compact?:boolean} & (
  | {group:StampGroup;definition?:never;dateKey?:never;reason?:never;onOpen:(group:StampGroup)=>void}
  | {group?:undefined;definition:StampDefinition;dateKey:string;reason?:string;onOpen:()=>void}
);
export function CalendarStamp(props:CalendarStampProps) {
  const {group,index=0,compact=false}=props;
  const definition=group?resolveTimeStampDefinition(group):props.definition!;
  const dateKey=group?.dateKey??props.dateKey;
  const occurrence=group?describeTimeStampOccurrence(group):props.reason??definition.triggerDescription;
  const { screenRef } = useScreenPortal();
  const tooltipId = useId();
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const close = () => { clearTimeout(dismissTimer.current); setPosition(null); };
  const delayedClose = () => { dismissTimer.current = setTimeout(close, 120); };
  const show = (target: HTMLElement) => {
    clearTimeout(dismissTimer.current);
    const screen = screenRef.current;
    if (!screen) return;
    const rect = target.getBoundingClientRect(), bounds = screen.getBoundingClientRect();
    const scale = bounds.width / screen.clientWidth;
    const x = (rect.left + rect.width / 2 - bounds.left) / scale;
    const y = (rect.top - bounds.top) / scale;
    setPosition({ left: Math.max(12, Math.min(x - 126, screen.clientWidth - 264)), top: Math.max(96, Math.min(y - 166, screen.clientHeight - 230)) });
  };
  useEffect(() => {
    if (!position) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", dismiss);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("keydown", dismiss); window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); };
  }, [position]);
  useEffect(() => () => clearTimeout(dismissTimer.current), []);
  return <>
    <button type="button" data-testid="calendar-stamp" data-stamp-key={definition.key} data-stamp-category={definition.category} data-stamp-date={dateKey} className={`calendar-stamp ${compact ? "compact" : ""}`}
      aria-label={`${definition.name}，${group?.subject??stampCategoryLabel(definition.category)}，${dateKey}，第 ${index + 1} 枚`}
      aria-describedby={position ? tooltipId : undefined}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") show(event.currentTarget); }}
      onPointerLeave={delayedClose} onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) show(event.currentTarget); }}
      onBlur={close} onClick={() => { close(); if(props.group)props.onOpen(props.group);else props.onOpen(); }}>
      <img src={stampAsset(definition)} alt="" loading="lazy" decoding="async" draggable={false} />
    </button>
    {position && screenRef.current && createPortal(<div id={tooltipId} role="tooltip" className="stamp-tooltip" style={position}
      onPointerEnter={() => clearTimeout(dismissTimer.current)} onPointerLeave={close}>
      <span>{stampCategoryLabel(definition.category)} · {group?.subject??dateKey}</span><strong>{definition.name}</strong><p>{definition.meaning}</p>
      <small>{occurrence}</small>
    </div>, screenRef.current)}
  </>;
}
