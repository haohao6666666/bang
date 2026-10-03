import { useId, useMemo, useState } from "react";
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, Cross2Icon } from "@radix-ui/react-icons";
import { BottomSheet } from "./mobile";
import { buildStampCollection, STAMP_CATEGORIES, stampAsset, stampCategoryLabel, type StampCategory, type StampCollectionInput, type StampEvidence } from "./stampDefinitions";
import "./stampCollection.css";

const evidenceLabels: Record<StampEvidence["kind"], string> = {
  focus: "投入", task: "任务", outcome: "成果", note: "便签", diary: "日记", echo: "回声", milestone: "里程碑",
};

export type StampCollectionProps = {
  data: StampCollectionInput;
  onOpenDate?: (dateKey: string) => void;
};

/** A read-only view over real saved records. Opening a stamp never creates an award. */
export function StampCollection({ data, onOpenDate }: StampCollectionProps) {
  const [category, setCategory] = useState<StampCategory>("time");
  const [acquisition, setAcquisition] = useState<"all" | "earned" | "unearned">("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const panelId = useId();
  const catalog = useMemo(() => buildStampCollection(data), [data]);
  const selected = catalog.find((item) => item.definition.key === selectedKey);
  const categoryEntries = catalog.filter((item) => item.definition.category === category);
  const entries = categoryEntries.filter((item) => acquisition === "all" || (acquisition === "earned" ? item.earned : !item.earned));
  const categoryInfo = STAMP_CATEGORIES.find((item) => item.key === category)!;
  const earnedCount = catalog.filter((item) => item.earned).length;

  return <section className="stamp-collection" data-category={category} data-testid="stamp-collection" aria-label="我的印章册">
    <header className="stamp-collection-heading">
      <div><span className="stamp-collection-kicker">一枚印章，一段故事</span><h2>我的印章收藏</h2><p>回看每枚章背后的真实经历。</p></div>
      <div className="stamp-collection-total"><strong>{earnedCount}</strong><span>种已收藏</span></div>
    </header>
    <div className="stamp-collection-category-tabs" role="tablist" aria-label="印章类别">
      {STAMP_CATEGORIES.map((item, index) => <button
        key={item.key} type="button" role="tab" id={`${panelId}-${item.key}`} aria-selected={category === item.key}
        aria-controls={`${panelId}-panel`} tabIndex={category === item.key ? 0 : -1}
        onClick={() => setCategory(item.key)}
        onKeyDown={(event) => {
          const nextIndex = event.key === "ArrowRight" ? (index + 1) % STAMP_CATEGORIES.length : event.key === "ArrowLeft" ? (index - 1 + STAMP_CATEGORIES.length) % STAMP_CATEGORIES.length : event.key === "Home" ? 0 : event.key === "End" ? STAMP_CATEGORIES.length - 1 : -1;
          if (nextIndex >= 0) {
            event.preventDefault();
            setCategory(STAMP_CATEGORIES[nextIndex].key);
            document.getElementById(`${panelId}-${STAMP_CATEGORIES[nextIndex].key}`)?.focus();
          }
        }}
      >{item.label}</button>)}
    </div>
    <div className="stamp-collection-filters" role="group" aria-label="印章获得状态">
      {([ ["all", "全部"], ["earned", "已获得"], ["unearned", "未获得"] ] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={acquisition === key} onClick={() => setAcquisition(key)}>{label}</button>)}
    </div>
    <section id={`${panelId}-panel`} role="tabpanel" aria-labelledby={`${panelId}-${category}`} className="stamp-collection-category">
      <div className="stamp-collection-section-heading"><div><h3>{categoryInfo.label}</h3><p>{categoryInfo.description}</p></div><span>{entries.length} 款</span></div>
      <div className="stamp-collection-grid">
        {entries.map(({ definition, earned, firstEarnedDate }) => <button
          type="button" key={definition.key} className={`stamp-collection-card ${earned ? "is-earned" : "is-unearned"}`}
          data-testid={`stamp-card-${definition.key}`} data-earned={earned}
          aria-label={`${definition.name}，${earned ? "已获得" : "未获得"}，查看详情`}
          onClick={() => setSelectedKey(definition.key)}
        >
          <span className="stamp-collection-art"><img src={stampAsset(definition)} alt={`${definition.name}印章`} loading="lazy" decoding="async" draggable={false} /></span>
          <span className="stamp-collection-card-heading">
            <span className="stamp-collection-card-category">{stampCategoryLabel(definition.category)}</span>
            <span className="stamp-collection-card-top"><strong>{definition.name}</strong></span>
            <span className="stamp-collection-status">{earned && <CheckIcon />}{earned ? "已获得" : "未获得"}</span>
          </span>
          <span className="stamp-collection-card-copy">
            <span className="stamp-collection-meaning">{definition.meaning}</span>
            <span className="stamp-collection-condition"><span>出现方式</span>{definition.triggerDescription}</span>
            <span className="stamp-collection-card-bottom"><span>{firstEarnedDate ? `首次 ${firstEarnedDate.replaceAll("-", ".")}` : "留待未来的某一页"}</span><span className="stamp-collection-read-more">细看这枚章<ArrowRightIcon aria-hidden="true" /></span></span>
          </span>
        </button>)}
      </div>
      {!entries.length && <div className="stamp-collection-empty" role="status"><p>{acquisition === "earned" ? "这一类还没有已获得的印章。它会随着真实经历自然留下。" : "这一类的印章都已收好。可以回看它们背后的故事。"}</p><button type="button" onClick={() => setAcquisition("all")}>查看这一类的全部印章 <ArrowRightIcon /></button></div>}
    </section>
    <p className="stamp-collection-footnote">印章自然来自你的记录。没有倒计时，也不必为了收集而安排生活。</p>

    <BottomSheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedKey(null); }} title={selected?.definition.name ?? "印章详情"} description={selected ? stampCategoryLabel(selected.definition.category) : undefined} snap={0.88}>
      {selected && <article className="stamp-collection-detail" data-category={selected.definition.category} data-testid="stamp-collection-detail">
        <button type="button" className="stamp-collection-close" aria-label="关闭印章详情" onClick={() => setSelectedKey(null)}><Cross2Icon /></button>
        <div className={`stamp-collection-detail-intro ${selected.earned ? "is-earned" : "is-unearned"}`}><img src={stampAsset(selected.definition)} alt={`${selected.definition.name}印章`} decoding="async" draggable={false} /><div><span className="stamp-collection-status">{selected.earned ? "已获得" : "未获得"}</span><p>{selected.definition.meaning}</p>{selected.firstEarnedDate && <small>首次获得于 {selected.firstEarnedDate}</small>}</div></div>
        <section className="stamp-collection-detail-section"><h3>出现方式</h3><p>{selected.definition.triggerDescription}</p></section>
        {selected.earned ? <>
          <section className="stamp-collection-detail-section"><h3>为什么获得</h3><p>{selected.reason}</p></section>
          <section className="stamp-collection-detail-section stamp-collection-evidence"><h3>这枚章的来处</h3><p className="stamp-collection-evidence-hint">展开一条记录，回看当时留下的内容。</p>
            {selected.evidence.map((item) => <details key={`${item.kind}-${item.id}`} data-testid={`stamp-evidence-${item.kind}-${item.id}`}>
              <summary><span className="stamp-collection-evidence-type">{evidenceLabels[item.kind]}</span><span><strong>{item.title}</strong><small>{item.dateKey}</small></span><ChevronDownIcon aria-hidden="true" /></summary>
              <div className="stamp-collection-evidence-body"><p>{item.body || "这条记录没有附加文字。"}</p><small>记录编号：{item.id}</small></div>
            </details>)}
          </section>
          {onOpenDate && selected.firstEarnedDate && <button type="button" className="stamp-collection-date-link" onClick={() => { const date = selected.firstEarnedDate!; setSelectedKey(null); onOpenDate(date); }}>翻到 {selected.firstEarnedDate} 的日历 <ArrowRightIcon /></button>}
        </> : <p className="stamp-collection-awaiting">未来有了这样的经历，它会自然留在这里。慢慢来就好。</p>}
      </article>}
    </BottomSheet>
  </section>;
}
