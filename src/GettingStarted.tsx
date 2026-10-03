import { useEffect, useRef, useState } from "react";
import { ReferenceArt } from "./ReferenceArt";
import "./gettingStarted.css";

const steps = [
  { eyebrow: "01 · 认识知途", title: "把做过的小事，好好收起来", copy: "安排一件事，专心做一会儿，再聊两句或留个作品。小芽陪你记着，下次从这里继续。", hint: "今日安排 · 足迹回看 · 我的设置", art: "welcome" as const },
  { eyebrow: "02 · 今天的事", title: "从一件想做的事开始", copy: "点“＋ 添加一个想做的事”，写下任务、选类别，再填专注分钟数。想留下什么可以不填。", hint: "时长可自定为 1—180 分钟；用左侧手柄调整顺序。", art: "journaling" as const },
  { eyebrow: "03 · 专注", title: "这会儿，只做这一件", copy: "选中任务，点“开始投入”。圆圈里的时间慢慢走，小芽在旁边看书。点“先停一下”，它也陪你休息。", hint: "休息后点“继续投入”；想提前收工，点“结束”。", art: "reading" as const },
  { eyebrow: "04 · 时间到了", title: "做到了哪儿，你说了算", copy: "时间到会响一声。做完了、下次接着做，还是先放下？告诉小芽，也可以再加 10 分钟。", hint: "日历里：✓ 做完了 · ○ 还要继续 · × 先放下。", art: "cheering" as const },
  { eyebrow: "05 · 和小芽聊聊", title: "说一句，下次就接得上", copy: "回到今日，点“和小芽聊聊”。第一次选“好呀”，小芽就能回复并记住进度。比如说：耳朵画好了，尾巴下次画。", hint: "不用每次写总结。说“忘掉这件事”，也可以让小芽忘掉。", art: "thinking" as const },
  { eyebrow: "06 · 留下作品", title: "画作和文档，也有自己的位置", copy: "聊天里点“留作品”，选照片或文档，再点“留下”。想听小芽说说作品，先开启“让小芽读作品”。", hint: "支持照片、TXT、DOCX、文字 PDF，单个文件不超过 10 MB。", art: "journaling" as const },
  { eyebrow: "07 · 足迹", title: "翻到那一天，再看一眼", copy: "日历卡片左右滑，点开就能看任务、时长、作品和当天的章。“作品”只收作品，时间圆环能看时间花在哪里。", hint: "印章册会记下每种章的次数；日历只盖第一次获得的章。", art: "resting" as const },
  { eyebrow: "08 · 我的", title: "按你的习惯来", copy: "在“我的”里调整记忆、读作品和主动聊天，也能导出作品与聊天。想再看看这份教程，点“重看新手教程”。", hint: "记录保存在当前设备和浏览器，换设备不会自动搬过去。", art: "welcome" as const },
];

export function GettingStarted({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLElement>(null);
  const current = steps[step];
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => { dialog.current?.scrollTo({top:0}); }, [step]);
  return <div className="getting-started-backdrop" role="presentation">
    <section ref={dialog} tabIndex={-1} className="getting-started" role="dialog" aria-modal="true" aria-labelledby="getting-started-title" aria-describedby="getting-started-copy" data-testid="getting-started" onKeyDown={event => { if (event.key === "Escape") onClose(); if(event.key === "Tab") {const controls=dialog.current?.querySelectorAll<HTMLButtonElement>('button');if(!controls?.length)return;const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}} }}>
      <button className="getting-started-skip" onClick={onClose}>跳过</button>
      <div className="getting-started-art"><ReferenceArt kind={current.art} alt="小芽陪你熟悉知途" eager /></div>
      <p className="eyebrow">{current.eyebrow}</p>
      <h2 id="getting-started-title">{current.title}</h2>
      <p id="getting-started-copy" className="getting-started-copy">{current.copy}</p>
      <p className="getting-started-hint">{current.hint}</p>
      <div className="getting-started-progress" aria-label={`第 ${step + 1} 步，共 ${steps.length} 步`}>
        {steps.map((item, index) => <span key={item.eyebrow} className={index === step ? "active" : index < step ? "done" : ""} />)}
      </div>
      <div className="getting-started-actions"><small>{step + 1} / {steps.length}</small>
        {step > 0 && <button className="text-button" onClick={() => setStep(step - 1)}>上一步</button>}
        <button className="primary-button" onClick={() => step === steps.length - 1 ? onClose() : setStep(step + 1)}>{step === steps.length - 1 ? "开始使用" : "下一步"}</button>
      </div>
    </section>
  </div>;
}
