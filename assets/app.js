const API='/api';
const session={get token(){return sessionStorage.getItem('voterToken')},set token(v){v?sessionStorage.setItem('voterToken',v):sessionStorage.removeItem('voterToken')}};
async function api(path,options={}){const headers={'Content-Type':'application/json',...(options.headers||{})};if(session.token)headers.Authorization='Bearer '+session.token;let response;try{response=await fetch(API+path,{...options,headers})}catch{throw new Error('You appear to be offline. Check your connection and try again.')}const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'The service is unavailable. Please try again.');return data}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function setLoading(button,loading,label){button.disabled=loading;button.innerHTML=loading?'<span class="spinner"></span> Please wait…':label}
function progressValue(p){return [p.registered,p.learned,p.gameCompleted,p.quizCompleted].filter(Boolean).length*25}
function requireSession(){if(!session.token){location.replace('/');return false}return true}
async function loadProgress(){if(!requireSession())return null;try{return await api('/progress')}catch(e){if(/session|authorized/i.test(e.message)){session.token='';location.replace('/')}throw e}}
function signOut(){session.token='';location.replace('/')}
addEventListener('offline',()=>{document.querySelectorAll('.offline').forEach(el=>{el.textContent='You are offline. Reconnect to continue saving progress.';el.classList.add('show')})});
addEventListener('online',()=>{document.querySelectorAll('.offline').forEach(el=>el.classList.remove('show'))});
window.VoterApp={api,session,setLoading,progressValue,requireSession,loadProgress,signOut,escapeHtml};
