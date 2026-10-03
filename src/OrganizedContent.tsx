import { useState } from 'react';
import { KeyboardTextarea } from './mobile';
import type { OrganizedReview, GeneratedDayStamp } from './aiContracts';

export function OrganizedContent({ record, onChange, onRemove, onOpen }: { record: OrganizedReview | GeneratedDayStamp; onChange: (patch: { text?: string; meaning?: string; hidden?: boolean }) => void; onRemove: () => void; onOpen: () => void }) {
  const isStamp = 'imageUrl' in record;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(isStamp ? record.meaning : record.text);
  if (record.hidden) return <details className="organized-hidden"><summary>已收起一条{isStamp ? '纪念印章' : '小狗回看'}</summary><button className="text-button" onClick={() => onChange({ hidden: false })}>重新显示</button><button className="text-button" onClick={onRemove}>删除</button></details>;
  return <article className={isStamp ? 'automatic-stamp-card' : 'organized-review'} data-testid={isStamp ? 'generated-day-stamp' : 'organized-review'}>
    {isStamp && <img src={record.imageUrl} alt="这一天的纪念印章" />}
    <div><span className="eyebrow">{isStamp ? '纪念这一步' : '小狗帮你收好的一句话'}{record.edited ? ' · 你改过' : ''}</span>
      {editing ? <><KeyboardTextarea aria-label="修改整理文字" value={draft} onChange={event => setDraft(event.target.value)} maxLength={220} /><button className="text-button" onClick={() => { if (draft.trim()) onChange(isStamp ? { meaning: draft.trim() } : { text: draft.trim() }); setEditing(false); }}>保存修改</button></> : <>{isStamp && <h3>{record.title}</h3>}<p>{isStamp ? record.meaning : record.text}</p>{'references' in record && record.references.map(source => <blockquote key={source.url}>{source.quote}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a></blockquote>)}</>}
      <button className="text-button" onClick={onOpen}>查看当时的记录</button>
      <details><summary>更多</summary><div className="organized-actions"><button className="text-button" onClick={() => setEditing(true)}>修改文字</button><button className="text-button" onClick={() => onChange({ hidden: true })}>收起</button><button className="text-button" onClick={onRemove}>删除</button></div></details>
    </div>
  </article>;
}
