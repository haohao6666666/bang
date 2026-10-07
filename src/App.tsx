import { MobileRuntime } from "./mobile";
import Prototype from "./Prototype";
import {useEffect,useState} from 'react';
import {DEMO_SESSION_KEY,DEMO_RELEASE_KEY,DEMO_RELEASE,seedJudgeDemo} from './judgeDemo';

export default function App() {
  const [demo,setDemo]=useState(()=>sessionStorage.getItem(DEMO_SESSION_KEY)==='yes');
  const [demoRevision,setDemoRevision]=useState(0);
  const [updatingDemo,setUpdatingDemo]=useState(()=>demo&&localStorage.getItem(DEMO_RELEASE_KEY)!==DEMO_RELEASE);
  useEffect(()=>{
    if(!demo||localStorage.getItem(DEMO_RELEASE_KEY)===DEMO_RELEASE)return;
    let active=true;
    // Refresh the fictional scenario after a release, never personal records.
    seedJudgeDemo().then(()=>{if(active){setDemoRevision(value=>value+1);setUpdatingDemo(false);}}).catch(()=>{
      if(active){sessionStorage.removeItem(DEMO_SESSION_KEY);setDemo(false);setUpdatingDemo(false);}
    });
    return()=>{active=false;};
  },[demo]);
  const enterDemo=async()=>{await seedJudgeDemo();sessionStorage.setItem(DEMO_SESSION_KEY,'yes');setDemo(true);};
  const exitDemo=()=>{sessionStorage.removeItem(DEMO_SESSION_KEY);setDemo(false);};
  return (
    <MobileRuntime presentation="web">
      {updatingDemo?<div className="judge-refresh" role="status">正在收好新的演示作品…</div>:<Prototype key={demo?`judge-${demoRevision}`:'personal'} demo={demo} onEnterDemo={enterDemo} onExitDemo={exitDemo}/>}
    </MobileRuntime>
  );
}
