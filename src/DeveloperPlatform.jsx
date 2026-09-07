import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Activity, Bot, Box, Braces, Check, ChevronDown, CircleDot, Cloud,
  Code2, Database, FileCode2, GitBranch, GitCommitHorizontal, Globe2,
  KeyRound, LayoutDashboard, Link2, Logs, Package, Play, Plus, Rocket,
  Search, Settings, ShieldCheck, Sparkles, Terminal, TestTube2, UserRound,
  Users, Wrench, X
} from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const nav = [
  ["HOME", LayoutDashboard, "blue"], ["PROJECTS", Box, "violet"], ["WORKSPACE", Code2, "cyan"],
  ["AGENTS", Bot, "purple"], ["AI MODELS", Sparkles, "pink"], ["TEMPLATES", Package, "amber"],
  ["CODE", FileCode2, "blue"], ["DATABASE", Database, "teal"], ["API", Braces, "orange"],
  ["INTEGRATIONS", Link2, "green"], ["BUILDS", Wrench, "violet"], ["TESTS", TestTube2, "pink"],
  ["DEPLOYMENTS", Rocket, "green"], ["RUNTIME", Activity, "cyan"], ["LOGS", Logs, "slate"],
  ["MONITORING", Globe2, "blue"], ["API KEYS", KeyRound, "amber"], ["DOCUMENTATION", FileCode2, "slate"],
];

const tools = [
  ["New project", Plus, "violet"], ["Create agent", Bot, "purple"], ["Open database", Database, "teal"],
  ["Connect GitHub", GitBranch, "blue"], ["Connect Vercel", Cloud, "green"], ["Run build", Wrench, "orange"],
  ["Run tests", TestTube2, "pink"], ["Deploy", Rocket, "green"], ["Open terminal", Terminal, "slate"],
  ["API explorer", Braces, "amber"], ["Runtime", Activity, "cyan"], ["Security", ShieldCheck, "red"],
];

function ColorIcon({ icon: Icon, color = "blue", size = 17 }) { return <span className={`dp-icon ${color}`}><Icon size={size} /></span>; }

export default function DeveloperPlatform() {
  const [section, setSection] = useState("HOME");
  const [profileOpen, setProfileOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({ display_name: "Developer", bio: "Builder on Merveil", primary_language: "TypeScript", experience_level: "expert", frameworks: ["React", "Vite"], sectors: ["AI", "Developer tools"] });
  const [draft, setDraft] = useState(profile);
  const [projects, setProjects] = useState([]);
  const [connected, setConnected] = useState({ github: false, vercel: false, supabase: Boolean(supabase) });
  const [searchOpen, setSearchOpen] = useState(false);
  const [command, setCommand] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive || !user) return;
      const [{ data: dp }, { data: ps }, { data: conns }] = await Promise.all([
        supabase.from("developer_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("developer_projects").select("*").eq("owner_user_id", user.id).order("updated_at", { ascending: false }).limit(8),
        supabase.from("developer_provider_connections").select("provider,status").eq("owner_user_id", user.id),
      ]);
      if (dp) { setProfile(dp); setDraft(dp); }
      if (ps) setProjects(ps);
      if (conns) setConnected(c => ({ ...c, ...Object.fromEntries(conns.map(x => [x.provider, x.status === "connected"])) }));
    }
    load();
    return () => { alive = false; };
  }, []);

  const saveProfile = async () => {
    setProfile(draft); setEditing(false);
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("developer_profiles").upsert({ ...draft, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  };

  const visibleProjects = useMemo(() => projects.length ? projects : [
    { id: "demo-1", name: "Merveil Connect", tagline: "Trusted AI communication", stage: "deployed", momentum: 92 },
    { id: "demo-2", name: "Merveil Intelligence", tagline: "Developer intelligence layer", stage: "building", momentum: 68 },
  ], [projects]);

  const statusLabel = p => p.stage === "deployed" ? "Production" : p.stage === "building" ? "Building" : p.stage || "Idea";

  return <div className="dp-shell">
    <header className="dp-topbar">
      <div className="dp-brand"><div className="dp-mark">M</div><div><strong>MERVEIL AI</strong><span>DEVELOPER</span></div></div>
      <button className="dp-search" onClick={() => setSearchOpen(true)}><Search size={16}/> Search or jump to… <kbd>⌘ K</kbd></button>
      <div className="dp-top-actions"><button className="dp-plus"><Plus size={17}/></button><button className="dp-bell">●</button><button className="dp-user" onClick={() => setProfileOpen(v => !v)}><span className="dp-avatar">{(profile.display_name || "D").slice(0,1).toUpperCase()}</span>{profile.display_name || "Developer"}<ChevronDown size={14}/></button></div>
    </header>
    <div className="dp-body">
      <aside className="dp-sidebar">
        <div className="dp-verified"><ShieldCheck size={15}/><span>Merveil Passport</span><Check size={13}/></div>
        <nav>{nav.map(([label, Icon, color]) => <button key={label} className={section === label ? "active" : ""} onClick={() => setSection(label)}><ColorIcon icon={Icon} color={color}/><span>{label}</span></button>)}</nav>
        <div className="dp-sidebar-bottom"><button onClick={() => setSection("PROFILE")}><ColorIcon icon={UserRound} color="cyan"/><span>Developer Profile</span></button><button><ColorIcon icon={Settings} color="slate"/><span>Settings</span></button></div>
      </aside>
      <main className="dp-main">
        {section === "HOME" ? <>
          <div className="dp-page-head"><div><div className="dp-eyebrow">DEVELOPER WORKSPACE · UAE / GLOBAL</div><h1>Good evening, {profile.display_name || "Developer"}.</h1><p>Build, test and ship from one connected Merveil environment.</p></div><div className="dp-head-buttons"><button className="dp-btn violet" onClick={() => setSection("PROJECTS")}><Plus size={16}/> New project</button><button className="dp-btn ghost" onClick={() => setSection("WORKSPACE")}><Code2 size={16}/> Open workspace</button></div></div>
          <section className="dp-hero-grid"><div className="dp-card dp-command-card"><div className="dp-card-title"><Sparkles size={17}/><span>Merveil Intelligence</span><span className="live-dot">LIVE</span></div><h2>What are you building?</h2><div className="dp-ai-input"><Sparkles size={17}/><input value={command} onChange={e => setCommand(e.target.value)} placeholder="Describe an idea, fix, build or deployment…"/><button onClick={() => { setSection("WORKSPACE"); setCommand(""); }}><Play size={15}/></button></div><div className="dp-suggestions">{["Create a new AI agent", "Diagnose my latest build", "Prepare a production deployment"].map(x => <button key={x} onClick={() => setCommand(x)}>{x}</button>)}</div></div><div className="dp-card dp-health"><div className="dp-card-title"><Activity size={17}/> Platform health</div><div className="health-row"><span>Workspace</span><b>Operational</b></div><div className="health-row"><span>Supabase</span><b>{connected.supabase ? "Connected" : "Configure"}</b></div><div className="health-row"><span>GitHub</span><b>{connected.github ? "Connected" : "Not connected"}</b></div><div className="health-row"><span>Vercel</span><b>{connected.vercel ? "Connected" : "Not connected"}</b></div></div></section>
          <div className="dp-section-title"><h2>Recent projects</h2><button onClick={() => setSection("PROJECTS")}>View all →</button></div><section className="dp-project-grid">{visibleProjects.map(p => <button className="dp-project" key={p.id} onClick={() => setSection("WORKSPACE")}><div className="project-top"><ColorIcon icon={Box} color={p.stage === "deployed" ? "green" : "violet"}/><span className="stage">● {statusLabel(p)}</span></div><h3>{p.name}</h3><p>{p.tagline || "Merveil project"}</p><div className="progress"><i style={{ width: `${p.momentum || 0}%` }}/></div><small>{p.momentum || 0}% momentum</small></button>)}</section>
          <div className="dp-section-title"><h2>Developer tools</h2><span>Build surface</span></div><section className="dp-tools">{tools.map(([label, Icon, color]) => <button key={label} className="dp-tool" onClick={() => setSection(label.toUpperCase())}><ColorIcon icon={Icon} color={color}/><span>{label}</span><span>→</span></button>)}</section>
        </> : section === "PROFILE" ? <Profile profile={profile} draft={draft} setDraft={setDraft} editing={editing} setEditing={setEditing} saveProfile={saveProfile}/>
        : <Workspace section={section} projects={visibleProjects} connected={connected} setSection={setSection}/>} 
      </main>
    </div>
    {profileOpen && <div className="dp-profile-pop"><div className="pop-head"><span className="dp-avatar large">{(profile.display_name || "D").slice(0,1).toUpperCase()}</span><div><b>{profile.display_name || "Developer"}</b><small>@developer</small></div><button onClick={() => setProfileOpen(false)}><X size={16}/></button></div><button onClick={() => { setSection("PROFILE"); setProfileOpen(false); }}>View profile</button><button onClick={() => { setSection("PROFILE"); setEditing(true); setProfileOpen(false); }}>Edit profile</button></div>}
    {searchOpen && <div className="dp-overlay" onClick={() => setSearchOpen(false)}><div className="dp-command-palette" onClick={e => e.stopPropagation()}><div className="palette-search"><Search size={18}/><input autoFocus placeholder="Search projects, tools, settings…"/></div>{tools.slice(0,8).map(([x, Icon, color]) => <button key={x} onClick={() => { setSection(x.toUpperCase()); setSearchOpen(false); }}><ColorIcon icon={Icon} color={color}/>{x}<kbd>↵</kbd></button>)}</div></div>}
  </div>;
}

function Profile({ profile, draft, setDraft, editing, setEditing, saveProfile }) { return <div className="profile-page"><div className="profile-cover"/><div className="profile-identity"><span className="profile-avatar">{(profile.display_name || "D").slice(0,1).toUpperCase()}</span><div><h1>{profile.display_name || "Developer"}</h1><p>{profile.bio || "Builder on Merveil"}</p><span className="verified"><ShieldCheck size={14}/> Merveil Passport verified</span></div><button className="dp-btn ghost" onClick={() => setEditing(v => !v)}>{editing ? "Cancel" : "Edit profile"}</button></div>{editing ? <div className="edit-panel"><label>Display name<input value={draft.display_name || ""} onChange={e => setDraft({...draft, display_name:e.target.value})}/></label><label>Bio<textarea value={draft.bio || ""} onChange={e => setDraft({...draft, bio:e.target.value})}/></label><label>Primary language<input value={draft.primary_language || ""} onChange={e => setDraft({...draft, primary_language:e.target.value})}/></label><label>Experience<select value={draft.experience_level || ""} onChange={e => setDraft({...draft, experience_level:e.target.value})}><option>beginner</option><option>intermediate</option><option>expert</option></select></label><button className="dp-btn violet" onClick={saveProfile}>Save profile</button></div> : <div className="profile-content"><div className="profile-main"><div className="dp-card"><div className="dp-card-title"><GitCommitHorizontal size={17}/> Contribution activity</div><div className="contrib">{Array.from({length:84}).map((_,i)=><i key={i} className={i%9===0?"hot":i%4===0?"mid":""}/>)}</div></div><div className="dp-card"><div className="dp-card-title"><Box size={17}/> Pinned projects</div><div className="pin-grid"><div>Merveil Connect<small>Trusted communication</small></div><div>Merveil Intelligence<small>AI developer layer</small></div></div></div></div><aside className="profile-side"><b>Developer profile</b><p>{profile.primary_language || "TypeScript"}</p><p>{profile.experience_level || "expert"}</p><div className="tag-list">{(profile.frameworks || []).map(x => <span key={x}>{x}</span>)}</div></aside></div>}</div> }

function Workspace({ section, projects, connected, setSection }) { const title = section[0] + section.slice(1).toLowerCase(); return <div className="workspace"><div className="workspace-head"><div><div className="dp-eyebrow">MERVEIL DEVELOPER</div><h1>{title}</h1><p>Connected engineering surface for your products.</p></div><div className="workspace-actions"><button className="dp-btn ghost"><Search size={15}/> Filter</button><button className="dp-btn violet"><Plus size={15}/> Create</button></div></div><div className="workspace-tabs">Overview <span>Files</span><span>Code</span><span>AI</span><span>Build</span><span>Test</span><span>Deploy</span><span>Logs</span></div><div className="workspace-grid"><div className="file-tree dp-card"><b>PROJECTS</b>{projects.map(p=><button key={p.id} onClick={() => setSection("WORKSPACE")}><Box size={15}/>{p.name}</button>)}<hr/><b>TOOLS</b>{["src/", "api/", "components/", "database/", "tests/"].map(x=><span key={x} className="tree-row"><FileCode2 size={14}/>{x}</span>)}</div><div className="editor dp-card"><div className="editor-bar"><span>README.md</span><span>main</span><span className="green-text">● Ready</span></div><pre>{`# Merveil Developer\n\nBuild for the world.\n\nMerveil Intelligence connects:\n  idea → product → infrastructure → impact\n\n// Workspace is ready\n// Supabase: ${connected.supabase ? "connected" : "configure"}\n// GitHub: ${connected.github ? "connected" : "connect"}\n// Vercel: ${connected.vercel ? "connected" : "connect"}`}</pre><div className="terminal"><div><Terminal size={14}/> Terminal <span>Build</span><span>Problems</span><span>Output</span></div><code>$ merveil build<br/>✓ workspace loaded<br/>✓ dependencies resolved<br/>✓ ready for test</code></div></div><div className="ai-panel dp-card"><div className="dp-card-title"><Sparkles size={17}/> Merveil Intelligence</div><p>Ask about your project, code, tests or deployment.</p><button className="ai-action"><Wrench size={15}/> Diagnose project</button><button className="ai-action"><TestTube2 size={15}/> Generate tests</button><button className="ai-action"><Rocket size={15}/> Prepare deploy</button></div></div></div> }
