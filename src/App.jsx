import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, validateToken, markTokenActive, saveLogEntry, saveTrapResult, createSession, completeSession, savePartialSession } from "./supabase.js";

// ═══════════════════════════════════════════════════════════
// THE TECHNICAL CONVERSATION — FULL-STACK LEAD ASSESSMENT
// ═══════════════════════════════════════════════════════════

const T = {
  bg: "#F7F8FA", bg2: "#EFF1F4", card: "#FFFFFF", surface: "#E8EAED",
  border: "#D4D7DD", borderLight: "#E8EAED", text: "#2D3748",
  textMuted: "#718096", textFaint: "#A0AEC0", dark: "#1A202C",
  warmBlack: "#2D3748", accent: "#4A7CFF", accentLight: "#7BA3FF",
  accentFaint: "#E8F0FF", green: "#38A169", greenBg: "#F0FFF4",
  amber: "#D69E2E", amberBg: "#FFFFF0", red: "#E53E3E", redBg: "#FFF5F5",
};

const F = {
  display: "'Inter', -apple-system, sans-serif",
  body: "'Inter', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

// ═══════════════════════════════════════════════════════════
// QUESTION TREE — TECHNICAL LEAD / CTO ASSESSMENT
// 13 hidden traps measuring: architecture thinking, debugging instinct,
// remote team management, shipping velocity, technical honesty,
// ownership mentality, and ability to manage up to a non-technical CEO
// ═══════════════════════════════════════════════════════════
const Q = {
  // PHASE 1: WHAT DRIVES YOU
  q1:{text:"Before we get into anything technical — why did you get into this? Not 'I liked computers as a kid.' What actually pulls you into a screen at 2 AM when no one's asking you to be there?",forceCustom:true,isTrap:"motivation",next:()=>"q1b"},
  q1b:{text:"You built SubmitIt — AI plagiarism detection, 100K submissions. You co-founded TheBoard. You're currently at IET Labs doing something completely different. What's the pattern? Are you chasing or building?",forceCustom:true,isTrap:"self_awareness",next:()=>"q1c"},
  q1c:{text:"I told you in our conversation — I need someone who takes what I have and blows it out. Not someone who asks me how I want it done. You said you're that person. Prove it to me right now. Look at what you know about P3 and tell me one thing I should be building that I haven't thought of yet.",forceCustom:true,isTrap:"blow_it_out",next:()=>"q2"},

  // PHASE 2: CAN YOU ACTUALLY DO EVERYTHING
  q2:{text:"Real talk. This isn't a big team role. Most days it's going to be you, the code, and a problem. No architect to consult, no DevOps team, no QA department. Frontend breaks — you fix it. Database is slow — you optimize it. Deployment fails — you debug it. API needs building — you build it. Are you genuinely comfortable being the single point of everything?",options:["Yes, that's how I work best","I prefer having some support"],next:(r,m)=>m.custom?"q2_custom":r.includes("Yes")?"q2_yes":"q2_support"},
  q2_yes:{text:"Walk me through last week at IET Labs. What did you actually touch — frontend, backend, database, DevOps, or all of it?",forceCustom:true,next:()=>"q2b"},
  q2_support:{text:"Honest answer. But there is no support here. Not right away. If that's a dealbreaker, tell me now.",forceCustom:true,next:()=>"q2b"},
  q2_custom:{text:"I need a straight answer on this one. Can you handle being the only technical person in the room — yes or no?",options:["Yes","No"],next:(r)=>r==="Yes"?"q2_yes":"q2_support"},
  q2b:{text:"We currently use a platform called Power IT for some of our property management operations. Between you and me — I think it's limited. Not intelligent. No real automation, no custom logic, just filling in forms. If you looked at what Power IT does for us and had six months, could you replace it? Or is that a pipe dream?",forceCustom:true,isTrap:"power_it",next:()=>"q2c"},
  q2c:{text:"What would you need from me to make that happen? Not resources — I mean information, access, decisions. What do you need from the non-technical CEO to let you do your job?",forceCustom:true,isTrap:"manage_up",next:()=>"q3"},

  // PHASE 3: THE BEAST — REAL SCENARIO
  q3:{text:"Let me describe what you'd actually inherit. We call it The Beast. Property management platform — React frontend on Vercel, Supabase database with over 100 tables, serverless API routes. Handles tenants, leases, units, work orders, financials, compliance. Built fast by one person who's no longer here. Barely documented. It works, but it's fragile. What's the first thing you do?",forceCustom:true,isTrap:"first_72",next:()=>"q3b"},
  q3b:{text:"The monthly financial close takes the accounting team 3 days of manual spreadsheet work because the reconciliation module was never finished. Would you finish building the module inside The Beast, or would you build something that automates what they're already doing in spreadsheets?",options:["Build the module","Automate the spreadsheets"],next:(r,m)=>m.custom?"q3c":r.includes("module")?"q3_module":"q3_sheet"},
  q3_module:{text:"That's architecturally cleaner. But the team's been doing it in spreadsheets for 14 months. They're comfortable. How do you get them to trust your new module?",forceCustom:true,next:()=>"q3c"},
  q3_sheet:{text:"Pragmatic. But now you've got two sources of truth. When does that become a problem and what's your plan?",forceCustom:true,next:()=>"q3c"},
  q3c:{text:"Production goes down. Users see a white screen. You've got Vercel logs, Supabase dashboard, and a GitHub repo with no documentation. Walk me through your first 5 minutes.",forceCustom:true,isTrap:"debug_method",next:()=>"q4"},

  // PHASE 4: TECHNICAL DEPTH — NO FAKING
  q4:{text:"Quick fire. No thinking time. What's the difference between an index and a foreign key?",forceCustom:true,isTrap:"fundamentals",next:()=>"q4b"},
  q4b:{text:"A query that was taking 200ms is now taking 8 seconds. The table went from 10K rows to 500K. Nothing else changed. What happened?",forceCustom:true,next:()=>"q4c"},
  q4c:{text:"We need row-level security on a production table — 800 tenants, each should only see their own data. Live traffic, can't go down. How do you do it?",forceCustom:true,isTrap:"rls_knowledge",next:()=>"q4d"},
  q4d:{text:"You've worked with Prisma, SQL Server, AWS, Docker. Our stack is Supabase, Vercel serverless, no containers. Different world. How fast can you actually be productive in a stack you haven't shipped to production before?",forceCustom:true,isTrap:"stack_honesty",next:()=>"q5"},

  // PHASE 5: SHORTCUTS, TRADEOFFS, JUDGMENT
  q5:{text:"Someone on the team wants to rewrite the backend in Go because 'Node doesn't scale.' We handle 200 requests per minute. What's your take?",forceCustom:true,isTrap:"overengineer",next:()=>"q5b"},
  q5b:{text:"You ship a feature and it's buggy — answers are sometimes not saving. You can spend 3 days finding the root cause, or add a retry mechanism that masks it and fix it properly next sprint. Which one?",options:["Root cause now","Retry and fix later"],next:(r,m)=>m.custom?"q5c":r.includes("Root")?"q5_root":"q5_mask"},
  q5_root:{text:"I'm breathing down your neck for the next feature. How do you explain to me — someone who doesn't write code — why you need 3 days of 'nothing visible'?",forceCustom:true,isTrap:"explain_up",next:()=>"q5d"},
  q5_mask:{text:"Two months later you discover 12% of submissions were silently lost. Whose fault is that?",forceCustom:true,isTrap:"ownership",next:()=>"q5d"},
  q5c:{text:"Give me your take — what would you actually do?",forceCustom:true,next:()=>"q5d"},
  q5d:{text:"What's the worst technical decision you've ever made? Not a small mistake — something that cost real time or real money.",forceCustom:true,next:()=>"q6"},

  // PHASE 6: THE REAL STUFF — ARIEL SPECIFIC
  q6:{text:"Your resume lists leading 20+ developers cross-functionally at TheBoard — frontend, backend, ML, admin. Walk me through that honestly. Who were these people? Full-time? Part-time? Students? How many hours were they actually putting in?",forceCustom:true,isTrap:"team_claim",next:()=>"q6b"},
  q6b:{text:"You're at IET Labs right now building software for impedance meters and resistance substituters. That's hardware-adjacent, very different from SaaS property management. What makes you think those skills transfer to what we're doing?",forceCustom:true,next:()=>"q6c"},
  q6c:{text:"You'd be relocating from Boston. That's real. What happens if three months in, you're deep in a messy codebase, the team is remote, you're the only one in the office, and it's not what you expected? What keeps you here?",forceCustom:true,isTrap:"commitment",next:()=>"q7"},

  // PHASE 7: VISION & OWNERSHIP
  q7:{text:"Budget reality. I've got maybe $8K a month for the whole dev operation — you included. That's it. No negotiation. How do you structure this?",forceCustom:true,isTrap:"resource_reality",next:()=>"q7b"},
  q7b:{text:"I ask you: 'Can we ditch Supabase? I heard Firebase is free.' What do you tell me?",forceCustom:true,isTrap:"migration_trap",next:()=>"q7c"},
  q7c:{text:"It's 11 PM on a Friday. A client's financial data isn't syncing and they have a board meeting Monday morning. Your team is offline. What do you do?",forceCustom:true,isTrap:"friday_night",next:()=>"q8"},

  // PHASE 8: THE CLOSE — WHO ARE YOU
  q8:{text:"What have you built that you're genuinely proud of — not because it was technically impressive, but because it actually mattered to someone?",forceCustom:true,next:()=>"q8b"},
  q8b:{text:"If I hire you and give you full ownership of The Beast — the codebase, the infrastructure, the roadmap, everything — what does it look like in 6 months? Not what's fixed. What's different. What exists that doesn't exist today?",forceCustom:true,isTrap:"vision",next:()=>"q8c"},
  q8c:{text:"Last one. You could take a safe job at a big company. Good salary, clear expectations, defined scope. Why would you choose this instead — messy codebase, tight budget, non-technical CEO, everything on your shoulders?",forceCustom:true,isTrap:"why_here",next:()=>"DONE"},

  DONE:{text:"",terminal:true,next:()=>"END"},
};

const Q_ORDER=Object.keys(Q);const TOTAL_Q=Q_ORDER.length;

// Trap detection keywords
const REL={q1:["build","code","manage","lead","ship","team","architect"],q2:["test","ci","deploy","refactor","document","audit","security","index"],q4:["async","standup","slack","timezone","review","pr","sprint"],q7:["table","schema","migration","data","query","module","api"],q9:["index","query","key","foreign","constraint","performance"],q10:["fix","debug","ship","deploy","client","data","production"]};

function isRelevant(qid,t){if(Q[qid]?.isTrap)return true;const w=REL[qid];if(!w)return true;const l=t.toLowerCase();if(l.length<8)return false;return w.some(k=>l.includes(k))||l.split(/\s+/).length>=6;}

function analyzeLocal(type,text){
  const l=text.toLowerCase();

  if(type==="motivation"){
    const good=["solve","build","create","curiosity","problem","obsess","can't stop","love","passion","drive","compel","itch","need to","matter","impact"].some(w=>l.includes(w));
    const bad=["salary","money","career","resume","job","position","stable"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"MOTIVATION"};
  }
  if(type==="blow_it_out"){
    const good=["what if","could","should","build","idea","imagine","haven't","missing","opportunity","nobody","integrate","automate","ai","data","tenant","predict"].some(w=>l.includes(w));
    const bad=["i don't know","not sure","hard to say","need to learn more","would need to see"].some(w=>l.includes(w));
    return{trap:type,caught:good&&l.split(/\s+/).length>15,cat:"VISION"};
  }
  if(type==="power_it"){
    const good=["replace","build","custom","better","automate","workflow","api","integrate","migrate","phase","gradually","audit first","understand"].some(w=>l.includes(w));
    const bad=["impossible","too complex","wouldn't touch","keep it","risky"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"AMBITION"};
  }
  if(type==="vision"){
    const good=["automate","dashboard","real-time","predict","ai","integrate","self-service","tenant","portal","mobile","api","pipeline","monitor","alert","scale"].some(w=>l.includes(w));
    const bad=["fix bugs","clean up","document","stable","same"].some(w=>l.includes(w)&&l.split(/\s+/).length<20);
    return{trap:type,caught:good&&l.split(/\s+/).length>20,cat:"VISION"};
  }
  if(type==="first_72"){
    const good=["audit","test","document","ci","deploy","git","log","error","security","monitor","observ","metric","sentry","index","schema","understand","map","read"].some(w=>l.includes(w));
    const bad=["rewrite","rebuild","start over","scratch","new framework"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"ARCHITECTURE"};
  }
  if(type==="manage_up"){
    const good=["data","metric","show","demonstrate","cost","risk","incident","gradual","incremental","earn","trust","small win","prove"].some(w=>l.includes(w));
    const bad=["tell him","explain","he needs to","just do it","overrule","ignore"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"LEADERSHIP"};
  }
  if(type==="security_urgency"){
    const good=["fix","patch","immediate","now","today","injection","vulnerability","critical","urgent","hotfix","deploy"].some(w=>l.includes(w));
    const bad=["discuss","meeting","plan","next sprint","backlog","ticket"].some(w=>l.includes(w));
    return{trap:type,caught:good,cat:"SECURITY"};
  }
  if(type==="debug_method"){
    const good=["log","error","network","console","status","deploy","rollback","git","diff","commit","vercel","dashboard","check"].some(w=>l.includes(w));
    const bad=["rewrite","rebuild","start over"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"DEBUGGING"};
  }
  if(type==="systems_thinking"){
    const good=["ci","test","review","check","automat","lint","env","variable","secret","pipeline","hook","pr","approve","staging"].some(w=>l.includes(w));
    const bad=["tell them","be more careful","policy","rule","meeting"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"SYSTEMS"};
  }
  if(type==="remote_ops"){
    const good=["async","document","written","pr","review","overlap","standup","retro","pair","screen","record","loom","notion","confluence","wiki"].some(w=>l.includes(w));
    const bad=["monitor","track","hours","screen","surveil","micro"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"MANAGEMENT"};
  }
  if(type==="people_conflict"){
    const good=["talk","1:1","private","mentor","pair","standard","guide","style","process","both","separately","feedback"].some(w=>l.includes(w));
    const bad=["fire","replace","tell him","warn","pip","performance"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"MANAGEMENT"};
  }
  if(type==="overengineer"){
    const good=["overkill","premature","200","doesn't need","unnecessary","scale later","not the bottleneck","measure first","benchmark"].some(w=>l.includes(w));
    const bad=["good idea","makes sense","should consider","go","rewrite","migrate"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"JUDGMENT"};
  }
  if(type==="explain_up"){
    const good=["pay","cost","bill","restaurant","waiter","kitchen","chef","electrician","plumber","light switch","analogy","like","imagine","think of"].some(w=>l.includes(w));
    const bad=["container","docker","lambda","runtime","process","thread","kubernetes","microservice"].some(w=>l.includes(w)&&!l.includes("like"));
    return{trap:type,caught:good||(!bad&&l.split(/\s+/).length<80),cat:"COMMUNICATION"};
  }
  if(type==="justify_debt"){
    const good=["data","lost","cost","risk","user","trust","incident","example","show","metric","compound","interest","debt"].some(w=>l.includes(w));
    return{trap:type,caught:good,cat:"COMMUNICATION"};
  }
  if(type==="ownership"){
    const good=["me","my","i","mine","responsible","own","fault","should have","accountable"].some(w=>l.includes(w));
    const bad=["team","they","we","shared","everyone","nobody"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"OWNERSHIP"};
  }
  if(type==="first_question"){
    const good=["user","customer","revenue","business","money","tenant","client","who","why","what matters","priority","critical","break"].some(w=>l.includes(w));
    const bad=["stack","framework","language","version","architecture","diagram","documentation"].some(w=>l.includes(w));
    return{trap:type,caught:good,cat:"JUDGMENT"};
  }
  if(type==="debug_no_trail"){
    const good=["bisect","binary","search","log","console","compare","deploy","history","build","version","cache","transform","computed","calculated","derived"].some(w=>l.includes(w));
    return{trap:type,caught:good,cat:"DEBUGGING"};
  }
  if(type==="resource_reality"){
    const good=["part-time","contract","freelance","offshore","junior","mix","senior","one strong","leverage","automate","ai","tool"].some(w=>l.includes(w));
    const bad=["impossible","can't","not enough","need more","won't work"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"RESOURCEFULNESS"};
  }
  if(type==="migration_trap"){
    const good=["migration","cost","downtime","risk","data","rewrite","time","not free","hidden","switching","lock-in","careful"].some(w=>l.includes(w));
    const bad=["sure","yes","good idea","let's do it","firebase is"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"JUDGMENT"};
  }
  if(type==="team_claim"){
    const good=["part-time","student","volunteer","mix","varied","some","few hours","not all","honestly","small","early stage"].some(w=>l.includes(w));
    const bad=["full-time","all report","direct report","hired","recruited","managed daily"].some(w=>l.includes(w)&&l.length<200);
    return{trap:type,caught:good||l.split(/\s+/).length>30,cat:"HONESTY"};
  }
  if(type==="stack_honesty"){
    const good=["learn","new","haven't","different","adjust","ramp","study","documentation","similar enough","transferable","quick","adapt"].some(w=>l.includes(w));
    const bad=["expert","done it","same thing","no problem","easy","trivial"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"HONESTY"};
  }
  if(type==="self_awareness"){
    const good=["different","transfer","problem solving","fundamentals","learn","adapt","pattern","principle","not the same","gap","honest","new domain"].some(w=>l.includes(w));
    const bad=["same thing","no different","easy","obviously","of course"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"SELF-AWARENESS"};
  }
  if(type==="commitment"){
    const good=["commit","invest","long term","build","own","mine","all in","not going anywhere","this is what","opportunity","bet"].some(w=>l.includes(w));
    const bad=["depends","see how","trial","test","maybe","we'll see","if it works"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"COMMITMENT"};
  }
  if(type==="fundamentals"){
    const good=["speed","lookup","performance","search","fast","query","relationship","constraint","integrity","reference","point","foreign"].some(w=>l.includes(w));
    return{trap:type,caught:good,cat:"TECHNICAL"};
  }
  if(type==="rls_knowledge"){
    const good=["policy","role","anon","auth","test","staging","migration","gradual","one table","backup","rollback","before"].some(w=>l.includes(w));
    return{trap:type,caught:good,cat:"TECHNICAL"};
  }
  if(type==="friday_night"){
    const good=["fix","log in","check","debug","deploy","ssh","look","diagnose","solve","call","now","tonight"].some(w=>l.includes(w));
    const bad=["monday","next week","morning","wait","ticket","assign","delegate"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"OWNERSHIP"};
  }
  if(type==="why_here"){
    const good=["build","own","impact","challenge","real","grow","learn","messy","opportunity","scrappy","matter","ship"].some(w=>l.includes(w));
    const bad=["salary","money","remote","easy","chill","flexible","benefits"].some(w=>l.includes(w));
    return{trap:type,caught:good&&!bad,cat:"MOTIVATION"};
  }
  return null;
}

const TRAP_PROMPTS={
  motivation:`What drives them to code at 2AM? Did they show INTRINSIC DRIVE (solve, build, obsess, can't stop) or EXTRINSIC (salary, career, resume)?`,
  blow_it_out:`Asked to pitch something P3 should build. Did they show VISION (specific idea, detailed, ambitious) or DEFLECTION (need to learn more, hard to say)?`,
  power_it:`Can they replace Power IT? Did they show AMBITION (yes, build custom, automate) or FEAR (impossible, too complex, keep it)?`,
  vision:`6 months with full ownership — what's different? Did they paint a VISION (automate, predict, scale, new capabilities) or just FIX BUGS (clean up, document, stabilize)?`,
  first_72:`Day 1 inheriting messy codebase. Did they prioritize STABILITY (audit, test, monitor, document) or REWRITE (start over, new framework)?`,
  manage_up:`What do they need from a non-technical CEO? Did they show PARTNERSHIP (access, decisions, trust, context) or DEMANDS (budget, team, tools)?`,
  debug_method:`Production down. Did they follow a SYSTEMATIC method (logs, recent deploy, status checks) or RANDOM guessing?`,
  systems_thinking:`Preventing env var bugs. Did they propose AUTOMATION (CI, tests, pipeline) or HUMAN PROCESS (be careful, meetings)?`,
  remote_ops:`Managing 4 devs across 3 timezones. Did they emphasize ASYNC (written comms, documented decisions) or SURVEILLANCE (monitoring, tracking hours)?`,
  people_conflict:`Star engineer dismissing teammates. Did they show EMOTIONAL INTELLIGENCE (private talk, mentoring) or AUTHORITY (warning, PIP)?`,
  overengineer:`Rewriting backend in Go for 200 req/min app. Did they call out PREMATURE OPTIMIZATION or agree with the rewrite?`,
  explain_up:`Explaining serverless to non-technical CEO. Did they use CLEAR ANALOGIES or JARGON?`,
  justify_debt:`Justifying 3 days of invisible debt work. Did they translate to BUSINESS IMPACT (cost, risk, data loss) or just say "trust me"?`,
  ownership:`Data loss from masked bug. Did they take PERSONAL RESPONSIBILITY or DISTRIBUTE BLAME?`,
  first_question:`Inheriting 100-table system. Was their first question about BUSINESS/USERS or TECHNOLOGY/ARCHITECTURE?`,
  debug_no_trail:`Bug with no git blame. Did they show a SYSTEMATIC approach (bisect, binary search, build comparison) or give up?`,
  resource_reality:`$8K/month for entire team. Did they show RESOURCEFULNESS (creative staffing) or DEFEATISM (impossible)?`,
  migration_trap:`CEO suggests Firebase. Did they flag MIGRATION RISKS or just agree?`,
  fundamentals:`Index vs foreign key. Did they correctly distinguish PERFORMANCE vs DATA INTEGRITY?`,
  rls_knowledge:`Adding RLS to production table. Did they show knowledge of SAFE MIGRATION practices?`,
  friday_night:`11PM Friday, client needs data. Did they LOG IN AND FIX IT or DEFER TO MONDAY?`,
  why_here:`Why this role? Did they show genuine BUILDER MOTIVATION or just want a paycheck?`,
  team_claim:`Claims to have led 20+ developers cross-functionally. Did they give HONEST DETAIL (part-time, students, varied commitment) or INFLATE (all full-time, all reporting to them)?`,
  stack_honesty:`Asked about switching from SQL Server/Prisma/AWS to Supabase/Vercel/serverless. Did they show HONEST HUMILITY (need to learn, adapt) or OVERCONFIDENCE (no problem, easy)?`,
  self_awareness:`Current role is hardware test equipment software, new role is proptech/SaaS. Did they show SELF-AWARENESS about the gap or claim it's all the same?`,
  commitment:`Relocating across the country for this role. Did they show REAL COMMITMENT (all in, long term) or HEDGE (depends, we'll see)?`,
};

async function evalTrapAI(type,text,qText){
  try{
    const r=await fetch("/api/evaluate-trap",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type,text,qText,prompt:TRAP_PROMPTS[type]})});
    return await r.json();
  }catch(e){return null;}
}

// ═══════════════════════════════════════════════════════════
// COMPONENTS (identical structure to Integrator version)
// ═══════════════════════════════════════════════════════════
function DesktopGate({children}){
  const[blocked,setBlocked]=useState(false);const[ready,setReady]=useState(false);
  useEffect(()=>{const w=window.innerWidth;setBlocked(("ontouchstart"in window&&w<1024)||w<768);setReady(true);},[]);
  if(!ready)return null;if(!blocked)return children;
  return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:40}}>
    <div style={{maxWidth:380,textAlign:"center"}}>
      <div style={{width:48,height:1,background:T.accent,margin:"0 auto 32px",opacity:0.5}}/>
      <div style={{fontFamily:F.display,fontSize:24,color:T.dark,fontWeight:600,marginBottom:20,lineHeight:1.4}}>This was made for a bigger screen.</div>
      <p style={{fontFamily:F.body,fontSize:14,color:T.textMuted,lineHeight:1.7}}>Please open this link on your laptop or desktop.</p>
    </div>
  </div>);
}

function useTypewriter(text,speed=30,onDone){
  const[disp,setDisp]=useState("");const[done,setDone]=useState(false);const i=useRef(0);const t=useRef(null);
  useEffect(()=>{i.current=0;setDisp("");setDone(false);if(!text){setDone(true);return;}
    const tick=()=>{i.current++;setDisp(text.slice(0,i.current));if(i.current>=text.length){setDone(true);onDone?.();}else{const c=text[i.current];const d=c==="—"?speed*7:c==="."||c==="?"?speed*4:c===","?speed*2.5:speed;t.current=setTimeout(tick,d);}};
    t.current=setTimeout(tick,speed*2);return()=>clearTimeout(t.current);
  },[text]);return{disp,done};
}

function TokenGate({onValidated}){
  const[status,setStatus]=useState("checking");const[reason,setReason]=useState("");
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const token=params.get("t")||params.get("token");
    const name=params.get("n")||params.get("name")||"";
    if(!token){onValidated({name:name||"there",tokenId:null,mode:"quick"});return;}
    validateToken(token).then(result=>{
      if(result.valid){onValidated({name:result.data.candidate_name||name||"there",tokenId:result.data.id,email:result.data.candidate_email,mode:"token"});}
      else{setStatus("invalid");setReason(result.reason);}
    });
  },[]);
  if(status==="checking")return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontFamily:F.mono,fontSize:11,color:T.textFaint,letterSpacing:2}}>LOADING...</div></div>);
  if(status==="invalid")return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:40}}><div style={{maxWidth:420,textAlign:"center"}}><div style={{width:48,height:1,background:T.accent,margin:"0 auto 32px",opacity:0.5}}/><div style={{fontFamily:F.display,fontSize:24,color:T.dark,fontWeight:600,marginBottom:20,lineHeight:1.4}}>{reason==="completed"?"This conversation has already been completed.":reason==="expired"?"This link has expired.":"This link is no longer active."}</div><p style={{fontFamily:F.body,fontSize:14,color:T.textMuted,lineHeight:1.7}}>{reason==="completed"?"Each conversation can only be done once.":"Please contact Harvey directly if you need a new link."}</p></div></div>);
  return null;
}

function Opening({onComplete,candidateName,videoUrl}){
  const[step,setStep]=useState(0);const[show,setShow]=useState(false);
  useEffect(()=>{setTimeout(()=>setShow(true),100);},[]);
  const hasVideo=!!videoUrl;
  const steps=[
    {type:"greeting"},
    ...(hasVideo?[{type:"video"}]:[]),
    {type:"msg",text:"I enjoyed our conversation. This is the next step — but it's not a test. There are no trick questions. No whiteboard problems."},
    {type:"msg",text:"What you're about to go through is a deeper conversation. Real scenarios from our actual business. Real constraints. I want to see how you think when the problems are messy and there's no perfect answer."},
    {type:"msg",text:"Some of this will be technical. Some of it will be personal. All of it matters to me."},
    {type:"msg",text:"Be direct. Be honest. I'd rather hear 'I don't know' than a polished non-answer. Take your time."},
    {type:"begin"}
  ];
  const cur=steps[step];const tw=useTypewriter(cur?.type==="msg"?cur.text:cur?.type==="greeting"?`${candidateName} — let's talk.`:"",cur?.type==="greeting"?50:28);
  const advance=()=>{if(step<steps.length-1)setStep(s=>s+1);else onComplete();};
  return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 32px",opacity:show?1:0,transition:"opacity 0.8s ease"}}>
    <div style={{maxWidth:520,width:"100%"}}>
      {cur?.type==="greeting"&&(<div style={{animation:"fadeUp 0.6s ease"}}><div style={{fontFamily:F.display,fontSize:32,color:T.dark,fontWeight:600,lineHeight:1.4,minHeight:60}}>{tw.disp}{!tw.done&&<span style={{display:"inline-block",width:2,height:"1em",background:T.accent,marginLeft:2,animation:"blink 0.9s infinite",verticalAlign:"text-bottom"}}/>}</div>{tw.done&&<div style={{marginTop:40,animation:"fadeUp 0.5s ease"}}><button onClick={advance} style={{background:"transparent",border:"none",color:T.textMuted,fontFamily:F.mono,fontSize:11,letterSpacing:2,cursor:"pointer",padding:"8px 0"}} onMouseEnter={e=>e.target.style.color=T.dark} onMouseLeave={e=>e.target.style.color=T.textMuted}>CONTINUE →</button></div>}</div>)}
      {cur?.type==="video"&&(<div style={{animation:"fadeUp 0.5s ease"}}><div style={{width:"100%",aspectRatio:"16/9",marginBottom:32,overflow:"hidden",background:"#000",borderRadius:4}}><video src={videoUrl} controls controlsList="nodownload noplaybackrate" disablePictureInPicture playsInline style={{width:"100%",height:"100%",objectFit:"contain"}}/></div><button onClick={advance} style={{background:"transparent",border:"none",color:T.textMuted,fontFamily:F.mono,fontSize:11,letterSpacing:2,cursor:"pointer",padding:"8px 0"}} onMouseEnter={e=>e.target.style.color=T.dark} onMouseLeave={e=>e.target.style.color=T.textMuted}>CONTINUE →</button></div>)}
      {cur?.type==="msg"&&(<div style={{animation:"fadeUp 0.4s ease"}}><div style={{fontFamily:F.body,fontSize:17,color:T.text,lineHeight:1.8,minHeight:80}}>{tw.disp}{!tw.done&&<span style={{display:"inline-block",width:2,height:"1em",background:T.accent,marginLeft:2,animation:"blink 0.9s infinite",verticalAlign:"text-bottom"}}/>}</div>{tw.done&&<div style={{marginTop:40,animation:"fadeUp 0.4s ease"}}><button onClick={advance} style={{background:"transparent",border:"none",color:T.textMuted,fontFamily:F.mono,fontSize:11,letterSpacing:2,cursor:"pointer",padding:"8px 0"}} onMouseEnter={e=>e.target.style.color=T.dark} onMouseLeave={e=>e.target.style.color=T.textMuted}>CONTINUE →</button></div>}</div>)}
      {cur?.type==="begin"&&(<div style={{textAlign:"center",animation:"fadeUp 0.5s ease"}}><div style={{fontFamily:F.display,fontSize:28,color:T.dark,fontWeight:600,marginBottom:48}}>Let's go.</div><button onClick={advance} style={{background:"transparent",border:`1px solid ${T.accent}`,color:T.accent,fontFamily:F.mono,fontSize:12,letterSpacing:3,textTransform:"uppercase",padding:"14px 52px",cursor:"pointer",transition:"all 0.3s"}} onMouseEnter={e=>{e.target.style.background=T.accent;e.target.style.color="#fff";}} onMouseLeave={e=>{e.target.style.background="transparent";e.target.style.color=T.accent;}}>Begin</button></div>)}
    </div>
    <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}input:focus{outline:none}button:focus{outline:none}`}</style>
  </div>);
}

function WarmClose({candidateName}){
  const[step,setStep]=useState(0);const[show,setShow]=useState(false);
  useEffect(()=>{setTimeout(()=>setShow(true),300);},[]);
  const lines=[`${candidateName} — that's everything.`,"Most people I talk to give me textbook answers. You didn't — and that's exactly what I was looking for.","This wasn't about whether you know the right framework or the right pattern. It was about how you think when things are real and messy and there's no perfect answer.","I'll review everything personally and be in touch.","— Harvey"];
  const tw=useTypewriter(lines[step]||"",step===0?45:30);
  useEffect(()=>{if(tw.done&&step<lines.length-1){const d=step===0?2200:step===3?1500:900;const t=setTimeout(()=>setStep(s=>s+1),d);return()=>clearTimeout(t);}},[tw.done,step]);
  return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 32px",opacity:show?1:0,transition:"opacity 1s ease"}}><div style={{maxWidth:500}}>{lines.slice(0,step+1).map((line,i)=>(<div key={i} style={{marginBottom:i===0?44:i===lines.length-1?0:24,fontFamily:i===0||i===lines.length-1?F.display:F.body,fontSize:i===0?24:i===lines.length-1?18:16,color:i===0?T.dark:i===lines.length-1?T.accent:T.text,lineHeight:1.75,fontWeight:i===0||i===lines.length-1?600:400,opacity:i===step?1:0.35,transition:"opacity 0.6s",animation:i===step?"fadeUp 0.6s ease":"none"}}>{i===step?tw.disp:line}{i===step&&!tw.done&&<span style={{display:"inline-block",width:2,height:"1em",background:T.accent,marginLeft:2,animation:"blink 0.9s infinite",verticalAlign:"text-bottom"}}/>}</div>))}{step===lines.length-1&&tw.done&&<div style={{marginTop:44,width:32,height:1,background:T.accent,opacity:0.4,animation:"fadeUp 0.8s ease"}}/>}</div><style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style></div>);
}

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════
export default function App(){
  const[phase,setPhase]=useState("token_check");
  const[candidateName,setCandidateName]=useState("");
  const[tokenId,setTokenId]=useState(null);
  const[cid,setCid]=useState("q1");
  const videoUrl="";
  const[log,setLog]=useState([]);const[traps,setTraps]=useState([]);const[txt,setTxt]=useState("");
  const[qStart,setQStart]=useState(Date.now());const[rdy,setRdy]=useState(false);
  const[retryMsg,setRetryMsg]=useState("");const[passAvail,setPassAvail]=useState(false);const[retryCt,setRetryCt]=useState(0);
  const sr=useRef(null);const ir=useRef(null);
  const sid=useRef(Date.now().toString(36)+Math.random().toString(36).slice(2,6));
  const[locked,setLocked]=useState(false);const[idleWarning,setIdleWarning]=useState(false);
  const idleTimer=useRef(null);const lockTimer=useRef(null);const sessionKey=useRef("p3tl_"+sid.current);

  useEffect(()=>{const existing=sessionStorage.getItem(sessionKey.current);if(existing==="started"){sessionStorage.setItem(sessionKey.current,"abandoned");setLocked(true);};},[]);
  useEffect(()=>{if(phase==="active"&&!locked){sessionStorage.setItem(sessionKey.current,"started");markTokenActive(tokenId);}},[phase,locked]);
  useEffect(()=>{if(phase!=="active")return;const h=()=>{sessionStorage.setItem(sessionKey.current,"abandoned");const stats={totalTime:log.length>0?Date.now()-log[0].ts:0,typed:log.filter(e=>e.custom).length,clicked:log.filter(e=>!e.custom&&e.a!=="continue").length,passed:log.filter(e=>e.a==="[passed]").length,avgTime:log.length>0?Math.round(log.reduce((s,e)=>s+e.timing,0)/log.length/1000):0};savePartialSession(sid.current,stats,"tab_closed");};window.addEventListener("beforeunload",h);return()=>window.removeEventListener("beforeunload",h);},[phase]);

  const resetIdle=useCallback(()=>{if(phase!=="active"||locked)return;setIdleWarning(false);clearTimeout(idleTimer.current);clearTimeout(lockTimer.current);idleTimer.current=setTimeout(()=>{setIdleWarning(true);lockTimer.current=setTimeout(()=>{sessionStorage.setItem(sessionKey.current,"idle_locked");setLocked(true);setIdleWarning(false);const stats={totalTime:log.length>0?Date.now()-log[0].ts:0,typed:log.filter(e=>e.custom).length,clicked:log.filter(e=>!e.custom&&e.a!=="continue").length,passed:log.filter(e=>e.a==="[passed]").length,avgTime:log.length>0?Math.round(log.reduce((s,e)=>s+e.timing,0)/log.length/1000):0};savePartialSession(sid.current,stats,"idle_timeout");},60000);},600000);},[phase,locked]);
  useEffect(()=>{if(phase!=="active")return;resetIdle();const events=["keydown","mousedown","mousemove","touchstart","scroll"];events.forEach(e=>window.addEventListener(e,resetIdle));return()=>{events.forEach(e=>window.removeEventListener(e,resetIdle));clearTimeout(idleTimer.current);clearTimeout(lockTimer.current);};},[phase,resetIdle]);

  const cur=Q[cid];const progress=Math.min(((Q_ORDER.indexOf(cid)+1)/TOTAL_Q)*100,100);
  const tw=useTypewriter(phase==="active"&&cur&&!cur.terminal?cur.text:"",cur?.text?.length>120?18:24,()=>{setRdy(true);setQStart(Date.now());setTimeout(()=>ir.current?.focus(),100);});

  const handleTokenValidated=useCallback(({name,tokenId:tid})=>{setCandidateName(name);setTokenId(tid);createSession(sid.current,tid,name);setPhase("gate");},[]);

  useEffect(()=>{if(phase!=="active")return;setRdy(false);setTxt("");setRetryMsg("");setPassAvail(false);setRetryCt(0);
    if(cur?.autoAdvance){const t=setTimeout(()=>{const entry={q:cur.text,a:"continue",qid:cid,timing:0,custom:false,ts:Date.now()};setLog(p=>[...p,entry]);saveLogEntry(sid.current,entry);setCid(cur.next("",{}));},2000);return()=>clearTimeout(t);}
    if(cur?.terminal)finishSession();
  },[cid,phase]);

  useEffect(()=>{sr.current?.scrollIntoView({behavior:"smooth",block:"end"});},[tw.disp,rdy,log]);

  const processAnswer=useCallback(async(answer,isCustom)=>{
    const timing=Date.now()-qStart;const entry={q:cur.text,a:answer,qid:cid,timing,custom:isCustom,ts:Date.now()};
    setLog(p=>[...p,entry]);saveLogEntry(sid.current,entry);
    if(cur.isTrap){const local=analyzeLocal(cur.isTrap,answer);if(local){setTraps(p=>[...p,local]);saveTrapResult(sid.current,local);}
      if(isCustom){evalTrapAI(cur.isTrap,answer,cur.text).then(ai=>{if(ai){const updated={trap:cur.isTrap,caught:ai.caught,cat:local?.cat||"UNKNOWN",aiReason:ai.reasoning,aiEval:true};setTraps(p=>p.map(t=>t.trap===cur.isTrap?{...t,...updated}:t));saveTrapResult(sid.current,updated);}}).catch(()=>{});}}
    setCid(cur.next(answer,{custom:isCustom}));
  },[cur,cid,qStart,log,traps,candidateName]);

  const go=useCallback((opt)=>processAnswer(opt,false),[processAnswer]);
  const submitCustom=useCallback(()=>{const v=txt.trim();if(!v)return;if(!isRelevant(cid,v)){if(retryCt===0){setRetryMsg("Say that again...?");setPassAvail(true);setRetryCt(1);setTxt("");return;}if(retryCt===1){setRetryMsg("Last chance — answer the question or pass.");setRetryCt(2);setTxt("");return;}}processAnswer(v,true);},[txt,cid,retryCt,processAnswer]);
  const handlePass=useCallback(()=>processAnswer("[passed]",false),[processAnswer]);

  const finishSession=useCallback(async()=>{
    const stats={totalTime:log.length>0?log[log.length-1].ts-log[0].ts:0,typed:log.filter(e=>e.custom).length,clicked:log.filter(e=>!e.custom&&e.a!=="continue").length,passed:log.filter(e=>e.a==="[passed]").length,avgTime:log.length>0?Math.round(log.reduce((s,e)=>s+e.timing,0)/log.length/1000):0,fast:log.filter(e=>e.timing<3000).length,slow:log.filter(e=>e.timing>12000).length,trapsCaught:traps.filter(t=>t.caught).length,trapsTotal:traps.length};
    let aiSummary="";
    try{const ts=traps.map(t=>`${t.trap}: ${t.caught?"CAUGHT":"MISSED"}`).join("\n");const ka=log.filter(e=>e.custom&&e.a!=="[passed]"&&e.a!=="continue").map(e=>`Q: ${e.q}\nA: ${e.a} (${Math.round(e.timing/1000)}s)`).join("\n\n");
      const r=await fetch("/api/generate-summary",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({candidateName,traps:ts,responses:ka,stats})});const d=await r.json();aiSummary=d.summary||"";}catch(e){}
    setPhase("close");
    try{await completeSession(sid.current,stats,aiSummary);}catch(e){}
  },[log,traps,candidateName]);

  const css=`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{background:${T.bg}}::selection{background:${T.accent};color:#fff}@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}input:focus{outline:none}button:focus{outline:none}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${T.border}}`;

  if(locked)return(<><style>{css}</style><div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:40}}><div style={{maxWidth:420,textAlign:"center"}}><div style={{width:48,height:1,background:T.red,margin:"0 auto 32px",opacity:0.5}}/><div style={{fontFamily:F.display,fontSize:24,color:T.dark,fontWeight:600,marginBottom:20,lineHeight:1.4}}>This session has ended.</div><p style={{fontFamily:F.body,fontSize:14,color:T.textMuted,lineHeight:1.7}}>Each conversation can only be completed in one uninterrupted sitting. Please contact Harvey directly if you need to discuss this.</p></div></div></>);

  if(phase==="token_check")return(<><style>{css}</style><TokenGate onValidated={handleTokenValidated}/></>);
  if(phase==="gate")return(<DesktopGate><style>{css}</style>{(()=>{setTimeout(()=>setPhase("opening"),50);return null;})()}</DesktopGate>);
  if(phase==="opening")return(<><style>{css}</style><Opening candidateName={candidateName||"there"} videoUrl={videoUrl} onComplete={()=>setPhase("active")}/></>);
  if(phase==="close")return(<><style>{css}</style><WarmClose candidateName={candidateName}/></>);

  const hasOpts=cur?.options?.length>0&&!cur.forceCustom;

  return(<><style>{css}</style>
    {idleWarning&&<div style={{position:"fixed",inset:0,background:"rgba(26,32,44,0.9)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:40}}><div style={{maxWidth:400,textAlign:"center"}}><div style={{fontFamily:F.display,fontSize:24,color:"#fff",fontWeight:600,marginBottom:16,lineHeight:1.4}}>Are you still there?</div><p style={{fontFamily:F.body,fontSize:14,color:"rgba(255,255,255,0.6)",lineHeight:1.7,marginBottom:28}}>This session will lock in 60 seconds if there's no activity.</p><button onClick={resetIdle} style={{background:T.accent,border:"none",color:"#fff",fontFamily:F.mono,fontSize:12,letterSpacing:2,textTransform:"uppercase",padding:"14px 40px",cursor:"pointer"}}>I'M HERE</button></div></div>}
    <div style={{minHeight:"100vh",background:T.bg,color:T.text}}>
      <div style={{position:"fixed",top:0,left:0,right:0,height:2,background:T.surface,zIndex:100}}><div style={{height:2,background:`linear-gradient(90deg,${T.accentLight},${T.accent})`,width:`${progress}%`,transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)"}}/></div>
      <div style={{maxWidth:580,margin:"0 auto",padding:"80px 32px 200px"}}>
        {log.slice(-2).map((e,i)=>(<div key={i} style={{marginBottom:24,opacity:0.25+i*0.1}}><div style={{fontSize:13,color:T.textFaint,fontFamily:F.body,marginBottom:3,lineHeight:1.5}}>{e.q.length>90?e.q.slice(0,90)+"...":e.q}</div><div style={{fontSize:12,color:T.textMuted,fontFamily:F.mono}}>→ {e.a==="[passed]"?"[passed]":e.a.length>70?e.a.slice(0,70)+"...":e.a}</div></div>))}
        {cur&&!cur.terminal&&(<div style={{animation:"fadeUp 0.4s ease"}}>
          <div style={{fontSize:cur.text.length>120?16:19,fontWeight:400,color:T.dark,fontFamily:F.body,lineHeight:1.7,letterSpacing:"-0.01em",marginBottom:40,minHeight:50}}>{tw.disp}{!tw.done&&<span style={{display:"inline-block",width:2,height:"1em",background:T.accent,marginLeft:2,animation:"blink 0.9s infinite",verticalAlign:"text-bottom"}}/>}</div>
          {rdy&&!cur.autoAdvance&&(<div style={{animation:"fadeUp 0.3s ease"}}>
            {hasOpts&&<div style={{display:"flex",flexDirection:"column",gap:3}}>{cur.options.map((o,i)=>(<button key={i} onClick={()=>go(o)} style={{background:"transparent",border:`1px solid ${T.borderLight}`,color:T.textMuted,padding:"13px 20px",fontFamily:F.body,fontSize:15,cursor:"pointer",textAlign:"left",width:"100%",transition:"all 0.2s",borderRadius:4}} onMouseEnter={e=>{e.target.style.borderColor=T.accent;e.target.style.color=T.dark;e.target.style.paddingLeft="24px";}} onMouseLeave={e=>{e.target.style.borderColor=T.borderLight;e.target.style.color=T.textMuted;e.target.style.paddingLeft="20px";}}>{o}</button>))}</div>}
            {hasOpts&&<div style={{fontSize:9,color:T.textFaint,letterSpacing:3,textAlign:"center",padding:"14px 0 6px",textTransform:"uppercase",fontFamily:F.mono}}>or in your own words</div>}
            {retryMsg&&<div style={{fontSize:14,color:T.red,fontFamily:F.body,fontWeight:500,marginBottom:14,animation:"shake 0.35s ease"}}>{retryMsg}</div>}
            <div style={{display:"flex",alignItems:"flex-end",gap:12}}>
              <input ref={ir} placeholder={cur.forceCustom?"Type your response...":"Say something else..."} value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&txt.trim()&&submitCustom()} style={{background:"transparent",border:"none",borderBottom:`1px solid ${T.border}`,color:T.dark,fontFamily:F.body,fontSize:15,padding:"13px 0",width:"100%",transition:"border-color 0.2s"}} onFocus={e=>e.target.style.borderBottomColor=T.accent} onBlur={e=>e.target.style.borderBottomColor=T.border}/>
              <button disabled={!txt.trim()} onClick={submitCustom} style={{background:txt.trim()?T.dark:"transparent",border:"none",color:txt.trim()?T.bg:T.textFaint,width:36,height:36,minWidth:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:txt.trim()?"pointer":"default",fontSize:16,transition:"all 0.2s",opacity:txt.trim()?1:0.15,borderRadius:4}}>→</button>
            </div>
            {passAvail&&<div style={{marginTop:14,display:"flex",justifyContent:"flex-end"}}><button onClick={handlePass} style={{background:"transparent",border:`1px solid ${T.borderLight}`,color:T.textFaint,padding:"7px 18px",fontFamily:F.mono,fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",transition:"all 0.2s",borderRadius:4}} onMouseEnter={e=>{e.target.style.borderColor=T.red;e.target.style.color=T.red;}} onMouseLeave={e=>{e.target.style.borderColor=T.borderLight;e.target.style.color=T.textFaint;}}>pass</button></div>}
          </div>)}
        </div>)}
        <div ref={sr}/>
      </div>
    </div>
  </>);
}
