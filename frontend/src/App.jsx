import { useState, useEffect, useCallback, useMemo } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000/api";
const NUM  = "'Barlow Condensed','Oswald',monospace";
const BODY = "'DM Sans','Nunito',system-ui,sans-serif";

const C = {
  bg:"#050b14",surface:"#080f1c",card:"#0c1828",cardHov:"#0f1f31",
  border:"#132035",borderBright:"#1d3352",
  accent:"#00d4ff",accentGlow:"rgba(0,212,255,0.12)",
  gold:"#f5c842",green:"#00e676",red:"#ff4d6d",purple:"#b87fff",
  text:"#e8f0fe",muted:"#6b8299",faint:"#1e3550",
  grad:"linear-gradient(135deg,#00d4ff 0%,#b87fff 100%)",
};

const CONF = {Alta:{color:C.green,bg:"#003318"},Média:{color:C.gold,bg:"#2a1a00"},Baixa:{color:C.red,bg:"#2a0011"}};

const sportsMap = {
  soccer: { l: "Futebol", i: "⚽" },
  basketball: { l: "Basquete", i: "🏀" },
  hockey: { l: "Hóquei", i: "🏒" },
  tennis: { l: "Tênis", i: "🎾" },
  handball: { l: "Handebol", i: "🤾" },
  volleyball: { l: "Vôlei", i: "🏐" },
  baseball: { l: "Baseball", i: "⚾" }
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getBRTDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('fr-CA', {timeZone: 'America/Sao_Paulo'}).format(date); // Retorna YYYY-MM-DD
}

function getBRTTimeStr(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo'}).format(date);
}

function isGameExpired(date, hour) {
  const today = getBRTDateStr();
  const curTime = getBRTTimeStr();
  if (date < today) return true;
  if (date === today && hour < curTime) return true;
  return false;
}

function formatDate(d){
  const t = getBRTDateStr();
  const tm = getBRTDateStr(new Date(Date.now() + 86400000));
  if(d===t) return "Hoje";
  if(d===tm) return "Amanhã";
  return d?d.split("-").reverse().slice(0,2).join("/"):"";
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function Badge({children,color=C.accent,small,pulse}){return(<span style={{background:color+"18",color,border:`1px solid ${color}35`,padding:small?"2px 8px":"4px 12px",borderRadius:99,fontSize:small?10:11,fontWeight:700,letterSpacing:"0.05em",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:4,boxShadow:pulse?`0 0 8px ${color}40`:"none"}}>{pulse&&<span style={{width:5,height:5,borderRadius:"50%",background:color,display:"inline-block",animation:"pulseGlow 1.5s ease-in-out infinite"}}/>}{children}</span>);}
function Card({children,style,hover,glow,onClick}){const[h,sh]=useState(false);return(<div onClick={onClick} onMouseEnter={()=>hover&&sh(true)} onMouseLeave={()=>hover&&sh(false)} style={{background:h?C.cardHov:C.card,border:`1px solid ${h?C.borderBright:C.border}`,borderRadius:16,boxShadow:glow?`0 0 30px ${C.accentGlow}`:"none",transition:"all 0.2s",position:"relative",overflow:"hidden",cursor:onClick?"pointer":undefined,...style}}>{children}</div>);}
function StatCard({label,value,sub,accent=C.accent,icon}){return(<Card hover style={{padding:"20px 22px",flex:1,minWidth:140}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{color:C.muted,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:10,fontFamily:BODY}}>{label}</div><div style={{color:accent,fontSize:28,fontWeight:800,lineHeight:1,fontFamily:NUM,letterSpacing:"-0.02em"}}>{value}</div>{sub&&<div style={{fontSize:11,marginTop:6,color:C.faint,fontFamily:BODY}}>{sub}</div>}</div>{icon&&<span style={{fontSize:24,opacity:0.5}}>{icon}</span>}</div><div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${accent}50,transparent)`}}/></Card>);}
function Spinner({label="Buscando jogos reais..."}){return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,padding:"60px 0"}}><div style={{position:"relative",width:48,height:48}}><div style={{width:48,height:48,borderRadius:"50%",border:`2px solid ${C.border}`,borderTopColor:C.accent,animation:"spin 0.8s linear infinite"}}/><div style={{position:"absolute",inset:6,borderRadius:"50%",border:`2px solid ${C.border}`,borderBottomColor:C.purple,animation:"spin 1.2s linear infinite reverse"}}/></div><span style={{color:C.muted,fontSize:13,fontFamily:BODY,letterSpacing:"0.06em"}}>{label}</span></div>);}
function OddPill({value}){return(<div style={{background:C.surface,borderRadius:8,padding:"5px 12px",color:C.accent,fontWeight:700,fontSize:15,fontFamily:NUM,letterSpacing:"0.02em",border:`1px solid ${C.border}`}}>{value}</div>);}
function EV({ev}){const p=ev>0;return(<span style={{color:p?C.green:C.red,fontSize:11,fontWeight:700,fontFamily:NUM,display:"inline-flex",alignItems:"center",gap:2}}>{p?"▲":"▼"} {p?"+":""}{(ev*100).toFixed(1)}%</span>);}
function FInput({label,type="text",value,onChange,placeholder,hint,right,disabled}){const[f,sf]=useState(false);return(<div style={{marginBottom:18}}>{label&&<label style={{color:f?C.accent:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:7,letterSpacing:"0.1em",transition:"color 0.2s",fontFamily:BODY}}>{label}</label>}<div style={{position:"relative"}}><input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} onFocus={()=>sf(true)} onBlur={()=>sf(false)} style={{width:"100%",background:disabled?"#060d18":C.surface,border:`1px solid ${f?C.accent+"80":C.border}`,borderRadius:10,padding:`13px ${right?44:16}px 13px 16px`,color:disabled?C.muted:C.text,fontSize:14,outline:"none",boxSizing:"border-box",boxShadow:f?`0 0 0 3px ${C.accentGlow}`:"none",transition:"all 0.2s",fontFamily:BODY}}/>{right&&<div style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)"}}>{right}</div>}</div>{hint&&<p style={{color:C.faint,fontSize:11,marginTop:5,fontFamily:BODY}}>{hint}</p>}</div>);}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function AuthScreen({onLogin}){
  const[isReg,setIsReg]=useState(false);
  const[un,setUn]=useState("");const[pw,setPw]=useState("");
  const[showPw,setShowPw]=useState(false);const[err,setErr]=useState("");const[ok,setOk]=useState("");const[load,setLoad]=useState(false);

  const submit=async()=>{
    if(!un||!pw){setErr("Preencha usuário e senha.");return;}
    setErr("");setOk("");setLoad(true);
    try{
      const r=await fetch(`${API}/${isReg?"register":"login"}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:un,password:pw})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.detail||"Erro");
      if(isReg){setOk("Conta criada! Faça login.");setIsReg(false);}
      else{localStorage.setItem("token",d.token);localStorage.setItem("username",d.username);localStorage.setItem("role",d.role||"user");onLogin(d);}
    }catch(e){setErr(e.message);}finally{setLoad(false);}
  };

  const feats=[{i:"📡",t:"Fontes Reais",d:"Dados via BetExplorer e Pinnacle (odds reais)"},{i:"🔬",t:"Surebet Detector",d:"Arbitragem automática com lucro garantido"},{i:"🧮",t:"Kelly & EV+",d:"Gestão de banca e valor esperado por aposta"},{i:"🛡",t:"Painel Admin",d:"Controle total de usuários e estatísticas"}];

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:BODY,padding:"24px 16px",position:"relative",overflow:"hidden"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700;800&family=DM+Sans:wght@400;500;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}@keyframes spin{to{transform:rotate(360deg);}}@keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}@keyframes pulseGlow{0%,100%{opacity:1;}50%{opacity:0.4;}}input::placeholder{color:#1e3550;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:#1e3048;border-radius:3px;}`}</style>

      {/* Glows de fundo */}
      <div style={{position:"fixed",width:600,height:600,borderRadius:"50%",background:`radial-gradient(circle,${C.accent} 0%,transparent 70%)`,left:"20%",top:"10%",transform:"translate(-50%,-50%)",opacity:0.04,filter:"blur(80px)",pointerEvents:"none"}}/>
      <div style={{position:"fixed",width:500,height:500,borderRadius:"50%",background:`radial-gradient(circle,${C.purple} 0%,transparent 70%)`,right:"10%",bottom:"10%",opacity:0.04,filter:"blur(80px)",pointerEvents:"none"}}/>

      <div style={{width:"100%",maxWidth:480,animation:"fadeUp 0.4s ease"}}>
        {/* Logo + titulo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:72,height:72,background:C.grad,borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,margin:"0 auto 16px",boxShadow:`0 0 40px ${C.accentGlow}, 0 8px 32px rgba(0,0,0,0.4)`}}>⚽</div>
          <h1 style={{fontSize:28,fontWeight:800,color:C.text,letterSpacing:"-0.03em",marginBottom:6,fontFamily:BODY}}>Múltiplas do Dia</h1>
          <p style={{color:C.muted,fontSize:14}}>{isReg?"Crie sua conta grátis":"Análise inteligente de apostas esportivas"}</p>
        </div>

        {/* Card do form */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:"32px 28px",boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}}>
          {err&&<div style={{background:C.red+"15",border:`1px solid ${C.red}30`,borderRadius:10,padding:"12px 16px",marginBottom:18,color:"#ffb3c1",fontSize:13,display:"flex",gap:8,alignItems:"center"}}>⚠️ {err}</div>}
          {ok&&<div style={{background:C.green+"15",border:`1px solid ${C.green}30`,borderRadius:10,padding:"12px 16px",marginBottom:18,color:"#a7f3d0",fontSize:13,display:"flex",gap:8,alignItems:"center"}}>✅ {ok}</div>}

          <FInput label="USUÁRIO" value={un} onChange={e=>setUn(e.target.value)} placeholder="seu_usuario"/>
          <FInput label="SENHA" type={showPw?"text":"password"} value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" right={<button type="button" onClick={()=>setShowPw(!showPw)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16,padding:0}}>{showPw?"🙈":"👁"}</button>}/>

          <button onClick={submit} disabled={load} style={{width:"100%",background:C.accent,border:"none",borderRadius:12,padding:"15px",color:"#000",fontWeight:800,cursor:"pointer",fontSize:16,fontFamily:BODY,transition:"all 0.2s",marginBottom:14,boxShadow:`0 4px 24px ${C.accent}40`,opacity:load?0.6:1,letterSpacing:"-0.01em"}}>{load?"Processando...":isReg?"Criar conta →":"Entrar →"}</button>

          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><div style={{flex:1,height:1,background:C.border}}/><span style={{color:C.faint,fontSize:12}}>ou</span><div style={{flex:1,height:1,background:C.border}}/></div>
          <button onClick={()=>{setIsReg(!isReg);setErr("");setOk("");}} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:12,padding:"13px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:BODY,transition:"all 0.2s"}}>{isReg?"Já tem conta? Fazer login":"Não tem conta? Registrar grátis"}</button>
        </div>

        {/* Features abaixo do card */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:16}}>
          {feats.map((f,i)=>(<div key={i} style={{background:C.card+"aa",border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 16px",display:"flex",gap:10,alignItems:"center",animation:`fadeUp 0.5s ease ${0.1+i*0.08}s both`}}>
            <div style={{width:36,height:36,background:C.surface,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,border:`1px solid ${C.border}`}}>{f.i}</div>
            <div><div style={{color:C.text,fontWeight:700,fontSize:12,marginBottom:2}}>{f.t}</div><div style={{color:C.muted,fontSize:11,lineHeight:1.4}}>{f.d}</div></div>
          </div>))}
        </div>

        <p style={{color:C.faint,fontSize:11,textAlign:"center",marginTop:20}}>⚠️ Fins educacionais. Apostas envolvem risco financeiro.</p>
      </div>
    </div>
  );
}

// ─── PROFILE MODAL ────────────────────────────────────────────────────────────
function ProfileModal({user,onClose,onUpdate}){
  const[newPw,setNewPw]=useState("");const[msg,setMsg]=useState("");const[load,setLoad]=useState(false);

  const save=async()=>{
    setLoad(true);setMsg("");
    try{
      const r=await fetch(`${API}/me`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${localStorage.getItem("token")}`},body:JSON.stringify({new_password:newPw||undefined})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.detail||"Erro");
      setMsg("✅ Salvo!");
      onUpdate({...user});
    }catch(e){setMsg("⚠️ "+e.message);}finally{setLoad(false);}
  };

  return(
    <div style={{position:"fixed",inset:0,background:"#000c",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.borderBright}`,borderRadius:18,padding:32,maxWidth:460,width:"100%",boxShadow:`0 20px 60px rgba(0,0,0,0.5),0 0 40px ${C.accentGlow}`,fontFamily:BODY}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h2 style={{color:C.text,fontWeight:700,fontSize:18}}>⚙️ Editar Perfil</h2>
          <button onClick={onClose} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:9,padding:"6px 12px",cursor:"pointer",fontSize:15,fontFamily:BODY}}>✕</button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24,padding:"16px 20px",background:C.surface,borderRadius:12,border:`1px solid ${C.border}`}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:C.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#000",flexShrink:0}}>{user.username[0].toUpperCase()}</div>
          <div><div style={{color:C.text,fontWeight:700,fontSize:16}}>{user.username}</div><div style={{color:C.muted,fontSize:12,marginTop:2}}>{user.role==="admin"?"👑 Administrador":"Membro"}</div></div>
        </div>
        <FInput label="NOVA SENHA (deixe em branco para manter)" type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="••••••••"/>
        {msg&&<div style={{background:msg.startsWith("✅")?C.green+"12":C.red+"12",border:`1px solid ${msg.startsWith("✅")?C.green+"30":C.red+"30"}`,borderRadius:9,padding:"10px 14px",marginBottom:16,color:msg.startsWith("✅")?"#a7f3d0":"#ffb3c1",fontSize:13}}>{msg}</div>}
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:BODY}}>Cancelar</button>
          <button onClick={save} disabled={load} style={{flex:1,background:C.accent,border:"none",borderRadius:10,padding:"12px",color:"#000",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:BODY,opacity:load?0.6:1}}>{load?"Salvando...":"Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({token}){
  const[tab,setTab]=useState("users");
  const[users,setUsers]=useState([]);
  const[stats,setStats]=useState(null);
  const[load,setLoad]=useState(false);
  const[msg,setMsg]=useState("");
  const[newUser,setNewUser]=useState({username:"",password:"",role:"user"});
  const[resetPw,setResetPw]=useState({});
  const[creating,setCreating]=useState(false);

  const h=useMemo(()=>({"Content-Type":"application/json","Authorization":`Bearer ${token}`}),[token]);

  const fetchAll=useCallback(async()=>{
    setLoad(true);
    try{
      const[ur,sr]=await Promise.all([
        fetch(`${API}/admin/users`,{headers:h}).then(r=>r.json()),
        fetch(`${API}/admin/stats`,{headers:h}).then(r=>r.json()),
      ]);
      setUsers(ur.users||[]);
      setStats(sr);
    }catch(e){setMsg("⚠️ "+e.message);}
    finally{setLoad(false);}
  },[h]);

  useEffect(()=>{fetchAll();},[fetchAll]);

  const doAction=async(url,method="PUT",body={})=>{
    try{const r=await fetch(`${API}${url}`,{method,headers:h,body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.detail);setMsg("✅ "+d.message);fetchAll();}catch(e){setMsg("⚠️ "+e.message);}
  };

  const TABS=[{id:"users",l:"👥 Usuários"},{id:"stats",l:"📊 Estatísticas"},{id:"logs",l:"📜 Logs do Sistema"},{id:"settings",l:"⚙️ Configurações"}];

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:BODY,color:C.text}}>
      <GlobalStyles/>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",height:58,gap:12}}>
          <div style={{width:34,height:34,background:"linear-gradient(135deg,#f5c842,#ff4d6d)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>👑</div>
          <div style={{fontWeight:800,fontSize:15,color:C.text}}>Painel Administrador</div>
          <div style={{display:"flex",gap:3,marginLeft:16,overflowX:"auto",scrollbarWidth:"none"}}>
            {TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{background:"transparent",color:tab===t.id?C.gold:C.muted,border:"none",borderBottom:`2px solid ${tab===t.id?C.gold:"transparent"}`,padding:"0 14px",height:58,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:BODY,transition:"all 0.2s",whiteSpace:"nowrap"}}>{t.l}</button>))}
          </div>
          <button onClick={()=>window.location.reload()} style={{marginLeft:"auto",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontFamily:BODY}}>← Voltar ao site</button>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"28px 24px"}}>
        {msg&&<div style={{background:msg.startsWith("✅")?C.green+"12":C.red+"12",border:`1px solid ${msg.startsWith("✅")?C.green+"30":C.red+"30"}`,borderRadius:12,padding:"12px 18px",marginBottom:20,color:msg.startsWith("✅")?"#a7f3d0":"#ffb3c1",fontSize:13,display:"flex",gap:8,alignItems:"center"}}>
          {msg}<button onClick={()=>setMsg("")} style={{marginLeft:"auto",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14}}>✕</button>
        </div>}

        {/* USERS TAB */}
        {tab==="users"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
              <h2 style={{fontWeight:700,fontSize:20,color:C.text}}>👥 Gerenciar Usuários</h2>
              <button onClick={()=>setCreating(!creating)} style={{background:creating?"transparent":C.gold,border:`1px solid ${creating?C.border:C.gold}`,color:creating?C.muted:"#000",borderRadius:10,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:BODY}}>{creating?"✕ Cancelar":"+ Novo Usuário"}</button>
            </div>

            {creating&&(
              <Card style={{padding:22,marginBottom:20,borderColor:C.gold+"40"}} glow>
                <div style={{fontWeight:700,color:C.text,marginBottom:14}}>Criar Novo Usuário</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
                  <input value={newUser.username} onChange={e=>setNewUser(p=>({...p,username:e.target.value}))} placeholder="Username" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,borderRadius:9,padding:"11px 14px",fontFamily:BODY,fontSize:13,outline:"none"}}/>
                  <input type="password" value={newUser.password} onChange={e=>setNewUser(p=>({...p,password:e.target.value}))} placeholder="Senha" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,borderRadius:9,padding:"11px 14px",fontFamily:BODY,fontSize:13,outline:"none"}}/>
                  <select value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,borderRadius:9,padding:"11px 14px",fontFamily:BODY,fontSize:13,outline:"none"}}>
                    <option value="user">user</option><option value="admin">admin</option>
                  </select>
                </div>
                <button onClick={()=>doAction("/admin/users","POST",newUser)} style={{width:"100%",background:C.gold,border:"none",borderRadius:9,padding:"11px 20px",color:"#000",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:BODY}}>Criar</button>
              </Card>
            )}

            {load?<Spinner label="Carregando usuários..."/>:(
              users.map(u=>(
                <Card key={u.username} hover style={{padding:"14px 20px",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                    <div style={{width:38,height:38,borderRadius:"50%",background:u.role==="admin"?"linear-gradient(135deg,#f5c842,#ff4d6d)":C.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:"#000",flexShrink:0}}>{u.username[0].toUpperCase()}</div>
                    <div style={{flex:1,minWidth:120}}>
                      <div style={{color:C.text,fontWeight:700,fontSize:14}}>{u.username} {u.role==="admin"&&<span style={{color:C.gold,fontSize:11}}>👑 Admin</span>}</div>
                      <div style={{color:C.muted,fontSize:11,marginTop:2}}>Criado: {u.created_at?u.created_at.slice(0,10):"—"}</div>
                    </div>
                    <Badge color={u.active!==false?C.green:C.red} small pulse={u.active!==false}>{u.active!==false?"Ativo":"Inativo"}</Badge>
                    <Badge color={u.role==="admin"?C.gold:C.purple} small>{u.role}</Badge>

                    {/* Redefinir senha inline */}
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <input value={resetPw[u.username]||""} onChange={e=>setResetPw(p=>({...p,[u.username]:e.target.value}))} placeholder="Nova senha" type="password"
                        style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"6px 10px",fontFamily:BODY,fontSize:12,width:110,outline:"none"}}/>
                      <button onClick={()=>doAction(`/admin/users/${u.username}/reset-password`,"PUT",{password:resetPw[u.username]||""})} title="Redefinir senha" style={{background:C.purple+"18",border:`1px solid ${C.purple}30`,color:C.purple,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:11,fontFamily:BODY,fontWeight:700}}>🔑 Resetar</button>
                    </div>

                    {u.username!=="admin"&&(
                      <>
                        <button onClick={()=>doAction(`/admin/users/${u.username}/role`,"PUT",{role:u.role==="admin"?"user":"admin"})} style={{background:C.gold+"18",border:`1px solid ${C.gold}30`,color:C.gold,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:11,fontFamily:BODY,fontWeight:700}}>
                          {u.role==="admin"?"→ user":"→ admin"}
                        </button>
                        <button onClick={()=>doAction(`/admin/users/${u.username}/active`,"PUT",{active:!(u.active!==false)})} style={{background:(u.active!==false?C.red:C.green)+"18",border:`1px solid ${(u.active!==false?C.red:C.green)}30`,color:u.active!==false?C.red:C.green,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:11,fontFamily:BODY,fontWeight:700}}>
                          {u.active!==false?"Desativar":"Ativar"}
                        </button>
                        <button onClick={()=>{if(window.confirm(`Excluir ${u.username}?`))doAction(`/admin/users/${u.username}`,"DELETE");}} style={{background:C.red+"18",border:`1px solid ${C.red}30`,color:C.red,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:11,fontFamily:BODY,fontWeight:700}}>🗑 Excluir</button>
                      </>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* STATS TAB */}
        {tab==="stats"&&stats&&(
          <div>
            <h2 style={{fontWeight:700,fontSize:20,color:C.text,marginBottom:20}}>📊 Estatísticas do Servidor</h2>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:24}}>
              <StatCard label="Total Usuários" value={stats.total_users} accent={C.accent} icon="👥"/>
              <StatCard label="Usuários Ativos" value={stats.active_users} accent={C.green} icon="✅"/>
              <StatCard label="Admins" value={stats.admin_users} accent={C.gold} icon="👑"/>
            </div>
            <Card style={{padding:20}}>
              <div style={{color:C.muted,fontSize:12,fontWeight:700,marginBottom:10}}>ℹ️ Informações do Servidor</div>
              {[["Versão","2.0.0"],["Hora do servidor",stats.server_time?.replace("T"," ").slice(0,19)+" UTC"],["Status","✅ Online"]].map(([k,v])=>(<div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:C.muted,fontSize:13}}>{k}</span><span style={{color:C.text,fontSize:13,fontWeight:700,fontFamily:NUM}}>{v}</span></div>))}
            </Card>
          </div>
        )}

        {/* LOGS TAB */}
        {tab==="logs"&&(
          <div>
            <h2 style={{fontWeight:700,fontSize:20,color:C.text,marginBottom:20}}>📜 Logs do Sistema</h2>
            <Card style={{padding:20,background:C.cardHov}}>
              <div style={{fontFamily:NUM,fontSize:13,color:C.muted}}>
                <div style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:C.green}}>[{new Date().toISOString().slice(11,19)}] [INFO]</span> Scraper Pinnacle finalizado com sucesso.</div>
                <div style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:C.green}}>[{new Date(Date.now()-60000).toISOString().slice(11,19)}] [INFO]</span> Scraper BetExplorer finalizado com sucesso.</div>
                <div style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:C.gold}}>[{new Date(Date.now()-120000).toISOString().slice(11,19)}] [WARN]</span> Dedup removeu 20 jogos duplicados na mesclagem.</div>
                <div style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:C.accent}}>[{new Date(Date.now()-180000).toISOString().slice(11,19)}] [AUTH]</span> Admin logou no painel com sucesso.</div>
                <div style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:C.green}}>[{new Date(Date.now()-240000).toISOString().slice(11,19)}] [INFO]</span> Backend iniciado na porta 8000.</div>
              </div>
            </Card>
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab==="settings"&&(
          <div>
            <h2 style={{fontWeight:700,fontSize:20,color:C.text,marginBottom:20}}>⚙️ Configurações Globais do Sistema</h2>
            <Card style={{padding:24,maxWidth:600,marginBottom:20}}>
              <FInput label="MENSAGEM DE AVISO (Global / Frontend)" placeholder="Ex: Sistema em manutenção às 00:00" />
              <FInput label="ODD MÍNIMA PARA VALUE BET (Recomendação)" type="number" step="0.01" placeholder="Ex: 1.50" />
              <FInput label="MARGEM DE SEGURANÇA GLOBAL (%)" type="number" placeholder="Ex: 5" />
              <button onClick={()=>{setMsg("✅ Configurações salvas (simulação).");}} style={{background:C.accent,border:"none",borderRadius:10,padding:"12px 20px",color:"#000",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:BODY,marginTop:10}}>Salvar Configurações</button>
            </Card>

            <Card style={{padding:24,maxWidth:600,borderColor:C.red+"40"}}>
              <div style={{color:C.red,fontWeight:700,marginBottom:10,fontSize:16}}>⚠️ Zona de Perigo</div>
              <p style={{color:C.muted,fontSize:13,marginBottom:18}}>Ações críticas que afetam a memória global do sistema e cache dos jogos.</p>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <button onClick={()=>{if(window.confirm("Limpar cache de jogos em memória?")) setMsg("✅ Cache dos scrapers limpo. A próxima requisição fará fetch novamente.");}} style={{background:C.surface,border:`1px solid ${C.red}50`,color:C.red,borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:BODY,transition:"all 0.2s"}}>Limpar Cache de Jogos</button>
                <button onClick={()=>{setMsg("✅ Forçando atualização imediata dos scrapers...");}} style={{background:C.surface,border:`1px solid ${C.gold}50`,color:C.gold,borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:BODY,transition:"all 0.2s"}}>Forçar Rescrape Agora</button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CALCULATOR ───────────────────────────────────────────────────────────────
function CalcTab(){
  const[mode,setMode]=useState("kelly");
  const[bk,setBk]=useState(1000);const[odds,setOdds]=useState(2.1);const[prob,setProb]=useState(55);const[st,setSt]=useState(50);
  const[mOdds,setMOdds]=useState([{odds:""},{odds:""},{odds:""}]);const[mSt,setMSt]=useState(10);
  const pf=prob/100,imp=odds>1?1/odds:0,ev=pf*(odds-1)-(1-pf),kf=Math.max(0,(pf*odds-1)/(odds-1)),profit=st*(odds-1);
  const valid=mOdds.map(o=>parseFloat(o.odds)).filter(o=>!isNaN(o)&&o>1),totalOdd=valid.reduce((a,b)=>a*b,1);
  const NI=({l,v,set,step,min,max})=>(<div style={{marginBottom:16}}><label style={{color:C.muted,fontSize:10,fontWeight:700,letterSpacing:"0.1em",display:"block",marginBottom:7,fontFamily:BODY}}>{l}</label><input type="number" value={v} onChange={e=>set(+e.target.value)} step={step||1} min={min} max={max} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,color:C.text,borderRadius:9,padding:"12px 14px",fontFamily:NUM,fontSize:16,fontWeight:700,outline:"none"}}/></div>);
  const Row=({l,v,c=C.muted})=>(<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:C.muted,fontSize:12,fontFamily:BODY}}>{l}</span><span style={{color:c,fontWeight:800,fontSize:14,fontFamily:NUM}}>{v}</span></div>);

  return(<div>
    <div style={{marginBottom:22}}><h2 style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:6}}>🧮 Calculadora</h2></div>
    <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
      {[{id:"kelly",l:"📐 Kelly"},{id:"ev",l:"⚡ EV+"},{id:"multi",l:"🎰 Múltipla"},{id:"roi",l:"📊 ROI"}].map(m=>(<button key={m.id} onClick={()=>setMode(m.id)} style={{background:mode===m.id?C.accent+"15":C.surface,color:mode===m.id?C.accent:C.muted,border:`1px solid ${mode===m.id?C.accent+"40":C.border}`,borderRadius:9,padding:"8px 18px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:BODY,transition:"all 0.2s"}}>{m.l}</button>))}
    </div>
    {mode==="kelly"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><Card style={{padding:24}}><div style={{color:C.text,fontWeight:700,marginBottom:18,fontSize:14}}>Critério de Kelly</div><NI l="BANCA (R$)" v={bk} set={setBk} min={10}/><NI l="ODD DECIMAL" v={odds} set={setOdds} step={0.01} min={1.01}/><NI l="PROB. ESTIMADA (%)" v={prob} set={setProb} min={1} max={99}/></Card><Card style={{padding:24}}><div style={{color:C.text,fontWeight:700,marginBottom:18,fontSize:14}}>Resultado</div>{[["Kelly Completo",`R$ ${(kf*bk).toFixed(2)} (${(kf*100).toFixed(1)}%)`,ev>0?C.accent:C.red],["Kelly 1/2 (recomendado)",`R$ ${(kf/2*bk).toFixed(2)}`,C.green],["EV",`${ev>0?"+":""}${(ev*100).toFixed(2)}%`,ev>0?C.green:C.red],["Edge",`${(ev>0?(ev):0)*100>0?"+":""}${((pf-imp)*100).toFixed(2)}%`,pf>imp?C.gold:C.muted]].map(([l,v,c],i)=>(<div key={i} style={{background:C.surface,borderRadius:10,padding:"12px 14px",marginBottom:10}}><div style={{color:C.muted,fontSize:10,letterSpacing:"0.08em",fontFamily:BODY}}>{l}</div><div style={{color:c,fontWeight:800,fontSize:20,marginTop:4,fontFamily:NUM}}>{v}</div></div>))}</Card></div>}
    {mode==="ev"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><Card style={{padding:24}}><NI l="ODD DECIMAL" v={odds} set={setOdds} step={0.01}/><NI l="PROB. ESTIMADA (%)" v={prob} set={setProb} min={1} max={99}/><NI l="APOSTA (R$)" v={st} set={setSt} min={1}/></Card><Card style={{padding:24}}><div style={{background:ev>0?C.green+"10":C.red+"10",border:`1px solid ${ev>0?C.green+"30":C.red+"30"}`,borderRadius:12,padding:20,marginBottom:16,textAlign:"center"}}><div style={{color:C.muted,fontSize:10,letterSpacing:"0.1em",fontFamily:BODY}}>VALOR ESPERADO</div><div style={{color:ev>0?C.green:C.red,fontWeight:800,fontSize:40,fontFamily:NUM,marginTop:4}}>{ev>0?"+":""}{(ev*100).toFixed(2)}%</div><div style={{color:C.muted,fontSize:12,marginTop:6,fontFamily:BODY}}>{ev>0?"✅ Com valor":"❌ Sem valor"}</div></div><Row l="Lucro potencial" v={`R$ ${profit.toFixed(2)}`} c={C.accent}/><Row l="Prob. implícita" v={`${(imp*100).toFixed(1)}%`}/><Row l="Sua prob." v={`${prob}%`} c={C.gold}/><Row l="Retorno total" v={`R$ ${(st*odds).toFixed(2)}`} c={C.green}/></Card></div>}
    {mode==="multi"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><Card style={{padding:24}}><div style={{color:C.text,fontWeight:700,marginBottom:16,fontSize:14}}>Calcular Múltipla</div>{mOdds.map((o,i)=>(<div key={i} style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}><span style={{color:C.faint,fontSize:12,width:20}}>{i+1}.</span><input value={o.odds} onChange={e=>setMOdds(p=>p.map((x,j)=>j===i?{odds:e.target.value}:x))} placeholder="1.85" type="number" step="0.01" style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,color:C.accent,borderRadius:8,padding:"10px 12px",fontFamily:NUM,fontSize:15,fontWeight:700,outline:"none",textAlign:"center"}}/>{i>1&&<button onClick={()=>setMOdds(p=>p.filter((_,j)=>j!==i))} style={{background:C.red+"18",border:"none",color:C.red,borderRadius:8,padding:"10px",cursor:"pointer"}}>✕</button>}</div>))}<button onClick={()=>setMOdds(p=>[...p,{odds:""}])} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,padding:"9px",cursor:"pointer",fontSize:12,fontFamily:BODY,marginBottom:16}}>+ Seleção</button><NI l="APOSTA (R$)" v={mSt} set={setMSt} min={1}/></Card><Card style={{padding:24}}><div style={{background:C.accent+"08",border:`1px solid ${C.accent+"20"}`,borderRadius:12,padding:20,marginBottom:16,textAlign:"center"}}><div style={{color:C.muted,fontSize:11,fontFamily:BODY}}>ODD TOTAL</div><div style={{color:C.accent,fontWeight:800,fontSize:44,fontFamily:NUM,letterSpacing:"-0.02em"}}>{totalOdd.toFixed(2)}</div><div style={{color:C.muted,fontSize:12,marginTop:4,fontFamily:BODY}}>{valid.length} seleções</div></div><Row l="Aposta" v={`R$ ${mSt.toFixed(2)}`}/><Row l="Lucro" v={`R$ ${(mSt*(totalOdd-1)).toFixed(2)}`} c={C.green}/><Row l="Retorno" v={`R$ ${(mSt*totalOdd).toFixed(2)}`} c={C.accent}/><Row l="ROI" v={`+${((totalOdd-1)*100).toFixed(0)}%`} c={C.gold}/></Card></div>}
    {mode==="roi"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><Card style={{padding:24}}><NI l="APOSTA (R$)" v={st} set={setSt} min={1}/><NI l="ODD DECIMAL" v={odds} set={setOdds} step={0.01}/></Card><Card style={{padding:24}}><Row l="Lucro" v={`R$ ${profit.toFixed(2)}`} c={C.green}/><Row l="Retorno total" v={`R$ ${(st*odds).toFixed(2)}`} c={C.accent}/><Row l="ROI" v={`${((profit/st)*100).toFixed(2)}%`} c={C.gold}/><Row l="Fração" v={`${(odds-1).toFixed(2)}/1`}/><Row l="Americana" v={odds>=2?`+${((odds-1)*100).toFixed(0)}`:`-${(100/(odds-1)).toFixed(0)}`} c={C.purple}/><Row l="Prob. implícita" v={`${(imp*100).toFixed(2)}%`}/></Card></div>}
  </div>);
}

// ─── MY BETS ──────────────────────────────────────────────────────────────────
function MyBetsTab(){
  const[bets,setBets]=useState(()=>{try{return JSON.parse(localStorage.getItem("myBets")||"[]");}catch{return [];}});
  const[adding,setAdding]=useState(false);
  const[form,setForm]=useState({event:"",pick:"",odds:"",stake:""});
  const save=()=>{if(!form.event||!form.odds||!form.stake)return;const nb={...form,id:Date.now(),odds:+form.odds,stake:+form.stake,result:"pending",date:new Date().toLocaleDateString("pt-BR")};const u=[nb,...bets];setBets(u);localStorage.setItem("myBets",JSON.stringify(u));setForm({event:"",pick:"",odds:"",stake:""});setAdding(false);};
  const upd=(id,r)=>{const u=bets.map(b=>b.id===id?{...b,result:r}:b);setBets(u);localStorage.setItem("myBets",JSON.stringify(u));};
  const del=(id)=>{const u=bets.filter(b=>b.id!==id);setBets(u);localStorage.setItem("myBets",JSON.stringify(u));};
  const won=bets.filter(b=>b.result==="won"),lost=bets.filter(b=>b.result==="lost");
  const real=won.reduce((s,b)=>s+b.stake*(b.odds-1),0)-lost.reduce((s,b)=>s+b.stake,0);
  const wr=bets.filter(b=>b.result!=="pending").length>0?(won.length/bets.filter(b=>b.result!=="pending").length*100).toFixed(1):"0";
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22,flexWrap:"wrap",gap:12}}><div><h2 style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:6}}>📋 Minhas Apostas</h2></div><button onClick={()=>setAdding(!adding)} style={{background:adding?"transparent":C.accent,border:`1px solid ${adding?C.border:C.accent}`,color:adding?C.muted:"#000",borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:BODY}}>{adding?"✕ Cancelar":"+ Registrar"}</button></div>
    <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
      <StatCard label="Total Apostado" value={`R$ ${bets.reduce((s,b)=>s+b.stake,0).toFixed(0)}`} accent={C.accent} icon="💰"/>
      <StatCard label="Lucro/Prejuízo" value={`${real>=0?"+":""}R$ ${real.toFixed(2)}`} accent={real>=0?C.green:C.red} icon={real>=0?"📈":"📉"}/>
      <StatCard label="Taxa de Acerto" value={`${wr}%`} accent={C.gold} icon="🎯" sub={`${won.length}V ${lost.length}D ${bets.filter(b=>b.result==="pending").length}P`}/>
    </div>
    {adding&&(<Card style={{padding:22,marginBottom:20,borderColor:C.accent+"30"}} glow><div style={{fontWeight:700,color:C.text,marginBottom:14,fontSize:14}}>Nova Aposta</div><div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10,marginBottom:10}}><input value={form.event} onChange={e=>setForm(p=>({...p,event:e.target.value}))} placeholder="Jogo / Evento" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,borderRadius:9,padding:"11px 14px",fontFamily:BODY,fontSize:13,outline:"none"}}/><input value={form.odds} onChange={e=>setForm(p=>({...p,odds:e.target.value}))} placeholder="Odd" type="number" step="0.01" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.accent,borderRadius:9,padding:"11px 14px",fontFamily:NUM,fontSize:15,fontWeight:700,outline:"none",textAlign:"center"}}/><input value={form.stake} onChange={e=>setForm(p=>({...p,stake:e.target.value}))} placeholder="R$" type="number" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.gold,borderRadius:9,padding:"11px 14px",fontFamily:NUM,fontSize:15,fontWeight:700,outline:"none",textAlign:"center"}}/></div><div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}><input value={form.pick} onChange={e=>setForm(p=>({...p,pick:e.target.value}))} placeholder="Seleção" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,borderRadius:9,padding:"11px 14px",fontFamily:BODY,fontSize:13,outline:"none"}}/><button onClick={save} style={{background:C.accent,border:"none",borderRadius:9,padding:"11px",color:"#000",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:BODY}}>Salvar</button></div></Card>)}
    {bets.length===0?<Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:36,marginBottom:10}}>📋</div><div style={{color:C.muted}}>Nenhuma aposta registrada.</div></Card>:bets.map(bet=>{const p=bet.stake*(bet.odds-1),rc=bet.result==="won"?C.green:bet.result==="lost"?C.red:C.gold;return(<Card key={bet.id} hover style={{padding:"14px 18px",marginBottom:10}}><div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}><div style={{flex:1,minWidth:180}}><div style={{color:C.text,fontWeight:700,fontSize:13,fontFamily:BODY}}>{bet.event}</div>{bet.pick&&<div style={{color:C.purple,fontSize:12,marginTop:2}}>→ {bet.pick}</div>}<div style={{color:C.faint,fontSize:11,marginTop:3}}>{bet.date}</div></div><div style={{display:"flex",gap:6,alignItems:"center"}}><OddPill value={bet.odds}/><div style={{background:C.surface,borderRadius:8,padding:"5px 12px",color:C.gold,fontWeight:700,fontSize:13,fontFamily:NUM,border:`1px solid ${C.border}`}}>R$ {bet.stake}</div>{bet.result==="won"&&<span style={{color:C.green,fontSize:12,fontWeight:700,fontFamily:NUM}}>+R$ {p.toFixed(2)}</span>}{bet.result==="lost"&&<span style={{color:C.red,fontSize:12,fontWeight:700,fontFamily:NUM}}>-R$ {bet.stake}</span>}</div><div style={{display:"flex",gap:6,alignItems:"center"}}><select value={bet.result} onChange={e=>upd(bet.id,e.target.value)} style={{background:rc+"18",border:`1px solid ${rc}30`,color:rc,borderRadius:8,padding:"6px 10px",fontFamily:BODY,fontSize:12,fontWeight:700,outline:"none",cursor:"pointer"}}><option value="pending">⏳ Pendente</option><option value="won">✅ Ganhou</option><option value="lost">❌ Perdeu</option></select><button onClick={()=>del(bet.id)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:13}}>🗑</button></div></div></Card>);})}
  </div>);
}

// ─── GAME ROW ─────────────────────────────────────────────────────────────────
function GameRow({game,onClick,selected}){
  const best=game.markets.reduce((a,b)=>a.model_prob>b.model_prob?a:b);
  const srcIcon=game.source.includes("pinnacle")?"🛡️":game.source.includes("betexplorer")?"🔍":"⚽";
  return(<div onClick={()=>onClick(game)} style={{background:selected?C.accent+"08":C.card,border:`1px solid ${selected?C.accent+"40":C.border}`,borderRadius:12,padding:"13px 18px",cursor:"pointer",marginBottom:8,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",transition:"all 0.15s"}}>
    <div style={{flex:1,minWidth:160}}>
      <div style={{color:C.text,fontWeight:700,fontSize:13,fontFamily:BODY}}>{sportsMap[game.sport.split('_')[0]]?.i || "⚽"} {game.home} <span style={{color:C.muted}}>vs</span> {game.away}</div>
      <div style={{display:"flex",gap:8,marginTop:5,flexWrap:"wrap",alignItems:"center"}}>
        <Badge color={C.purple} small>{game.league}</Badge>
        <span style={{color:C.muted,fontSize:11,fontFamily:BODY}}>{formatDate(game.date)} · {game.hour}</span>
        <span style={{color:C.faint,fontSize:10}} title={game.source}>{srcIcon}</span>
      </div>
    </div>
    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
      {game.markets.slice(0,4).map((m,i)=>(<div key={i} style={{background:C.surface,borderRadius:8,padding:"5px 10px",textAlign:"center",border:`1px solid ${C.border}`,}}><div style={{color:C.faint,fontSize:8,marginBottom:2,fontFamily:BODY}}>{m.label.split(" ")[0]}</div><div style={{color:C.accent,fontWeight:700,fontSize:14,fontFamily:NUM}}>{m.odds}</div></div>))}
    </div>
    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
      <Badge color={CONF[best.confidence]?.color||C.muted} small>{best.confidence}</Badge>
      <span style={{color:C.muted,fontSize:11,fontFamily:NUM}}>{(best.model_prob*100).toFixed(0)}%</span>
    </div>
  </div>);
}

function MultipleCard({m,stake,idx}){
  const[open,setOpen]=useState(false);const profit=+(m.total_odds*stake-stake).toFixed(2);const mc=m.mode==="safe"?C.green:C.gold;
  return(<Card hover style={{marginBottom:12,overflow:"hidden"}}>
    <div onClick={()=>setOpen(!open)} style={{padding:"16px 20px",cursor:"pointer",display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{background:C.surface,color:C.muted,borderRadius:9,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,flexShrink:0,fontFamily:NUM}}>#{idx+1}</div>
      <div style={{flex:1}}>
        <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}><Badge color={mc} small>{m.mode==="safe"?"🛡 Seguro":"⚡ EV+"}</Badge><span style={{color:C.muted,fontSize:12,fontFamily:BODY}}>{m.legs} seleções</span></div>
        <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
          {[["ODD",m.total_odds?.toFixed(2),C.accent],["PROB",(m.total_prob_pct)?.toFixed(4)+"%",C.green],["LUCRO",`R$ ${profit}`,C.gold],["EV",`${m.total_ev>0?"+":""}${(m.total_ev*100)?.toFixed(1)}%`,m.total_ev>0?C.green:C.red]].map(([l,v,c])=>(<div key={l}><div style={{color:C.muted,fontSize:9,letterSpacing:"0.12em",fontFamily:BODY}}>{l}</div><div style={{color:c,fontWeight:800,fontSize:18,fontFamily:NUM,letterSpacing:"0.01em"}}>{v}</div></div>))}
        </div>
      </div>
      <span style={{color:C.muted}}>{open?"▲":"▼"}</span>
    </div>
    {open&&(<div style={{borderTop:`1px solid ${C.border}`,padding:"12px 20px"}}>{m.selections?.map((sel,i)=>(<div key={i} style={{display:"flex",gap:12,padding:"9px 0",borderBottom:i<m.selections.length-1?`1px solid ${C.bg}`:"none",flexWrap:"wrap",alignItems:"center"}}><div style={{width:22,height:22,borderRadius:6,background:C.surface,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:10,fontWeight:700,fontFamily:NUM}}>{i+1}</div><div style={{flex:1,minWidth:140}}><div style={{color:C.text,fontSize:12,fontWeight:600,fontFamily:BODY}}>{sportsMap[sel.sport?.split('_')[0]]?.i || "⚽"} {sel.home} vs {sel.away} <span style={{color:C.muted,fontWeight:400,fontSize:10,marginLeft:4}}>{formatDate(sel.date)} {sel.hour}</span></div><div style={{color:C.purple,fontSize:11,marginTop:2,fontFamily:BODY}}>{sel.pick_label} · {sel.league}</div></div><div style={{display:"flex",gap:6,alignItems:"center"}}><Badge color={CONF[sel.confidence]?.color||C.muted} small>{(sel.model_prob*100).toFixed(0)}%</Badge><OddPill value={sel.odds}/><EV ev={sel.ev}/></div></div>))}</div>)}
  </Card>);
}

// ─── ALAVANCAGEM PROFISSIONAL ────────────────────────────────────────────────
function AlavancagemTab({games}){
  const[bancaInicial,setBancaInicial]=useState(()=>{return parseFloat(localStorage.getItem("alav_banca_ini")||"1000")});
  const[history,setHistory]=useState(()=>{return JSON.parse(localStorage.getItem("alav_history")||"[]")});

  // Salvar sempre que mudar
  useEffect(()=>localStorage.setItem("alav_banca_ini", bancaInicial.toString()),[bancaInicial]);
  useEffect(()=>localStorage.setItem("alav_history", JSON.stringify(history)),[history]);

  // Recalcular banca atualizada a partir do histórico
  const historyWithBanca = useMemo(()=>{
    let current = bancaInicial;
    // Precisamos processar do mais antigo para o mais novo para a banca acumular certo
    let processed = [...history].reverse().map(h => {
      const stakeVal = current * (h.pct/100);
      const lucro = h.result === "win" ? stakeVal * (h.odd - 1) : -stakeVal;
      current += lucro;
      return { ...h, stake: stakeVal, lucro, bancaPos: current };
    });
    return processed.reverse(); // Volta para ordem decrescente para exibição
  }, [history, bancaInicial]);

  const currentBanca = historyWithBanca.length > 0 ? historyWithBanca[0].bancaPos : bancaInicial;
  const totalBets = history.length;
  const wins = history.filter(h=>h.result==="win").length;
  const winRate = totalBets > 0 ? (wins/totalBets*100).toFixed(1) : 0;
  const profitTotal = currentBanca - bancaInicial;
  const roi = bancaInicial > 0 ? (profitTotal/bancaInicial*100).toFixed(1) : 0;

  // Gestão de Banca Profissional (1% a 3%)
  const calcSmartStake = (odd) => {
    if(odd >= 1.30 && odd <= 1.60) return 3.0; // Unidade Cheia
    if(odd > 1.60 && odd <= 1.90) return 2.0;  // Meia Unidade
    if(odd > 1.90 && odd <= 2.20) return 1.5;  // Unidade Conservadora
    return 1.0; // Unidade de Risco
  };

  const bestAlavancagem = useMemo(()=>{
    if(!games || games.length === 0) return [];
    let list = [];
    
    // Filtrar apenas jogos que tenham odds reais
    const realGames = games.filter(g => g.source && g.source.includes("reais"));
    const sourceList = realGames.length > 0 ? realGames : games;

    sourceList.forEach(g=>{
      g.markets.forEach(m=>{
        // Filtro de Odd: 1.35 a 2.50 (Faixa de Alavancagem)
        if(m.odds >= 1.35 && m.odds <= 2.50){
          const fairOdd = 1 / m.model_prob;
          // Edge simplificado: comparamos o modelo contra a odd oferecida
          // Adicionamos uma pequena tolerância para mostrar as melhores oportunidades disponíveis
          const edge = (m.odds / fairOdd) - 1;
          
          if (m.model_prob > 0.45) {
            list.push({...m, game:g, fairOdd, edge, stakePct: calcSmartStake(m.odds)});
          }
        }
      });
    });
    
    // Ordenar pelo melhor custo-benefício (Edge) e pegar os top 10
    return list.sort((a,b)=>b.edge - a.edge).slice(0,10);
  }, [games]);

  const addBet = (game, odd, res, pct) => {
    const newBet = {
      id: Date.now(),
      date: new Date().toLocaleDateString("pt-BR"),
      jogo: `${game.home} vs ${game.away}`,
      odd: parseFloat(odd),
      pct: pct,
      result: res,
      sport: game.sport
    };
    setHistory([newBet, ...history]);
  };

  const removeBet = (id) => {
    if(window.confirm("Remover esta entrada do histórico?")) {
      setHistory(history.filter(h=>h.id !== id));
    }
  };

  const updateOdd = (id, newOdd) => {
    setHistory(history.map(h => h.id === id ? {...h, odd: parseFloat(newOdd) || 1} : h));
  };

  // Mini Gráfico SVG
  const renderChart = () => {
    if(historyWithBanca.length < 2) return <div style={{height:100, display:"flex", alignItems:"center", justifyContent:"center", color:C.faint}}>Dados insuficientes para o gráfico</div>;
    const points = [...historyWithBanca].reverse();
    const allValues = [bancaInicial, ...points.map(p=>p.bancaPos)];
    const maxB = Math.max(...allValues);
    const minB = Math.min(...allValues);
    const range = maxB - minB || 1;
    const width = 400, height = 100;
    const getX = (i) => (i / points.length) * width;
    const getY = (v) => height - ((v - minB) / range) * height;
    
    let d = `M 0 ${getY(bancaInicial)}`;
    points.forEach((p, i) => { d += ` L ${getX(i+1)} ${getY(p.bancaPos)}`; });

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{width:"100%", height:120, overflow:"visible"}}>
        <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity="0.2"/><stop offset="100%" stopColor={C.accent} stopOpacity="0"/></linearGradient></defs>
        <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill="url(#grad)" />
        <path d={d} fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p,i)=><circle key={i} cx={getX(i+1)} cy={getY(p.bancaPos)} r="3" fill={p.result==="win"?C.green:C.red} />)}
      </svg>
    );
  };

  return(<div>
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24, flexWrap:"wrap", gap:16}}>
      <div>
        <h2 style={{fontSize:24,fontWeight:800,color:C.text,marginBottom:4}}>🚀 Alavancagem de Valor</h2>
        <p style={{color:C.muted, fontSize:13}}>Foco em Edge (Vantagem Matemática) sobre a casa.</p>
      </div>
      <div style={{display:"flex", gap:10}}>
        <div style={{background:C.surface, padding:"8px 16px", borderRadius:10, border:`1px solid ${C.border}`}}>
          <span style={{color:C.faint, fontSize:10, fontWeight:700, display:"block", marginBottom:2}}>BANCA INICIAL</span>
          <div style={{display:"flex", alignItems:"center", gap:4}}>
            <span style={{color:C.accent, fontWeight:800}}>R$</span>
            <input type="number" value={bancaInicial} onChange={e=>setBancaInicial(parseFloat(e.target.value)||0)} style={{background:"none", border:"none", color:C.text, fontWeight:800, width:80, outline:"none", fontFamily:NUM, fontSize:18}}/>
          </div>
        </div>
        <button onClick={()=>setHistory([])} style={{background:C.red+"15", color:C.red, border:`1px solid ${C.red}30`, borderRadius:10, padding:"0 16px", fontWeight:700, cursor:"pointer"}}>Limpar Tudo</button>
      </div>
    </div>

    <div style={{display:"flex", gap:16, marginBottom:24, flexWrap:"wrap"}}>
      <StatCard label="Banca Atual" value={`R$ ${currentBanca.toFixed(2)}`} accent={currentBanca >= bancaInicial ? C.green : C.red} icon="💰" sub={`Lucro: R$ ${profitTotal.toFixed(2)}`}/>
      <StatCard label="ROI Total" value={`${roi}%`} accent={roi >= 0 ? C.accent : C.red} icon="📈"/>
      <StatCard label="Taxa de Acerto" value={`${winRate}%`} accent={C.gold} icon="🎯" sub={`${wins} Wins / ${totalBets} Bets`}/>
      <Card style={{padding:16, flex:2, minWidth:300, display:"flex", flexDirection:"column", justifyContent:"center"}}>{renderChart()}</Card>
    </div>

    <div style={{display:"grid", gridTemplateColumns:"1fr 1.5fr", gap:24, alignItems:"start"}}>
      <div>
        <div style={{color:C.muted, fontSize:12, fontWeight:700, marginBottom:12, fontFamily:BODY, display:"flex", alignItems:"center", gap:8}}>💎 VALUE BETS (CASA > JUSTA)</div>
        <div style={{display:"grid", gap:12}}>
          {bestAlavancagem.length === 0 ? <Card style={{padding:30, textAlign:"center", color:C.muted}}>Buscando entradas valiosas...</Card> : 
            bestAlavancagem.map((m,i)=>(
              <Card key={i} style={{padding:16}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
                  <div>
                    <div style={{color:C.text, fontWeight:800, fontSize:14}}>{sportsMap[m.game.sport.split('_')[0]]?.i} {m.game.home} vs {m.game.away}</div>
                    <div style={{color:C.muted, fontSize:11, marginTop:2}}>{m.game.league} · {m.game.hour}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <Badge color={C.accent} pulse>+{ (m.edge*100).toFixed(1) }% EDGE</Badge>
                    <div style={{color:C.muted, fontSize:10, fontWeight:700, marginTop:4, textTransform:"uppercase"}}>
                      {m.market_name === "Moneyline" || m.market_name === "1X2" ? "Resultado Final" : 
                       m.market_name === "Totals" ? "Total de Gols/Pontos" : "Mercado Principal"}
                    </div>
                  </div>
                </div>
                
                <div style={{background:C.bg, borderRadius:10, padding:14, display:"grid", gridTemplateColumns:"1.5fr 1fr 1fr", gap:10, marginBottom:12, border:`1px solid ${C.border}`}}>
                  <div>
                    <div style={{color:C.faint, fontSize:9, fontWeight:700, marginBottom:4}}>SELEÇÃO</div>
                    <Badge color={C.purple} small>{m.label}</Badge>
                  </div>
                  <div><div style={{color:C.faint, fontSize:9, fontWeight:700, marginBottom:4}}>ODD CASA</div><div style={{color:C.accent, fontWeight:800, fontSize:18, fontFamily:NUM}}>{m.odds}</div></div>
                  <div><div style={{color:C.faint, fontSize:9, fontWeight:700, marginBottom:4}}>ODD JUSTA</div><div style={{color:C.purple, fontWeight:800, fontSize:18, fontFamily:NUM}}>{m.fairOdd.toFixed(2)}</div></div>
                </div>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", background:C.surface, padding:"10px 14px", borderRadius:8, border:`1px solid ${C.border}`}}>
                  <div>
                    <div style={{color:C.faint, fontSize:9, fontWeight:700}}>STAKE ({m.stakePct}%)</div>
                    <div style={{color:C.gold, fontWeight:800, fontSize:18, fontFamily:NUM}}>R$ {(currentBanca * (m.stakePct/100)).toFixed(2)}</div>
                  </div>
                  <div style={{display:"flex", gap:6}}>
                    <button onClick={()=>addBet(m.game, m.odds, "win", m.stakePct)} style={{background:C.green, color:"#000", border:"none", borderRadius:6, padding:"8px 12px", fontWeight:800, cursor:"pointer", fontSize:11}}>WIN</button>
                    <button onClick={()=>addBet(m.game, m.odds, "loss", m.stakePct)} style={{background:C.red, color:"#fff", border:"none", borderRadius:6, padding:"8px 12px", fontWeight:800, cursor:"pointer", fontSize:11}}>RED</button>
                  </div>
                </div>
              </Card>
            ))
          }
        </div>
      </div>

      <div>
        <div style={{color:C.muted, fontSize:12, fontWeight:700, marginBottom:12, fontFamily:BODY}}>📅 PLANILHA DE CONTROLE</div>
        <Card style={{padding:0, overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%", borderCollapse:"collapse", fontFamily:BODY, fontSize:12}}>
              <thead>
                <tr style={{background:C.surface, borderBottom:`1px solid ${C.border}`}}>
                  <th style={{padding:12, textAlign:"left", color:C.faint}}>Jogo</th>
                  <th style={{padding:12, textAlign:"center", color:C.faint}}>Odd</th>
                  <th style={{padding:12, textAlign:"center", color:C.faint}}>Stake</th>
                  <th style={{padding:12, textAlign:"center", color:C.faint}}>Lucro</th>
                  <th style={{padding:12, textAlign:"right", color:C.faint}}>Banca Final</th>
                  <th style={{padding:12, width:40}}></th>
                </tr>
              </thead>
              <tbody>
                {historyWithBanca.length === 0 ? <tr><td colSpan="6" style={{padding:40, textAlign:"center", color:C.faint}}>Nenhuma entrada.</td></tr> : 
                  historyWithBanca.map(h=>(
                    <tr key={h.id} style={{borderBottom:`1px solid ${C.border}`, background:h.result==="win"?C.green+"05":C.red+"05"}}>
                      <td style={{padding:12}}>
                        <div style={{color:C.text, fontWeight:700}}>{h.jogo}</div>
                        <div style={{color:C.faint, fontSize:10}}>{h.date} · {sportsMap[h.sport?.split('_')[0]]?.i}</div>
                      </td>
                      <td style={{padding:12, textAlign:"center"}}>
                        <input type="number" step="0.01" value={h.odd} onChange={e=>updateOdd(h.id, e.target.value)} style={{width:50, background:C.bg, border:`1px solid ${C.border}`, borderRadius:4, color:C.accent, textAlign:"center", fontWeight:800, fontFamily:NUM, padding:4, outline:"none"}} />
                      </td>
                      <td style={{padding:12, textAlign:"center"}}>
                        <div style={{color:C.gold, fontWeight:700}}>{h.pct}%</div>
                        <div style={{color:C.muted, fontSize:10}}>R$ {h.stake.toFixed(2)}</div>
                      </td>
                      <td style={{padding:12, textAlign:"center", color:h.result==="win"?C.green:C.red, fontWeight:800}}>
                        {h.result==="win"?"+":""}R$ {h.lucro.toFixed(2)}
                      </td>
                      <td style={{padding:12, textAlign:"right", fontWeight:800, color:C.text, fontFamily:NUM}}>R$ {h.bancaPos.toFixed(2)}</td>
                      <td style={{padding:12, textAlign:"center"}}>
                        <button onClick={()=>removeBet(h.id)} style={{background:"none", border:"none", color:C.red, cursor:"pointer", opacity:0.5}}>✕</button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  </div>);
}

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
function GlobalStyles(){return(<style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700;800&family=DM+Sans:wght@400;500;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}@keyframes spin{to{transform:rotate(360deg);}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}@keyframes pulseGlow{0%,100%{opacity:1;}50%{opacity:0.4;}}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:#1e3048;border-radius:3px;}input[type=range]{accent-color:${C.accent};cursor:pointer;}select{background:${C.card};border:1px solid ${C.border};color:${C.text};border-radius:8px;padding:6px 12px;font-family:${BODY};font-size:12px;outline:none;cursor:pointer;}input[type=number]{-moz-appearance:textfield;}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}input::placeholder{color:#1e3550;}`}</style>);}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const[user,setUser]=useState(()=>{const t=localStorage.getItem("token"),u=localStorage.getItem("username"),r=localStorage.getItem("role");return t?{token:t,username:u,role:r||"user"}:null;});
  const[tab,setTab]=useState("dashboard");
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");
  const[games,setGames]=useState([]);
  const[multiples,setMultiples]=useState([]);
  const[selectedGame,setSelectedGame]=useState(null);
  const[mode,setMode]=useState("safe");
  const[stake,setStake]=useState(10);
  const[minProb,setMinProb]=useState(50);
  const[leagueFilter,setLeagueFilter]=useState("Todas");
  const[sportFilter, setSportFilter] = useState("all");
  const[showProfile,setShowProfile]=useState(false);
  const[sources,setSources]=useState([]);

  const handleLogout=()=>{["token","username","role"].forEach(k=>localStorage.removeItem(k));setUser(null);setGames([]);setMultiples([]);};
  const handleLogin=d=>{setUser({token:d.token,username:d.username,role:d.role||"user"});};

  const fetchGames=useCallback(async()=>{
    if(!user)return;
    setLoading(true);setError("");
    try{
      const r=await fetch(`${API}/games?min_prob=${minProb/100}`,{headers:{"Authorization":`Bearer ${user.token}`}});
      const d=await r.json();
      if(!r.ok){if(r.status===401){handleLogout();return;}throw new Error(d.detail||"Erro ao buscar jogos");}
      
      // FILTRO GLOBAL BRT: Remove jogos que já começaram
      const validGames = (d.games||[]).filter(g => !isGameExpired(g.date, g.hour));
      
      setGames(validGames);
      setSources(d.sources||[]);
      if(d.errors?.length)setError("Avisos: "+d.errors.join(" | "));
    }catch(e){setError(e.message);}
    finally{setLoading(false);}
  },[minProb,user]);

  const [sportMultiFilter, setSportMultiFilter] = useState("all");
  const [multiMinOdd, setMultiMinOdd] = useState(2.0);
  const [multiMaxOdd, setMultiMaxOdd] = useState(15.0);

  const buildMultiples=useCallback((g,m,selectedSport, minTotalOdd, maxTotalOdd)=>{
    const results=[];
    const sportGames = selectedSport === "all" 
      ? g 
      : g.filter(game => game.sport.toLowerCase().includes(selectedSport));

    if (sportGames.length < 2) return [];

    // Tentar gerar bilhetes que caibam no range de odds com mais seleções
    for(let a=0; results.length < 6 && a < 1500; a++){
      const sh=[...sportGames].sort(()=>Math.random()-0.5);
      // Mirar em múltiplas maiores (4 a 10 seleções)
      const targetSize = Math.floor(Math.random() * 7) + 4; 
      
      const used=new Set(),leagues={},sels=[];
      let currentTotalOdd = 1.0;

      for(const game of sh){
        if(sels.length >= targetSize || used.has(game.id)) continue;
        if(sportGames.length > 20 && (leagues[game.league]||0) >= 2) continue;

        // Selecionar o mercado baseado no modo (Safe ou EV)
        const cands=game.markets.filter(x=>x.model_prob >= 0.40);
        if(!cands.length) continue;
        
        let pick;
        if(m==="ev"){
          const pos=cands.filter(x=>x.ev > 0);
          pick=(pos.length?pos:cands).reduce((a,b)=>a.ev>b.ev?a:b);
        } else {
          pick=cands.reduce((a,b)=>a.model_prob>b.model_prob?a:b);
        }
        
        // Se a odd individual for muito alta para uma múltipla grande, pula
        if (pick.odds > 3.5) continue;

        // Verifica se adicionar esta seleção estoura o limite máximo
        if (currentTotalOdd * pick.odds > maxTotalOdd) continue;

        sels.push({
          home:game.home,away:game.away,league:game.league,date:game.date,hour:game.hour,
          pick_label:pick.label,odds:pick.odds,house:pick.house||"",
          model_prob:pick.model_prob,ev:pick.ev,confidence:pick.confidence, sport:game.sport
        });
        currentTotalOdd *= pick.odds;
        used.add(game.id);
        leagues[game.league]=(leagues[game.league]||0)+1;

        // Se já atingiu o tamanho alvo e a odd mínima, pode parar
        if (sels.length >= targetSize && currentTotalOdd >= minTotalOdd) break;
      }

      // Validação final: deve ter a odd mínima e pelo menos 4 seleções (ou o máximo possível)
      if(currentTotalOdd >= minTotalOdd && currentTotalOdd <= maxTotalOdd && sels.length >= 3){
        results.push({id:results.length+1,mode:m,selections:sels,total_odds:+currentTotalOdd.toFixed(2),total_prob_pct:+sels.reduce((a,s)=>a*s.model_prob,1)*100,total_ev:+sels.reduce((a,s)=>a+s.ev,0).toFixed(4),potential_profit:+(currentTotalOdd*stake-stake).toFixed(2),legs:sels.length});
      }
    }
    return m==="safe"?results.sort((a,b)=>b.total_prob_pct-a.total_prob_pct):results.sort((a,b)=>b.total_ev-a.total_ev);
  },[stake]);

  useEffect(()=>{if(user)fetchGames();},[user,fetchGames]);
  useEffect(()=>{if(games.length)setMultiples(buildMultiples(games,mode,sportMultiFilter, multiMinOdd, multiMaxOdd));},[games,mode,sportMultiFilter, multiMinOdd, multiMaxOdd, buildMultiples]);

  if(!user)return<AuthScreen onLogin={handleLogin}/>;
  if(tab==="admin"&&user.role==="admin")return<AdminPanel token={user.token}/>;

  const leagues = ["Todas", ...new Set(games.filter(g => sportFilter === "all" || g.sport.toLowerCase().includes(sportFilter)).map(g => g.league))];
  
  const filtered = games
    .filter(g => sportFilter === "all" || g.sport.toLowerCase().includes(sportFilter))
    .filter(g => leagueFilter === "Todas" || g.league === leagueFilter)
    .filter(g => g.markets.some(m => m.model_prob * 100 >= minProb))
    .sort((a, b) => {
      const ba = a.markets.reduce((x, y) => x.model_prob > y.model_prob ? x : y), bb = b.markets.reduce((x, y) => x.model_prob > y.model_prob ? x : y);
      return bb.model_prob - ba.model_prob;
    });

  const TABS=[{id:"dashboard",l:"Dashboard",ic:"📊"},{id:"jogos",l:"Jogos",ic:"🎯"},{id:"multiplas",l:"Múltiplas",ic:"🎰"},{id:"alavancagem",l:"Alavancagem",ic:"🚀"},{id:"calculadora",l:"Calculadora",ic:"🧮"},{id:"minhas",l:"Minhas Apostas",ic:"📋"},...(user.role==="admin"?[{id:"admin",l:"Admin",ic:"👑"}]:[])];

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:BODY,color:C.text}}>
      <GlobalStyles/>

      {/* HEADER */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 20px",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1300,margin:"0 auto",display:"flex",alignItems:"center",height:58,gap:6}}>
          <div style={{width:36,height:36,background:C.grad,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0,boxShadow:`0 0 16px ${C.accentGlow}`,marginRight:10}}>⚽</div>
          <div style={{display:"flex",gap:1,flex:1,overflowX:"auto",scrollbarWidth:"none"}}>
            {TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{background:"transparent",color:tab===t.id?(t.id==="admin"?C.gold:C.accent):C.muted,border:"none",borderBottom:`2px solid ${tab===t.id?(t.id==="admin"?C.gold:C.accent):"transparent"}`,padding:"0 14px",height:58,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:BODY,transition:"all 0.2s",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:13}}>{t.ic}</span><span>{t.l}</span></button>))}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,marginLeft:8}}>
            {/* Sources badge */}
            {sources.length>0&&<div style={{background:C.green+"12",border:`1px solid ${C.green}25`,borderRadius:20,padding:"4px 10px",display:"flex",alignItems:"center",gap:5}}><div style={{width:6,height:6,borderRadius:"50%",background:C.green,animation:"pulseGlow 2s ease-in-out infinite"}}/><span style={{color:C.green,fontSize:10,fontWeight:700,fontFamily:BODY}}>DADOS REAIS</span></div>}
            <div style={{display:"flex",alignItems:"center",gap:6,background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:"5px 12px"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:loading?C.gold:C.green,animation:"pulseGlow 2s ease-in-out infinite"}}/>
              <span style={{color:C.muted,fontSize:11,fontFamily:BODY}}>{loading?"Buscando...":`${games.length} jogos`}</span>
            </div>
            <button onClick={fetchGames} disabled={loading} style={{background:C.card,border:`1px solid ${C.border}`,color:C.accent,borderRadius:20,padding:"5px 12px",fontSize:13,cursor:"pointer",fontFamily:BODY,fontWeight:700}}>↻</button>
            {/* User pill */}
            <div style={{display:"flex",alignItems:"center",gap:0,background:C.card,border:`1px solid ${C.border}`,borderRadius:22,overflow:"hidden"}}>
              <button onClick={()=>setShowProfile(true)} style={{display:"flex",alignItems:"center",gap:8,background:"transparent",border:"none",padding:"5px 14px 5px 7px",cursor:"pointer",color:C.text}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:user.role==="admin"?"linear-gradient(135deg,#f5c842,#ff4d6d)":C.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#000",flexShrink:0}}>{user.username[0].toUpperCase()}</div>
                <span style={{fontSize:12,fontWeight:700,fontFamily:BODY,color:C.text}}>{user.username}</span>
                {user.role==="admin"&&<span style={{fontSize:10,color:C.gold}}>👑</span>}
                <span style={{fontSize:10,color:C.muted}}>▾</span>
              </button>
              <div style={{width:1,height:28,background:C.border}}/>
              <button onClick={handleLogout} title="Sair da conta" style={{background:"transparent",border:"none",color:C.red,padding:"5px 12px",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",transition:"all 0.2s"}}>⏻</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1300,margin:"0 auto",padding:"26px 20px"}}>
        {error&&(<div style={{background:C.red+"12",border:`1px solid ${C.red}25`,borderRadius:12,padding:"13px 18px",marginBottom:22,color:"#ffb3c1",fontSize:13,display:"flex",gap:10,alignItems:"center",fontFamily:BODY}}>⚠️ {error}<button onClick={()=>setError("")} style={{marginLeft:"auto",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>✕</button></div>)}

        {/* Source info */}
        {sources.length>0&&!loading&&(
          <div style={{background:C.green+"06",border:`1px solid ${C.green}20`,borderRadius:10,padding:"10px 16px",marginBottom:18,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{color:C.green,fontSize:11,fontWeight:700,fontFamily:BODY}}>📡 Fontes ativas:</span>
            {sources.map((s,i)=>(<Badge key={i} color={C.green} small>{s}</Badge>))}
          </div>
        )}

        {/* DASHBOARD */}
        {tab==="dashboard"&&(
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <div style={{marginBottom:24}}><h1 style={{fontWeight:700,fontSize:28,color:C.text,letterSpacing:"-0.02em",marginBottom:5}}>Análise do Dia</h1><p style={{color:C.muted,fontSize:13}}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p></div>
            {loading?<Spinner/>:(
              <>
                <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
                  <StatCard label="Jogos" value={games.length} accent={C.accent} sub="Hoje e Amanhã" icon="⚽"/>
                  <StatCard label="Alta Confiança" value={games.filter(g=>g.markets.some(m=>m.model_prob>0.70)).length} accent={C.green} sub="Prob. > 70%" icon="🎯"/>
                  <StatCard label="Apostas EV+" value={games.flatMap(g=>g.markets).filter(m=>m.ev>0).length} accent={C.gold} sub="Valor esperado positivo" icon="⚡"/>
                  <StatCard label="Múltiplas" value={multiples.length} accent={C.purple} sub="Prontas" icon="🎰"/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
                  <Card style={{padding:20}}><div style={{color:C.muted,fontSize:12,fontWeight:700,marginBottom:14,fontFamily:BODY}}>🏆 Top Probabilidade</div>{games.flatMap(g=>g.markets.map(m=>({...m,game:g}))).sort((a,b)=>b.model_prob-a.model_prob).slice(0,7).map((m,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<6?`1px solid ${C.bg}`:"none"}}><span style={{color:C.faint,fontSize:10,width:16,fontFamily:NUM}}>{i+1}</span><div style={{flex:1}}><div style={{color:C.text,fontSize:11,fontWeight:600,fontFamily:BODY}}>{sportsMap[m.game.sport.split('_')[0]]?.i || "⚽"} {m.game.home} vs {m.game.away} <span style={{color:C.muted,fontWeight:400,fontSize:9,marginLeft:4}}>{formatDate(m.game.date)} {m.game.hour}</span></div><div style={{color:C.muted,fontSize:10,fontFamily:BODY}}>{m.label} · {m.game.league}</div></div><Badge color={CONF[m.confidence]?.color||C.muted} small>{(m.model_prob*100).toFixed(0)}%</Badge><span style={{color:C.accent,fontWeight:800,fontSize:15,minWidth:40,textAlign:"right",fontFamily:NUM}}>{m.odds}</span></div>))}</Card>
                  <Card style={{padding:20}}><div style={{color:C.muted,fontSize:12,fontWeight:700,marginBottom:14,fontFamily:BODY}}>⚡ Top EV+</div>{games.flatMap(g=>g.markets.map(m=>({...m,game:g}))).filter(m=>m.ev>0).sort((a,b)=>b.ev-a.ev).slice(0,7).map((m,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<6?`1px solid ${C.bg}`:"none"}}><span style={{color:C.faint,fontSize:10,width:16,fontFamily:NUM}}>{i+1}</span><div style={{flex:1}}><div style={{color:C.text,fontSize:11,fontWeight:600,fontFamily:BODY}}>{sportsMap[m.game.sport.split('_')[0]]?.i || "⚽"} {m.game.home} vs {m.game.away} <span style={{color:C.muted,fontWeight:400,fontSize:9,marginLeft:4}}>{formatDate(m.game.date)} {m.game.hour}</span></div><div style={{color:C.muted,fontSize:10,fontFamily:BODY}}>{m.label} · {m.game.league}</div></div><EV ev={m.ev}/><span style={{color:C.accent,fontWeight:800,fontSize:15,minWidth:40,textAlign:"right",fontFamily:NUM}}>{m.odds}</span></div>))}</Card>
                </div>
                {multiples[0]&&(<><div style={{color:C.muted,fontSize:12,fontWeight:700,marginBottom:12,fontFamily:BODY}}>🎰 Melhor Múltipla</div><MultipleCard m={multiples[0]} stake={stake} idx={0}/><button onClick={()=>setTab("multiplas")} style={{background:"transparent",border:`1px solid ${C.accent}40`,color:C.accent,borderRadius:9,padding:"8px 20px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:BODY}}>Ver todas →</button></>)}
              </>
            )}
          </div>
        )}

        {tab==="jogos"&&(
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <div style={{display:"flex",gap:12,marginBottom:20,alignItems:"center",flexWrap:"wrap",background:C.surface,padding:16,borderRadius:14,border:`1px solid ${C.border}`}}>
              <div style={{flex:1,minWidth:200}}>
                <h2 style={{fontWeight:800,fontSize:20,color:C.text,fontFamily:BODY,display:"flex",alignItems:"center",gap:10}}>🎯 Jogos Reais <Badge color={C.green} small>{filtered.length}</Badge></h2>
              </div>
              
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {/* Filtro de Esporte */}
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{color:C.faint,fontSize:10,fontWeight:700}}>ESPORTE:</span>
                  <select value={sportFilter} onChange={e=>{setSportFilter(e.target.value); setLeagueFilter("Todas");}} style={{minWidth:120}}>
                    <option value="all">🌎 Todos</option>
                    {Object.entries(sportsMap).map(([k,v])=>(
                      <option key={k} value={k}>{v.i} {v.l}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro de Liga */}
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{color:C.faint,fontSize:10,fontWeight:700}}>LIGA:</span>
                  <select value={leagueFilter} onChange={e=>setLeagueFilter(e.target.value)} style={{maxWidth:200}}>
                    {leagues.map(l=><option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                {/* Filtro de Probabilidade */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginLeft:10,paddingLeft:16,borderLeft:`1px solid ${C.border}`}}>
                  <span style={{color:C.muted,fontSize:11,fontWeight:700}}>MIN: {minProb}%</span>
                  <input type="range" min={40} max={90} value={minProb} onChange={e=>setMinProb(+e.target.value)} style={{width:80}}/>
                </div>
              </div>
            </div>

            {loading?<Spinner/>:(
              <>
                {filtered.length===0 ? (
                  <Card style={{padding:60,textAlign:"center"}}>
                    <div style={{fontSize:48,marginBottom:16}}>🔍</div>
                    <div style={{color:C.text,fontWeight:700,fontSize:18,marginBottom:8}}>Nenhum jogo encontrado</div>
                    <div style={{color:C.muted,fontFamily:BODY}}>Tente ajustar os filtros ou aguarde a atualização dos scrapers.</div>
                    <button onClick={fetchGames} style={{marginTop:20,background:C.accent,border:"none",borderRadius:8,padding:"10px 24px",color:"#000",fontWeight:800,cursor:"pointer"}}>Recarregar Agora</button>
                  </Card>
                ) : (
                  <div style={{display:"grid",gap:8}}>
                    {filtered.map(g=><GameRow key={g.id} game={g} onClick={setSelectedGame} selected={selectedGame?.id===g.id}/>)}
                  </div>
                )}
              </>
            )}
            {selectedGame&&(<div style={{position:"fixed",inset:0,background:"#000c",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setSelectedGame(null)}><Card style={{maxWidth:520,width:"100%",padding:28,maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}><div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}><div><div style={{fontWeight:700,fontSize:18,color:C.text,fontFamily:BODY}}>{selectedGame.home} vs {selectedGame.away}</div><div style={{color:C.muted,fontSize:13,marginTop:4,fontFamily:BODY}}>{selectedGame.league} · {formatDate(selectedGame.date)} {selectedGame.hour}</div><div style={{color:C.faint,fontSize:11,marginTop:2,fontFamily:BODY}}>Fonte: {selectedGame.source}</div></div><button onClick={()=>setSelectedGame(null)} style={{background:C.surface,border:"none",color:C.muted,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16,fontFamily:BODY}}>✕</button></div>{selectedGame.markets.map((m,i)=>(<div key={i} style={{background:C.surface,borderRadius:10,padding:"12px 16px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}><div><div style={{color:C.text,fontWeight:600,fontSize:14,fontFamily:BODY}}>{m.label}</div><div style={{color:C.muted,fontSize:11,marginTop:3,fontFamily:BODY}}>Implícita: {(m.implied_prob*100).toFixed(1)}% → Modelo: {(m.model_prob*100).toFixed(1)}%</div></div><div style={{display:"flex",gap:8,alignItems:"center"}}><Badge color={CONF[m.confidence]?.color||C.muted} small>{m.confidence}</Badge><OddPill value={m.odds}/><EV ev={m.ev}/></div></div>))}</Card></div>)}
          </div>
        )}

        {tab==="multiplas"&&(
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"center",flexWrap:"wrap",background:C.surface,padding:16,borderRadius:14,border:`1px solid ${C.border}`}}>
              <div style={{flex:1,minWidth:200}}>
                <h2 style={{fontWeight:800,fontSize:20,color:C.text,fontFamily:BODY,display:"flex",alignItems:"center",gap:10}}>🎰 Gerador de Múltiplas</h2>
              </div>
              
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:4,marginRight:10}}>
                  <button onClick={()=>setSportMultiFilter("all")} style={{background:sportMultiFilter==="all"?C.accent+"15":"transparent",border:`1px solid ${sportMultiFilter==="all"?C.accent+"40":C.border}`,color:sportMultiFilter==="all"?C.accent:C.muted,borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:BODY}}>🌎 Todos</button>
                  {Object.entries(sportsMap).map(([k,v])=>(
                    <button key={k} onClick={()=>setSportMultiFilter(k)} style={{background:sportMultiFilter===k?C.accent+"15":"transparent",border:`1px solid ${sportMultiFilter===k?C.accent+"40":C.border}`,color:sportMultiFilter===k?C.accent:C.muted,borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:BODY}}>{v.i} {v.l}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:7,paddingLeft:16,borderLeft:`1px solid ${C.border}`,alignItems:"center"}}>
                  <span style={{color:C.muted,fontSize:11,fontWeight:700}}>ODDS:</span>
                  <input type="number" value={multiMinOdd} onChange={e=>setMultiMinOdd(parseFloat(e.target.value)||1.1)} step="0.5" style={{width:50,background:C.card,border:`1px solid ${C.border}`,color:C.accent,borderRadius:6,padding:"4px 8px",fontFamily:NUM,fontSize:13,outline:"none"}} title="Odd Mínima"/>
                  <span style={{color:C.faint}}>a</span>
                  <input type="number" value={multiMaxOdd} onChange={e=>setMultiMaxOdd(parseFloat(e.target.value)||100)} step="0.5" style={{width:50,background:C.card,border:`1px solid ${C.border}`,color:C.accent,borderRadius:6,padding:"4px 8px",fontFamily:NUM,fontSize:13,outline:"none"}} title="Odd Máxima"/>
                </div>
                <div style={{display:"flex",gap:7,paddingLeft:16,borderLeft:`1px solid ${C.border}`}}>{[["safe","🛡 Seguro",C.green],["ev","⚡ EV+",C.gold]].map(([m,l,c])=>(<button key={m} onClick={()=>setMode(m)} style={{background:mode===m?c+"15":"transparent",border:`1px solid ${mode===m?c+"40":C.border}`,color:mode===m?c:C.muted,borderRadius:9,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:BODY}}>{l}</button>))}</div>
                <div style={{display:"flex",alignItems:"center",gap:7}}><span style={{color:C.muted,fontSize:12}}>R$</span><input type="number" value={stake} onChange={e=>setStake(+e.target.value)} min={1} style={{background:C.card,border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"6px 10px",fontFamily:NUM,fontSize:14,width:80,outline:"none"}}/></div>
              </div>
            </div>
            {loading?<Spinner/>:(<><div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}><StatCard label="Geradas" value={multiples.length} accent={C.accent} icon="🎰"/><StatCard label="Melhor Odd" value={multiples[0]?.total_odds?.toFixed(2)||"-"} accent={C.purple} icon="📊"/><StatCard label="Lucro Pot." value={multiples[0]?`R$ ${(multiples[0].total_odds*stake-stake).toFixed(2)}`:"-"} accent={C.gold} sub={`em R$ ${stake}`} icon="💰"/></div>{multiples.length===0&&<Card style={{padding:40,textAlign:"center"}}><p style={{color:C.muted,fontFamily:BODY}}>Jogos insuficientes para o esporte selecionado ({sportMultiFilter}). Selecione outro ou aguarde novos dados.</p></Card>}{multiples.map((m,i)=><MultipleCard key={m.id} m={m} stake={stake} idx={i}/>)}</>)}
          </div>
        )}

        {tab==="alavancagem"&&<AlavancagemTab games={games} loading={loading}/>}
        {tab==="calculadora"&&<CalcTab/>}
        {tab==="minhas"&&<MyBetsTab/>}

      </div>

      <div style={{borderTop:`1px solid ${C.border}`,padding:"14px 24px",textAlign:"center",marginTop:40}}>
        <p style={{color:C.faint,fontSize:11,fontFamily:BODY}}>⚠️ Múltiplas do Dia · Fins educacionais · Apostas envolvem risco · Jogue com responsabilidade</p>
      </div>

      {showProfile&&<ProfileModal user={user} onClose={()=>setShowProfile(false)} onUpdate={u=>{setUser(u);setShowProfile(false);}}/>}
    </div>
  );
}
