import { useId, useState, type CSSProperties } from "react";
import type { StampGroup } from "./stampBook";
import { buildActivityDistribution, formatActivityDuration, formatActivityPercentage } from "./activityColors";
import "./timeDistribution.css";

export function TimeDistribution({ groups }: { groups: readonly StampGroup[] }) {
  const titleId = useId();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { totalMs, activities } = buildActivityDistribution(groups);
  const selected = activities.find((activity) => activity.key === selectedKey);
  const totalMinutes = Math.floor(totalMs / 60_000);
  const totalSeconds = Math.floor(totalMs / 1000) % 60;
  let accumulated = 0;

  return <section className="activity-distribution" aria-labelledby={titleId} data-testid="time-distribution" data-total-ms={totalMs}>
    <header className="activity-distribution-header">
      <div><span className="activity-distribution-kicker">时间的去处</span><h3 id={titleId}>时间分布</h3></div>
      <span className="activity-distribution-count">{activities.length ? `${activities.length} 个投入方向` : "留白，也很好"}</span>
    </header>
    <div className={`activity-distribution-overview ${selected ? "has-selection" : ""}`}>
      <div className="activity-ring" role="img" aria-label={totalMs > 0 ? `实际投入共 ${formatActivityDuration(totalMs)}，${activities.map((activity) => `${activity.label} ${formatActivityPercentage(activity.percentage)}`).join("，")}` : "暂无真实投入"}>
        <svg viewBox="0 0 180 180" aria-hidden="true">
          <circle className="activity-ring-guide" cx="90" cy="90" r="84" />
          <circle className="activity-ring-track" cx="90" cy="90" r="66" />
          <g transform="rotate(-90 90 90)">
            {activities.map((activity) => {
              const offset = accumulated;
              accumulated += activity.percentage;
              const gap = activities.length > 1 ? Math.min(1.1, activity.percentage * 0.16) : 0;
              return <circle key={activity.key} className={`activity-ring-segment ${selected?.key === activity.key ? "is-selected" : ""}`} data-activity={activity.key} data-percentage={activity.percentage} cx="90" cy="90" r="66" pathLength="100" stroke={activity.color} strokeDasharray={`${activity.percentage - gap} ${100 - activity.percentage + gap}`} strokeDashoffset={-offset - gap / 2} />;
            })}
          </g>
        </svg>
        <div className="activity-ring-center" aria-hidden="true"><small>已记录投入</small><strong>{totalMinutes || Math.floor(totalMs / 1000)}</strong><span>{totalMinutes > 0 ? "分钟" : "秒"}{totalMinutes > 0 && totalSeconds > 0 ? ` · ${totalSeconds} 秒` : ""}</span></div>
      </div>
      <div className="activity-distribution-story" aria-live="polite" aria-atomic="true">
        {selected ? <><span className="activity-story-dot" style={{ background: selected.color }} /><strong>{selected.label}</strong><p>{formatActivityDuration(selected.actualMs)}<br />占这段时间的 {formatActivityPercentage(selected.percentage)}</p><button type="button" onClick={() => setSelectedKey(null)}>回看全部投入 <span aria-hidden="true">↗</span></button></>
          : <><span className="activity-story-sprout" aria-hidden="true">✦</span><strong>{totalMs > 0 ? <>每一份投入，<br />都有自己的颜色。</> : <>新的一页，<br />慢慢开始。</>}</strong><p>{totalMs > 0 ? "轻点下方方向，回看时间的去处。" : "完成一段真实投入后，时间会在这里留下颜色。"}</p></>}
      </div>
    </div>
    {activities.length > 0 && <div className="activity-distribution-legend" role="group" aria-label="按投入方向查看时间">
      {activities.map((activity) => <button type="button" key={activity.key} data-activity={activity.key} data-actual-ms={activity.actualMs} aria-pressed={selected?.key === activity.key} style={{ "--activity-color": activity.color } as CSSProperties} onClick={() => setSelectedKey(selected?.key === activity.key ? null : activity.key)}>
        <span className="activity-legend-color" aria-hidden="true" /><span className="activity-legend-label">{activity.label}</span><span className="activity-legend-duration">{formatActivityDuration(activity.actualMs)}</span><span className="activity-legend-percentage">{formatActivityPercentage(activity.percentage)}</span>
      </button>)}
    </div>}
  </section>;
}
