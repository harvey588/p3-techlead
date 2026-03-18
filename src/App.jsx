import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, validateToken, saveLogEntry, saveTrapResult, createSession, completeSession } from "./supabase.js";

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
  // PHASE 1: THE CORE QUESTION
  q1:{text:"I want to ask you something straight. There are two kinds of technical people. The first kind asks how you want it done, follows the spec, delivers what's asked. The second kind takes what you have and blows it out — sees what you can't see, builds what you didn't know you needed. Which one are you?",options:["I follow the spec","I blow it out","Depends on the situation"],next:(r,m)=>m.custom?"q1_custom":r.includes("follow")?"q1_follow_spec":r.includes("blow")?"q1_blow":"q1_depends"},
  q1_follow_spec:{text:"So if I hand you a messy codebase and say 'just keep it running' — you'd do exactly that? Nothing more?",forceCustom:true,next:()=>"q1_dig"},
  q1_blow:{text:"Give me an example. A real one. Not a story about 'adding a feature.' A time you fundamentally changed what was possible because you saw something no one else did.",forceCustom:true,next:()=>"q1_dig"},
  q1_depends:{text:"That's the safe answer. But I need to know your default. When no one's watching and there's no spec — what do you actually do?",forceCustom:true,next:()=>"q1_dig"},
  q1_custom:{text:"I hear you. But boil it down — when you inherit something broken, does your instinct say 'fix it' or 'reimagine it'?",options:["Fix it","Reimagine it"],next:(r)=>r.includes("Fix")?"q1_follow_spec":"q1_blow"},
  q1_dig:{text:"What's a piece of technology you strongly believe in that most of your peers think is overhyped or wrong?",forceCustom:true,next:()=>"q2"},

  // PHASE 2: ARCHITECTURE UNDER PRESSURE
  q2:{text:"Here's the situation. We have a React frontend on Vercel, Supabase for the database, serverless API routes, and everything is held together with duct tape. The app works but it breaks every time we push. No tests, no CI, no documentation. You inherit this on day one. What do you do in your first 72 hours?",forceCustom:true,isTrap:"first_72",next:()=>"q2b"},
  q2b:{text:"Interesting. Now I'll tell you — the founder built all of this himself. He's emotionally attached to every architecture decision. How do you handle telling him half of it needs to be rebuilt?",forceCustom:true,isTrap:"manage_up",next:()=>"q2c"},
  q2c:{text:"He pushes back. Says 'it works, don't touch it.' But you know the Supabase schema has no indexes, the API routes have no error handling, and there's a raw SQL injection vulnerability in the booking flow. What do you actually do?",forceCustom:true,isTrap:"security_urgency",next:()=>"q3"},

  // PHASE 3: DEBUGGING LIVE
  q3:{text:"Production is down. Users are seeing a white screen. You have access to Vercel logs, Supabase dashboard, and the GitHub repo. Walk me through exactly what you do in the first 5 minutes.",forceCustom:true,isTrap:"debug_method",next:()=>"q3b"},
  q3b:{text:"The logs show a 500 error on /api/submit-booking. The function was working yesterday. The last deploy was 3 hours ago by a junior developer who's now offline and in a different timezone. What's your next move?",forceCustom:true,next:()=>"q3c"},
  q3c:{text:"You find the bug — the junior dev changed an environment variable name but didn't update the serverless function. It's a one-line fix. Do you fix it yourself and deploy, or wait for the junior to come online so they can learn from it?",options:["Fix it now, teach later","Wait for them to fix it"],next:(r,m)=>m.custom?"q4":r.includes("Fix")?"q3_fix":"q3_wait"},
  q3_fix:{text:"Right. Production comes first. Now — how do you prevent this from happening again? Not in theory. What specifically do you implement this week?",forceCustom:true,isTrap:"systems_thinking",next:()=>"q4"},
  q3_wait:{text:"Users are seeing a white screen right now. Every minute costs real revenue. You'd wait?",forceCustom:true,next:()=>"q3_fix2"},
  q3_fix2:{text:"Ok. You fix it. How do you prevent this from happening again? Not in theory — what do you implement this week?",forceCustom:true,isTrap:"systems_thinking",next:()=>"q4"},

  // PHASE 4: REMOTE TEAM MANAGEMENT
  q4:{text:"You're managing 4 developers across 3 time zones. One is in Eastern Europe, two in South America, one in the Philippines. None of them have ever met in person. How do you run this team?",forceCustom:true,isTrap:"remote_ops",next:()=>"q4b"},
  q4b:{text:"The developer in Eastern Europe is your strongest engineer. Brilliant code, never misses a deadline. But the South American devs say he's dismissive in code reviews and they're afraid to push back on his PRs. What do you do?",forceCustom:true,isTrap:"people_conflict",next:()=>"q4c"},
  q4c:{text:"He tells you: 'Their code quality isn't good enough. I'm not going to approve garbage just to be nice.' He's technically right — their code does need improvement. But they're demoralized and one is thinking about quitting. How do you handle this?",forceCustom:true,next:()=>"q5"},

  // PHASE 5: TECHNICAL HONESTY TRAPS
  q5:{text:"We're evaluating our stack. Someone on the team is pushing hard to rewrite the entire backend in Go because 'Node.js doesn't scale.' The app currently handles 200 requests per minute. What's your take?",forceCustom:true,isTrap:"overengineer",next:()=>"q5b"},
  q5b:{text:"What's a technology decision you made that turned out to be completely wrong? Not a small thing — something that cost real time or money.",forceCustom:true,next:()=>"q5c"},
  q5c:{text:"I'll be honest — I don't really understand the difference between a serverless function and a regular API server. Explain it to me like I'm the CEO who signs the checks but doesn't write code.",forceCustom:true,isTrap:"explain_up",next:()=>"q6"},

  // PHASE 6: SHIPPING & VELOCITY
  q6:{text:"We need to launch a new feature — a candidate assessment tool that collects answers, runs AI analysis, and sends email notifications. How long does this take?",options:["A weekend","1-2 weeks","A month","2-3 months"],next:(r,m)=>m.custom?"q6_custom":r.includes("weekend")?"q6_fast":r.includes("month")&&!r.includes("2")?"q6_slow":r.includes("2-3")?"q6_vslow":"q6_mid"},
  q6_fast:{text:"A weekend. What are you cutting to hit that timeline?",forceCustom:true,next:()=>"q6_follow"},
  q6_mid:{text:"Walk me through the week-by-week breakdown. What ships when?",forceCustom:true,next:()=>"q6_follow"},
  q6_slow:{text:"A month for a form that saves to a database and sends an email? What takes a month?",forceCustom:true,next:()=>"q6_follow"},
  q6_vslow:{text:"Two to three months. We'd lose the hiring window. What if I told you it needs to be live in 10 days?",forceCustom:true,next:()=>"q6_follow"},
  q6_custom:{text:"Give me a number. Days, not vibes.",forceCustom:true,next:()=>"q6_follow"},
  q6_follow:{text:"The feature ships but it's buggy. Users report that answers are sometimes not saving. You can either: spend 3 days debugging and fixing, or add a retry mechanism that masks the bug and ship a proper fix next sprint. Which do you choose?",options:["Fix the root cause now","Ship the retry, fix later"],next:(r,m)=>m.custom?"q7":r.includes("root")?"q6_root":"q6_mask"},
  q6_root:{text:"Good instinct. But the CEO is breathing down your neck for the next feature. How do you justify 3 days of 'nothing visible' to someone who doesn't understand tech debt?",forceCustom:true,isTrap:"justify_debt",next:()=>"q7"},
  q6_mask:{text:"Honest answer. But that retry is now hiding a data integrity issue. Two months later, you discover 12% of submissions were silently lost. Who's responsible?",forceCustom:true,isTrap:"ownership",next:()=>"q7"},

  // PHASE 7: REAL SCENARIO — THE BEAST
  q7:{text:"I'm going to describe our actual system. We call it The Beast. It's a property management platform — handles units, tenants, leases, work orders, financials, compliance. Over 100 database tables. Built fast, barely documented. The guy who built it is gone. You're inheriting it. What's your first question?",forceCustom:true,isTrap:"first_question",next:()=>"q7b"},
  q7b:{text:"There's a monthly close process that takes 3 days of manual work because the financial reconciliation module was never finished. The accounting team does it in spreadsheets. Do you finish building the module or build an integration that automates their spreadsheet workflow?",options:["Finish the module","Automate the spreadsheet"],next:(r,m)=>m.custom?"q7c":r.includes("module")?"q7_module":"q7_sheet"},
  q7_module:{text:"That's the 'right' answer architecturally. But the accounting team has been doing it in spreadsheets for 14 months and they're comfortable with it. How long before this module is actually saving them time?",forceCustom:true,next:()=>"q7c"},
  q7_sheet:{text:"Pragmatic. But now you've got two systems of record — the database and the spreadsheet. Six months from now that's going to bite you. What's your plan?",forceCustom:true,next:()=>"q7c"},
  q7c:{text:"A tenant reports a bug — their lease shows the wrong rent amount. You check the database and the number is correct. You check the frontend and it's displaying wrong. The component was last touched 4 months ago and there's no git blame because someone force-pushed. How do you find the bug?",forceCustom:true,isTrap:"debug_no_trail",next:()=>"q7d"},

  // PHASE 7B: ARIEL-SPECIFIC DEPTH PROBES (without naming him)
  q7d:{text:"Quick shift. You mentioned experience leading cross-functional teams — engineering, frontend, backend, ML, admin. Walk me through how you actually structured that. Who reported to who? How did you divide the work?",forceCustom:true,isTrap:"team_claim",next:()=>"q7e"},
  q7e:{text:"That team — were they full-time employees, contractors, students, or a mix? How many hours a week were they actually contributing?",forceCustom:true,next:()=>"q7f"},
  q7f:{text:"You've worked with Prisma and SQL Server. Our system runs on Supabase — which is PostgreSQL under the hood. You've also listed AWS, Docker, S3. But this role is Vercel serverless, not containers. How quickly can you context-switch into a stack you haven't deployed to production before?",forceCustom:true,isTrap:"stack_honesty",next:()=>"q7g"},
  q7g:{text:"Be honest with me. Your current role — building test equipment software for impedance meters — is very different from what we're doing. Property management, tenant portals, financial reconciliation. What makes you think the skills transfer?",forceCustom:true,isTrap:"self_awareness",next:()=>"q7h"},
  q7h:{text:"You'd need to relocate for this. That's a real commitment. What happens if three months in, this isn't what you expected? You've moved across the country, you're deep in a messy codebase, the team is remote and you're the only one in-office. What keeps you from walking?",forceCustom:true,isTrap:"commitment",next:()=>"q8"},

  // PHASE 8: DECISION-MAKING UNDER CONSTRAINTS
  q8:{text:"Budget reality. You have $8,000 a month for your entire dev team. That's it. No negotiation. What does your team look like?",forceCustom:true,isTrap:"resource_reality",next:()=>"q8b"},
  q8b:{text:"You find an incredible full-stack developer who wants $6,000 a month. That leaves $2,000 for everything else — QA, DevOps, design. Do you hire them?",options:["Yes, they're worth it","No, need to spread the budget"],next:(r,m)=>m.custom?"q8c":r.includes("Yes")?"q8_yes":"q8_no"},
  q8_yes:{text:"Now you're a two-person team and the $6K dev gets sick for two weeks. What happens?",forceCustom:true,next:()=>"q8c"},
  q8_no:{text:"What's the team structure at $8K total? Be specific — roles, rates, hours.",forceCustom:true,next:()=>"q8c"},
  q8c:{text:"The CEO asks you: 'Can we move off Supabase to save money? I heard Firebase is free.' What do you tell him?",forceCustom:true,isTrap:"migration_trap",next:()=>"q9"},

  // PHASE 9: TECHNICAL DEPTH CHECK
  q9:{text:"Quick round. No thinking time. What's the difference between an index and a foreign key?",forceCustom:true,isTrap:"fundamentals",next:()=>"q9b"},
  q9b:{text:"A query that used to take 200ms is now taking 8 seconds. The table grew from 10,000 rows to 500,000. Nothing else changed. What happened and how do you fix it?",forceCustom:true,next:()=>"q9c"},
  q9c:{text:"You need to add row-level security to a table that currently has none. 800 active tenants, each should only see their own data. It's a production database with live traffic. Walk me through how you do this without breaking anything.",forceCustom:true,isTrap:"rls_knowledge",next:()=>"q10"},

  // PHASE 10: OWNERSHIP & GRIT
  q10:{text:"It's 11 PM on a Friday. A client's data isn't syncing and they have a board meeting Monday morning using that data. Your team is offline. What do you do?",forceCustom:true,isTrap:"friday_night",next:()=>"q10b"},
  q10b:{text:"What's something you built that you're genuinely proud of — not because it was technically impressive, but because it actually mattered to someone?",forceCustom:true,next:()=>"q10c"},
  q10c:{text:"Last question. Why this role? You could work anywhere. Why would you sign up to inherit someone else's messy codebase, manage a team you've never met, and answer to a CEO who doesn't understand what you do?",forceCustom:true,isTrap:"why_here",next:()=>"DONE"},

  DONE:{text:"",terminal:true,next:()=>"END"},
};

const Q_ORDER=Object.keys(Q);const TOTAL_Q=Q_ORDER.length;

// Trap detection keywords
const REL={q1:["build","code","manage","lead","ship","team","architect"],q2:["test","ci","deploy","refactor","document","audit","security","index"],q4:["async","standup","slack","timezone","review","pr","sprint"],q7:["table","schema","migration","data","query","module","api"],q9:["index","query","key","foreign","constraint","performance"],q10:["fix","debug","ship","deploy","client","data","production"]};

function isRelevant(qid,t){if(Q[qid]?.isTrap)return true;const w=REL[qid];if(!w)return true;const l=t.toLowerCase();if(l.length<8)return false;return w.some(k=>l.includes(k))||l.split(/\s+/).length>=6;}

function analyzeLocal(type,text){
  const l=text.toLowerCase();

  if(type==="first_72"){
    const good=["audit","test","document","ci","deploy","git","log","error","security","monitor","observ","metric","sentry","index","schema"].some(w=>l.includes(w));
    const bad=["rewrite","rebuild","start over","scratch","new framework","migrate"].some(w=>l.includes(w));
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
  first_72:`Day 1 inheriting messy codebase. Did they prioritize STABILITY (audit, test, monitor, document) or REWRITE (start over, new framework)?`,
  manage_up:`Telling a founder his code needs rebuilding. Did they show DIPLOMACY (data, gradual, earn trust) or BLUNTNESS (tell him, just do it)?`,
  security_urgency:`SQL injection in production. Did they treat it as URGENT (fix now, patch today) or PROCESS (next sprint, backlog)?`,
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
    {type:"msg",text:"This isn't a technical interview. There are no whiteboard problems. No trick questions about Big O notation."},
    {type:"msg",text:"What you're about to go through is a conversation — designed to see how you actually think about technology, teams, and problems. Not how you perform in an interview."},
    {type:"msg",text:"Some of these scenarios are deliberately messy. Real situations, real constraints. I need to see how you operate when the ground is uneven."},
    {type:"msg",text:"Be direct. Be honest. I'd rather hear 'I don't know' than a polished non-answer."},
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
  useEffect(()=>{if(phase==="active"&&!locked)sessionStorage.setItem(sessionKey.current,"started");},[phase,locked]);
  useEffect(()=>{if(phase!=="active")return;const h=()=>{sessionStorage.setItem(sessionKey.current,"abandoned");};window.addEventListener("beforeunload",h);return()=>window.removeEventListener("beforeunload",h);},[phase]);

  const resetIdle=useCallback(()=>{if(phase!=="active"||locked)return;setIdleWarning(false);clearTimeout(idleTimer.current);clearTimeout(lockTimer.current);idleTimer.current=setTimeout(()=>{setIdleWarning(true);lockTimer.current=setTimeout(()=>{sessionStorage.setItem(sessionKey.current,"idle_locked");setLocked(true);setIdleWarning(false);},60000);},600000);},[phase,locked]);
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
