from fastapi import FastAPI, HTTPException, Query, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import Optional
import os, json, asyncio, random
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt

from .probability import remove_vig, calc_ev, model_probability
from .generator import generate_multiples
from .scraper import fetch_real_games, fetch_all_pinnacle, fetch_betexplorer_all, deduplicate_games

SECRET_KEY = os.getenv("SECRET_KEY", "multiplas_secret_2025")
ALGORITHM  = "HS256"
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

app = FastAPI(title="Múltiplas do Dia API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

USERS_FILE = "users.json"

def load_users():
    if not os.path.exists(USERS_FILE): return {}
    try:
        with open(USERS_FILE) as f: return json.load(f)
    except: return {}

def save_users(u):
    with open(USERS_FILE, "w") as f: json.dump(u, f, indent=2)

def ensure_admin():
    users = load_users()
    if "admin" not in users:
        users["admin"] = {
            "username": "admin", "password": pwd_context.hash("admin123"),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(), "active": True,
        }
        save_users(users)

ensure_admin()

class UserAuth(BaseModel):
    username: str
    password: str

def create_token(data):
    p = {**data, "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(p, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(authorization: Optional[str] = Header(None), token: Optional[str] = Query(None)):
    t = None
    if authorization:
        try:
            t = authorization.split(" ")[1]
        except:
            pass
    elif token:
        t = token
        
    if not t: raise HTTPException(401, "Não autorizado")
    
    try:
        payload = jwt.decode(t, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        users = load_users()
        if username not in users: raise HTTPException(401, "Usuário não existe")
        u = users[username]
        if not u.get("active", True): raise HTTPException(403, "Conta desativada")
        return u
    except HTTPException: raise
    except Exception: raise HTTPException(401, "Token inválido")

async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin": raise HTTPException(403, "Apenas administradores")
    return user

@app.post("/api/register")
async def register(user: UserAuth):
    users = load_users()
    if user.username in users: raise HTTPException(400, "Usuário já existe")
    if user.username.lower() == "admin": raise HTTPException(400, "Nome reservado")
    users[user.username] = {
        "username": user.username, "password": pwd_context.hash(user.password),
        "role": "user", "created_at": datetime.now(timezone.utc).isoformat(), "active": True,
    }
    save_users(users)
    return {"message": "Registrado com sucesso"}

@app.post("/api/login")
async def login(user: UserAuth):
    users = load_users()
    db = users.get(user.username)
    if not db or not pwd_context.verify(user.password, db["password"]):
        raise HTTPException(401, "Usuário ou senha incorretos")
    if not db.get("active", True): raise HTTPException(403, "Conta desativada")
    token = create_token({"sub": user.username, "role": db.get("role","user")})
    return {"token": token, "username": user.username, "role": db.get("role","user")}

@app.get("/api/me")
async def me(user=Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password"}

@app.put("/api/me")
async def update_me(body: dict, user=Depends(get_current_user)):
    users = load_users()
    u = users[user["username"]]
    if body.get("new_password"): u["password"] = pwd_context.hash(body["new_password"])
    save_users(users)
    return {"message": "Perfil atualizado"}

@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0", "timestamp": datetime.now(timezone.utc).isoformat()}

from fastapi.responses import StreamingResponse

@app.get("/api/games/stream")
async def get_games_stream(min_prob: float = Query(0.50, ge=0.0, le=1.0), user=Depends(get_current_user)):
    async def event_generator():
        print(f"DEBUG: Iniciando stream para usuário {user['username']}")
        yield ": keep-alive\n\n"
        
        brt = timezone(timedelta(hours=-3))
        today = datetime.now(timezone.utc).astimezone(brt).strftime("%Y-%m-%d")
        tomorrow = (datetime.now(timezone.utc).astimezone(brt) + timedelta(days=1)).strftime("%Y-%m-%d")
        
        all_games = []
        event_queue = asyncio.Queue()
        
        async def progress_cb(p, m):
            print(f"DEBUG PROGRESS: {p}% - {m}")
            event_queue.put_nowait((p, m))

        yield f"data: {json.dumps({'progress': 5, 'message': 'Conexão estabelecida...'})}\n\n"

        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            try:
                # 1. PINNACLE
                yield f"data: {json.dumps({'progress': 10, 'message': 'Iniciando Pinnacle...'})}\n\n"
                
                fetch_task = asyncio.create_task(fetch_all_pinnacle(client, today, tomorrow, progress_callback=progress_cb))
                
                while not fetch_task.done() or not event_queue.empty():
                    try:
                        while not event_queue.empty():
                            p, m = event_queue.get_nowait()
                            yield f"data: {json.dumps({'progress': p, 'message': m})}\n\n"
                        
                        if fetch_task.done(): break
                        
                        # Pequeno delay ou heartbeat se demorar muito
                        await asyncio.sleep(0.1)
                        if random.random() < 0.05: # Heartbeat aleatório a cada ~2 segundos
                            yield ": heartbeat\n\n"
                            
                    except Exception: break
                
                all_games.extend(await fetch_task)

                # 2. BETEXPLORER
                yield f"data: {json.dumps({'progress': 45, 'message': 'Iniciando BetExplorer...'})}\n\n"
                
                fetch_task = asyncio.create_task(fetch_betexplorer_all(client, today, tomorrow, progress_callback=progress_cb))
                
                while not fetch_task.done() or not event_queue.empty():
                    try:
                        while not event_queue.empty():
                            p, m = event_queue.get_nowait()
                            yield f"data: {json.dumps({'progress': p, 'message': m})}\n\n"
                        
                        if fetch_task.done(): break
                        await asyncio.sleep(0.1)
                        if random.random() < 0.05:
                            yield ": heartbeat\n\n"
                    except Exception: break

                all_games.extend(await fetch_task)

            except Exception as e:
                print(f"DEBUG ERROR STREAM: {str(e)}")
                yield f"data: {json.dumps({'progress': 80, 'message': f'Aviso: {str(e)}'})}\n\n"

        # 3. DEDUPLICAÇÃO E FINALIZAÇÃO
        yield f"data: {json.dumps({'progress': 90, 'message': 'Deduplicando resultados...'})}\n\n"
        final_games = deduplicate_games(all_games)
        if min_prob > 0:
            final_games = [g for g in final_games if any(m.get("model_prob", 0) >= min_prob for m in g.get("markets", []))]
            
        print(f"DEBUG: Stream finalizado com {len(final_games)} jogos")
        yield f"data: {json.dumps({'progress': 100, 'message': 'Finalizado!', 'games': final_games, 'count': len(final_games)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    })

@app.get("/api/games")
async def get_games(min_prob: float = Query(0.50, ge=0.0, le=1.0), sport: Optional[str] = None, user=Depends(get_current_user)):
    result = await fetch_real_games(min_prob=min_prob)
    games = result["games"]
    if sport: games = [g for g in games if g["sport"] == sport]
    return {"games": games, "count": len(games), "sources": result["sources"], "errors": result.get("errors",[]), "fetched_at": result["fetched_at"]}

@app.get("/api/multiples")
async def get_multiples(mode: str = Query("safe", pattern="^(safe|ev)$"), size_min: int = Query(8,ge=4,le=20), size_max: int = Query(14,ge=4,le=20), count: int = Query(6,ge=1,le=20), stake: float = Query(10.0,ge=1.0), min_prob: float = Query(0.50,ge=0.0,le=1.0), user=Depends(get_current_user)):
    r = await get_games(min_prob=min_prob, user=user)
    if len(r["games"]) < size_min: raise HTTPException(400, f"Apenas {len(r['games'])} jogos. Mínimo: {size_min}.")
    m = generate_multiples(r["games"], mode=mode, size_min=size_min, size_max=size_max, count=count, stake=stake)
    return {"multiples": m, "mode": mode, "generated_at": datetime.now(timezone.utc).isoformat()}

# ─── ADMIN ────────────────────────────────────────────────────────────────────
@app.get("/api/admin/users")
async def admin_list(admin=Depends(require_admin)):
    users = load_users()
    return {"users": [{k:v for k,v in u.items() if k!="password"} for u in users.values()], "total": len(users)}

@app.get("/api/admin/stats")
async def admin_stats(admin=Depends(require_admin)):
    users = load_users()
    return {"total_users": len(users), "active_users": sum(1 for u in users.values() if u.get("active",True)), "admin_users": sum(1 for u in users.values() if u.get("role")=="admin"), "server_time": datetime.now(timezone.utc).isoformat(), "version": "2.0.0"}

@app.post("/api/admin/users")
async def admin_create(body: dict, admin=Depends(require_admin)):
    users = load_users()
    un = body.get("username","").strip()
    pw = body.get("password","")
    if not un or not pw: raise HTTPException(400, "Username e password obrigatórios")
    if un in users: raise HTTPException(400, "Usuário já existe")
    users[un] = {"username":un,"password":pwd_context.hash(pw),"role":body.get("role","user"),"created_at":datetime.now(timezone.utc).isoformat(),"active":True}
    save_users(users)
    return {"message": f"Usuário {un} criado"}

@app.put("/api/admin/users/{username}/role")
async def admin_role(username: str, body: dict, admin=Depends(require_admin)):
    users = load_users()
    if username not in users: raise HTTPException(404,"Não encontrado")
    if username=="admin" and body.get("role")!="admin": raise HTTPException(400,"Não pode rebaixar admin principal")
    users[username]["role"] = body.get("role","user")
    save_users(users)
    return {"message": "Role atualizado"}

@app.put("/api/admin/users/{username}/active")
async def admin_toggle(username: str, body: dict, admin=Depends(require_admin)):
    users = load_users()
    if username not in users: raise HTTPException(404,"Não encontrado")
    if username=="admin": raise HTTPException(400,"Não pode desativar admin principal")
    users[username]["active"] = body.get("active", True)
    save_users(users)
    return {"message": f"Usuário {'ativado' if users[username]['active'] else 'desativado'}"}

@app.delete("/api/admin/users/{username}")
async def admin_delete(username: str, admin=Depends(require_admin)):
    users = load_users()
    if username not in users: raise HTTPException(404,"Não encontrado")
    if username=="admin": raise HTTPException(400,"Não pode excluir admin principal")
    del users[username]
    save_users(users)
    return {"message": f"Usuário {username} excluído"}

@app.put("/api/admin/users/{username}/reset-password")
async def admin_reset_pw(username: str, body: dict, admin=Depends(require_admin)):
    users = load_users()
    if username not in users: raise HTTPException(404,"Não encontrado")
    pw = body.get("password","")
    if len(pw) < 4: raise HTTPException(400,"Senha muito curta")
    users[username]["password"] = pwd_context.hash(pw)
    save_users(users)
    return {"message": "Senha redefinida"}

@app.get("/api/sports")
async def list_sports(user=Depends(get_current_user)):
    return {"sports": [{"key":"soccer_brazil_campeonato","title":"Brasileirão"},{"key":"soccer_epl","title":"Premier League"},{"key":"soccer_spain_la_liga","title":"La Liga"},{"key":"soccer_italy_serie_a","title":"Serie A"},{"key":"soccer_germany_bundesliga","title":"Bundesliga"},{"key":"soccer_france_ligue_one","title":"Ligue 1"},{"key":"soccer_uefa_champs_league","title":"Champions League"},{"key":"basketball_nba","title":"NBA"},{"key":"americanfootball_nfl","title":"NFL"}]}
