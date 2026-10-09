import { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import airportData from './airports.js';

// --- Firebase 初始化 ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "amazingtravel-whip0224.firebaseapp.com",
  projectId: "amazingtravel-whip0224",
  storageBucket: "amazingtravel-whip0224.firebasestorage.app",
  messagingSenderId: "1054814538508",
  appId: "1:1054814538508:web:6cccb3b84034a2fcfed729"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 型別定義 ---
interface Scheduled { date: string; start: string; end: string; transport: string; cost: string; }
interface Destination { name: string; scheduled: Scheduled | null; meta?: any; }

// 💡 阻斷 F5 重新整理時資料消失的問題：在 App 啟動前先挖出硬碟資料
const initData = (() => {
  try {
    const local = localStorage.getItem('at_local_data_final_v1');
    return local ? JSON.parse(local) : null;
  } catch (e) { return null; }
})();

export default function App() {
  // --- 狀態管理 (預設值改為直接讀取 initData) ---
  const [inputs, setInputs] = useState(initData?.inputs || {
    startDate: '', endDate: '', hotelName: '',
    departCountry: '', departLocation: '', departTime: '10:00',
    returnCountry: '', returnLocation: '', returnTime: '18:00'
  });
  const [destinations, setDestinations] = useState<Destination[]>(initData?.destinations || []);
  const [dailyOrder, setDailyOrder] = useState<Record<string, string[]>>(initData?.dailyOrder || {});
  
  const [currency, setCurrency] = useState({ base: 'TWD', target: 'JPY', amount: 1000, result: '' });
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentMode, setCurrentMode] = useState<'private' | 'shared'>('private');
  const [currentShareId, setCurrentShareId] = useState('');
  const [status, setStatus] = useState({ online: false, text: '初始化中...' });
  const [backups, setBackups] = useState<any[]>([]);
  const [modals, setModals] = useState({ manual: false, ai: false, cloud: false, manager: false, detail: false });
  const [activeEditName, setActiveEditName] = useState<string | null>(null);
  const [destListExpanded, setDestListExpanded] = useState(true);
  const [expandedDestName, setExpandedDestName] = useState<string | null>(null);
  const [detailForm, setDetailForm] = useState({ start: '10:00', end: '12:00', transport: '地鐵', cost: '', date: '' });
  
  const lastLocalData = useRef('');
  const newDestInputRef = useRef<HTMLInputElement>(null);

  // --- 啟動與 Firebase 監聽 ---
  useEffect(() => {
    signInAnonymously(auth).catch(() => setStatus({ online: false, text: '離線模式' }));
    const unsubAuth = onAuthStateChanged(auth, user => {
      if (user) { setCurrentUser(user); setStatus({ online: true, text: '連線完成' }); }
    });
    return () => unsubAuth();
  }, []);

  // --- 自動存檔機制 ---
  useEffect(() => {
    const appData = { inputs, destinations, dailyOrder };
    const dataStr = JSON.stringify(appData);
    if (lastLocalData.current === dataStr) return;
    lastLocalData.current = dataStr;
    localStorage.setItem('at_local_data_final_v1', dataStr);

    if (currentUser && status.online) {
      const path = currentMode === 'private' 
        ? doc(db, 'artifacts', 'amazing-travel-v1', 'users', currentUser.uid, 'active_trip', 'data')
        : doc(db, 'artifacts', 'amazing-travel-v1', 'public', 'data', 'shares', currentShareId || 'demo');
      setDoc(path, { ...appData, updatedAt: Date.now() }).catch(e => console.error("Cloud Save Fail", e));
    }
  }, [inputs, destinations, dailyOrder, currentUser, currentMode, currentShareId, status.online]);

  // --- 雲端同步機制 ---
  useEffect(() => {
    if (!currentUser) return;
    const path = currentMode === 'private' 
      ? doc(db, 'artifacts', 'amazing-travel-v1', 'users', currentUser.uid, 'active_trip', 'data')
      : doc(db, 'artifacts', 'amazing-travel-v1', 'public', 'data', 'shares', currentShareId || 'demo');
    
    const unsubSync = onSnapshot(path, (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      if (snap.exists()) {
        const data = snap.data();
        const incomingData = { inputs: data.inputs || inputs, destinations: data.destinations || [], dailyOrder: data.dailyOrder || {} };
        lastLocalData.current = JSON.stringify(incomingData);
        // 💡 暫停覆蓋本地狀態，解決 F5 資料被洗掉的問題
      }
    });
    const unsubBackups = onSnapshot(collection(db, 'artifacts', 'amazing-travel-v1', 'users', currentUser.uid, 'backups'), snap => {
      const bkps: any[] = [];
      snap.forEach(d => bkps.push({ id: d.id, ...d.data() }));
      setBackups(bkps);
    });
    return () => { unsubSync(); unsubBackups(); };
  }, [currentUser, currentMode, currentShareId]);


  // --- 🗓️ 日期與預算輔助函式 ---
  const getDays = () => {
    if (!inputs.startDate || !inputs.endDate) return [];
    const s = new Date(inputs.startDate), e = new Date(inputs.endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return [];
    const arr = [];
    let curr = new Date(s);
    while (curr <= e) {
      arr.push({ iso: curr.toISOString().split('T')[0], disp: curr.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', weekday: 'short' }) });
      curr.setDate(curr.getDate() + 1);
    }
    return arr;
  };
  const days = getDays();

  // 💰 新功能：計算當日預算總和
  const getDayTotal = (date: string) => {
    return destinations
      .filter(d => d.scheduled?.date === date)
      .reduce((sum, d) => sum + (Number(d.scheduled?.cost) || 0), 0);
  };

  const handleInputChange = (field: string, value: string) => setInputs(prev => ({ ...prev, [field]: value }));
  const openMap = (name: string) => {
    if (!name) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
    // 偵測如果是手機 (iOS/Android)，直接跳轉來喚醒 Google Maps App，避免殘留白畫面
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.location.href = url;
    } else {
      // 電腦版維持開新分頁，避免蓋掉原來的網頁
      window.open(url, '_blank');
    }
  };
  const rmDest = (name: string) => setDestinations(prev => prev.filter(d => d.name !== name));

  // --- 📍 手動新增景點 (自動抓座標與資訊) ---
  const handleAddDest = async (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent, inputRef: React.RefObject<HTMLInputElement>) => {
    if ('key' in e && e.key !== 'Enter') return;
    const val = inputRef.current?.value;
    if (!val) return;
    const names = val.split(/[,，]/).map(n => n.trim()).filter(n => n);
    if (names.length === 0) return;

    if (inputRef.current) { inputRef.current.value = '搜尋中...'; inputRef.current.disabled = true; }
    const newDests = [...destinations];
    
    try {
      const dummyDiv = document.createElement('div');
      const service = new (window as any).google.maps.places.PlacesService(dummyDiv);

      for (const name of names) {
        if (newDests.find(d => d.name === name)) continue;
        await new Promise((resolve) => {
          service.textSearch({ query: name }, (results: any, status: any) => {
            if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
              const p = results[0];
              newDests.push({
                name: name, scheduled: null,
                meta: {
                  displayName: { text: p.name }, formattedAddress: p.formatted_address,
                  rating: p.rating, userRatingCount: p.user_ratings_total,
                  location: { lat: p.geometry.location.lat(), lng: p.geometry.location.lng() }
                }
              });
            } else { newDests.push({ name, scheduled: null }); }
            resolve(true);
          });
        });
      }
      setDestinations([...newDests]);
    } catch (err) { console.error(err); } 
    finally { if (inputRef.current) { inputRef.current.value = ''; inputRef.current.disabled = false; inputRef.current.focus(); } }
  };

  const handleImportFromLocationApp = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const importedPlaces = JSON.parse(text);
      if (Array.isArray(importedPlaces) && importedPlaces[0]?.id) {
        const newDests = importedPlaces.map(p => ({ name: p.customName || p.displayName?.text || '未知', scheduled: null, meta: p }));
        const existingNames = destinations.map(d => d.name);
        const uniqueNewDests = newDests.filter(d => !existingNames.includes(d.name));
        setDestinations(prev => [...prev, ...uniqueNewDests]);
        setDestListExpanded(true);
        alert(`🎉 成功匯入 ${uniqueNewDests.length} 個地點！`);
      }
    } catch (error) { alert('匯入失敗，請確認剪貼簿內容。'); }
  };

  const calcRate = async () => {
    setCurrency(prev => ({ ...prev, result: '計算中...' }));
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency.base}`);
      const data = await res.json();
      const val = (currency.amount * data.rates[currency.target]).toLocaleString(undefined, { minimumFractionDigits: 2 });
      setCurrency(prev => ({ ...prev, result: `${val} ${currency.target}` }));
    } catch (e) { setCurrency(prev => ({ ...prev, result: '失敗' })); }
  };
  const swapCur = () => { setCurrency(prev => ({ ...prev, base: prev.target, target: prev.base })); calcRate(); };

  // --- 行程操作 ---
  const openDetailModal = (dest: Destination) => {
    setActiveEditName(dest.name);
    setDetailForm({
      start: dest.scheduled?.start || '10:00', end: dest.scheduled?.end || '12:00',
      transport: dest.scheduled?.transport || '地鐵', cost: dest.scheduled?.cost || '', date: dest.scheduled?.date || ''
    });
    setModals({ ...modals, detail: true });
  };
  const saveDetail = () => {
    if (!detailForm.date) return alert("請選擇日期");
    setDestinations(prev => prev.map(d => d.name === activeEditName ? { ...d, scheduled: { ...detailForm } } : d));
    setModals({ ...modals, detail: false });
  };
  const unsetDetail = () => {
    setDestinations(prev => prev.map(d => d.name === activeEditName ? { ...d, scheduled: null } : d));
    setModals({ ...modals, detail: false });
  };

  const moveOrder = (date: string, name: string, dir: number) => {
    const dayEvs = destinations.filter(d => d.scheduled?.date === date).map(d => d.name);
    let currentOrder = [...(dailyOrder[date] || [])];
    if (currentOrder.length === 0) {
      currentOrder = destinations.filter(d => d.scheduled?.date === date).sort((a, b) => (a.scheduled!.start > b.scheduled!.start ? 1 : -1)).map(d => d.name);
    } else {
      const missing = dayEvs.filter(n => !currentOrder.includes(n));
      currentOrder = [...currentOrder, ...missing].filter(n => dayEvs.includes(n));
    }
    const idx = currentOrder.indexOf(name);
    const nIdx = idx + dir;
    if (nIdx >= 0 && nIdx < currentOrder.length) {
      [currentOrder[idx], currentOrder[nIdx]] = [currentOrder[nIdx], currentOrder[idx]];
      setDailyOrder(prev => ({ ...prev, [date]: currentOrder }));
    }
  };

  // 🪄 自動排序演算法
  const optimizeRoute = (date: string) => {
    const dayEvs = destinations.filter(d => d.scheduled?.date === date);
    if (dayEvs.length < 2) return alert("這天的景點不到兩個，不需要排序喔！");
    const validEvs = dayEvs.filter(d => d.meta?.location);
    const invalidEvs = dayEvs.filter(d => !d.meta?.location);
    if (validEvs.length < 2) return alert("可計算座標的地點不足！\n請確認地點有成功抓取到地址。");

    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    const currentOrder = dailyOrder[date] || validEvs.map(d => d.name);
    let startNode = validEvs.find(d => d.name === currentOrder[0]) || validEvs[0];
    let unvisited = validEvs.filter(d => d.name !== startNode.name);
    const newOrder = [startNode.name];
    let currentNode = startNode;

    while (unvisited.length > 0) {
      let nearestIdx = 0; let minDistance = Infinity;
      for (let i = 0; i < unvisited.length; i++) {
        const dist = getDistance(currentNode.meta.location.lat, currentNode.meta.location.lng, unvisited[i].meta.location.lat, unvisited[i].meta.location.lng);
        if (dist < minDistance) { minDistance = dist; nearestIdx = i; }
      }
      currentNode = unvisited[nearestIdx];
      newOrder.push(currentNode.name);
      unvisited.splice(nearestIdx, 1);
    }
    setDailyOrder(prev => ({ ...prev, [date]: [...newOrder, ...invalidEvs.map(d => d.name)] }));
    alert("✨ 行程已根據地理位置最佳化！");
  };

  // --- ☁️ 共享與編輯名稱功能 ---
  const handleShare = () => {
    if (!currentUser) return alert('請等待連線完成');
    const sid = Math.random().toString(36).substring(2, 8).toUpperCase();
    setCurrentShareId(sid); setCurrentMode('shared');
    alert(`已建立共享房間！\n房號：${sid}`);
  };
  const joinShare = (val: string) => {
    if (!val) return;
    setCurrentShareId(val.toUpperCase()); setCurrentMode('shared');
    alert(`已加入房間：${val.toUpperCase()}`);
  };
  const handleEditName = (newName: string) => {
    if (!newName || !activeEditName) return;
    
    // 1. 同步更新名稱，並強制覆蓋 Google 的官方名稱 (customName)
    setDestinations(prev => prev.map(d => {
      if (d.name === activeEditName) {
        return { 
          ...d, 
          name: newName, 
          meta: d.meta ? { ...d.meta, customName: newName } : undefined 
        };
      }
      return d;
    }));
    
    // 2. 更新行程表裡的排序紀錄
    const newOrder = { ...dailyOrder };
    Object.keys(newOrder).forEach(k => { 
      newOrder[k] = newOrder[k].map(n => n === activeEditName ? newName : n); 
    });
    setDailyOrder(newOrder);
    
    // 3. 如果這個卡片剛好是展開狀態，自動切換到新名字保持展開
    if (expandedDestName === activeEditName) setExpandedDestName(newName);
    
    setModals({...modals, manual: false});
  };
  
  return (
    <div className="p-4 pb-20 md:p-8 font-sans bg-[#f7f9fb] min-h-screen">
      <div className="max-w-4xl mx-auto">
        
        {/* --- Header --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-gray-200 pb-4 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">AmazingTravel</h1>
            <div className="flex items-center space-x-2 mt-1 cursor-pointer" onClick={() => setModals({...modals, cloud: true})}>
              <span className={`text-xs flex items-center font-bold px-2 py-1 rounded-full ${status.online ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                <span className={`w-2 h-2 rounded-full inline-block mr-1 ${status.online ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-gray-400'}`}></span>
                {status.text} (點擊開啟共享)
              </span>
            </div>
          </div>
          <button onClick={handleImportFromLocationApp} className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-bold shadow hover:bg-purple-200 transition flex items-center gap-1"><span>📥</span> 匯入 Location 資料</button>
        </div>

        {/* --- 匯率換算 --- */}
        <div className="bg-white rounded-2xl shadow-sm border-l-4 border-l-green-500 border-y border-r border-gray-100 p-5 mb-6">
          <h2 className="text-lg font-bold text-green-700 mb-3 flex items-center"><span className="mr-2">💵</span> 即時匯率換算</h2>
          <div className="flex flex-col md:flex-row gap-2 items-center">
            <select value={currency.base} onChange={e => setCurrency({...currency, base: e.target.value})} className="p-2 border border-gray-200 rounded-xl font-bold w-full md:w-auto bg-gray-50 outline-none"><option>TWD</option><option>HKD</option><option>JPY</option></select>
            <button onClick={swapCur} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition text-gray-600">⇄</button>
            <select value={currency.target} onChange={e => setCurrency({...currency, target: e.target.value})} className="p-2 border border-gray-200 rounded-xl font-bold w-full md:w-auto bg-gray-50 outline-none"><option>JPY</option><option>TWD</option><option>HKD</option></select>
            <input type="number" value={currency.amount} onChange={e => setCurrency({...currency, amount: Number(e.target.value)})} className="p-2 border border-gray-200 rounded-xl w-full md:w-auto flex-grow outline-none focus:border-green-400" />
            <button onClick={calcRate} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold w-full md:w-auto hover:bg-green-700 shadow transition">換算</button>
          </div>
          {currency.result && <div className="mt-3 text-3xl font-black text-green-800 tracking-tight">{currency.result}</div>}
        </div>

        {/* --- 基本資料設定 --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div><label className="text-xs font-bold text-gray-400 block mb-1 uppercase">Start Date</label><input type="date" value={inputs.startDate} onChange={e => handleInputChange('startDate', e.target.value)} className="w-full p-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400" /></div>
            <div><label className="text-xs font-bold text-gray-400 block mb-1 uppercase">End Date</label><input type="date" value={inputs.endDate} onChange={e => handleInputChange('endDate', e.target.value)} className="w-full p-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400" /></div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1 uppercase">Hotel / Stay</label>
              <div className="flex space-x-1">
                <input type="text" value={inputs.hotelName} onChange={e => handleInputChange('hotelName', e.target.value)} placeholder="住宿名稱" className="w-full p-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400" />
                <button onClick={() => openMap(inputs.hotelName)} className="bg-blue-50 text-blue-500 px-3 rounded-xl border border-blue-100 hover:bg-blue-100 transition">🗺️</button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Departure 🛫</label>
              <div className="grid grid-cols-2 gap-1 mb-1">
                <select value={inputs.departCountry} onChange={e => handleInputChange('departCountry', e.target.value)} className="p-1 border border-gray-200 rounded-lg text-xs outline-none bg-white"><option value="">選擇國家</option>{airportData.map(c => <option key={c.country} value={c.country}>{c.country}</option>)}</select>
                <select value={inputs.departLocation} onChange={e => handleInputChange('departLocation', e.target.value)} className="p-1 border border-gray-200 rounded-lg text-xs outline-none bg-white"><option value="">選擇機場</option>{airportData.find(c => c.country === inputs.departCountry)?.airports.map(a => <option key={a} value={a}>{a}</option>)}</select>
              </div>
              <input type="time" value={inputs.departTime} onChange={e => handleInputChange('departTime', e.target.value)} className="w-full p-1 border border-gray-200 rounded-lg text-sm outline-none bg-white" />
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Return 🛬</label>
              <div className="grid grid-cols-2 gap-1 mb-1">
                <select value={inputs.returnCountry} onChange={e => handleInputChange('returnCountry', e.target.value)} className="p-1 border border-gray-200 rounded-lg text-xs outline-none bg-white"><option value="">選擇國家</option>{airportData.map(c => <option key={c.country} value={c.country}>{c.country}</option>)}</select>
                <select value={inputs.returnLocation} onChange={e => handleInputChange('returnLocation', e.target.value)} className="p-1 border border-gray-200 rounded-lg text-xs outline-none bg-white"><option value="">選擇機場</option>{airportData.find(c => c.country === inputs.returnCountry)?.airports.map(a => <option key={a} value={a}>{a}</option>)}</select>
              </div>
              <input type="time" value={inputs.returnTime} onChange={e => handleInputChange('returnTime', e.target.value)} className="w-full p-1 border border-gray-200 rounded-lg text-sm outline-none bg-white" />
            </div>
          </div>
          
          <div className="flex justify-between items-center mb-4 cursor-pointer select-none" onClick={() => setDestListExpanded(!destListExpanded)}>
            <h2 className="text-lg font-bold text-gray-800">目的地清單 {destListExpanded ? '▼' : '▲'}</h2>
          </div>
          {destListExpanded && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex gap-2 mb-4">
                <input ref={newDestInputRef} type="text" placeholder="輸入地點並按 Enter 搜尋" onKeyDown={e => handleAddDest(e, newDestInputRef)} className="flex-grow p-2 border border-gray-200 rounded-xl text-sm" />
                <button onClick={e => handleAddDest(e, newDestInputRef)} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold">新增</button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {destinations.map(d => {
                  const isExpanded = expandedDestName === d.name;
                  const place = d.meta || {}; 
                  return (
                    <div key={d.name} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${d.scheduled ? 'border-emerald-400' : 'border-gray-200'}`}>
                      <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => setExpandedDestName(isExpanded ? null : d.name)}>
                        <div>
                          <h3 className="font-bold text-base text-gray-900">{place.customName || place.displayName?.text || d.name}</h3>
                          <div className="text-xs text-gray-400 mt-1 font-bold">{d.scheduled ? `📅 已安排：${d.scheduled.date}` : '⚠️ 未安排'}</div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-100 pt-3 bg-gray-50/50">
                          <div className="text-sm text-gray-600 mb-3">{place.formattedAddress && <p>📍 {place.formattedAddress}</p>}</div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={(e) => { e.stopPropagation(); openMap(d.name); }} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold">🗺️ 地圖</button>
                            <button onClick={(e) => { e.stopPropagation(); setActiveEditName(d.name); setModals({...modals, manual: true}); }} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold">✏️ 編輯名稱</button>
                            <button onClick={(e) => { e.stopPropagation(); rmDest(d.name); }} className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-sm font-bold">🗑 刪除</button>
                            <button onClick={(e) => { e.stopPropagation(); openDetailModal(d); }} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold">📅 安排與預算</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* --- 🗓️ 行程表顯示區 --- */}
        <div className="space-y-4 mb-10">
          {days.length === 0 ? (
            <div className="text-center text-gray-400 p-12 border-2 border-dashed border-gray-200 rounded-2xl bg-white font-bold">請先於上方設定旅行日期</div>
          ) : (
            days.map((day, idx) => {
              let evs = destinations.filter(d => d.scheduled?.date === day.iso);
              const order = dailyOrder[day.iso] || [];
              evs.sort((a, b) => {
                const ia = order.indexOf(a.name); const ib = order.indexOf(b.name);
                if (ia !== -1 && ib !== -1) return ia - ib;
                if (ia !== -1) return -1;
                if (ib !== -1) return 1;
                return (a.scheduled!.start > b.scheduled!.start) ? 1 : -1;
              });

              return (
                <div key={day.iso} className="bg-white p-5 rounded-2xl border-l-8 border-indigo-600 shadow-sm border-y border-r border-gray-100">
                  <h3 className="font-bold text-gray-800 mb-4 flex flex-wrap items-center justify-between text-lg border-b border-gray-100 pb-2">
                    <div className="flex items-center">
                      <span className="bg-indigo-100 text-indigo-600 w-8 h-8 rounded-full flex items-center justify-center mr-2 text-sm font-bold">{idx + 1}</span> 
                      {day.disp}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-2 md:mt-0">
                      {/* 💰 每日預算加總標籤 */}
                      <span className="text-sm font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-200">
                        💰 小計: {getDayTotal(day.iso).toLocaleString()}
                      </span>
                      {/* 🪄 魔法排序按鈕 */}
                      <button onClick={() => optimizeRoute(day.iso)} className="text-xs bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1.5 rounded-lg shadow-sm font-bold hover:brightness-110 transition flex items-center gap-1">
                        🪄 自動排序
                      </button>
                    </div>
                  </h3>

                  {/* 👇 加在 h3 下方 */}
                  {idx === 0 && (
                    <div className="p-2 mb-3 bg-blue-50/50 rounded-lg border border-blue-100">
                      <span className="text-xs font-bold text-blue-700 uppercase">🛫 Departure:</span>
                      <span className="text-sm font-bold text-blue-800 ml-1">{inputs.departTime || '00:00'} | {inputs.departLocation || '-'}</span>
                    </div>
                  )}

                  {evs.length === 0 ? <p className="text-xs text-gray-400 italic pl-10 py-2">暫無排程</p> : evs.map(e => (
                    <div key={e.name} className="flex items-start gap-3 p-3 bg-gray-50/50 border border-gray-200 rounded-xl mb-2">
                      <div className="flex flex-col items-center pt-1 shrink-0">
                        <span className="font-bold text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full mb-1">{e.scheduled!.start}</span>
                        <div className="w-0.5 h-6 bg-indigo-100"></div>
                        <span className="font-bold text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full mt-1">{e.scheduled!.end}</span>
                      </div>
                      <div className="flex-grow">
                        <div className="font-bold text-gray-800">{e.name}</div>
                        {/* 顯示單項預算 */}
                        <div className="text-[10px] text-gray-500 mt-1 font-bold">🚗 {e.scheduled!.transport} | 💰 {e.scheduled!.cost || '0'}</div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveOrder(day.iso, e.name, -1)} className="text-xs text-gray-400 border rounded px-1">▲</button>
                        <button onClick={() => moveOrder(day.iso, e.name, 1)} className="text-xs text-gray-400 border rounded px-1">▼</button>
                      </div>
                    </div>
                  ))}
                  {/* 👇 加在景點迴圈結束的下方，該日 div 結束的前面 */}
                  {idx === days.length - 1 && (
                    <div className="p-2 mt-4 bg-orange-50/50 rounded-lg border border-orange-100">
                      <span className="text-xs font-bold text-orange-700 uppercase">🛬 Return:</span>
                      <span className="text-sm font-bold text-orange-800 ml-1">{inputs.returnTime || '00:00'} | {inputs.returnLocation || '-'}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* === 排程設定彈出視窗 === */}
      {modals.detail && (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4 text-indigo-700 border-b border-gray-100 pb-2 truncate">{activeEditName}</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-[10px] text-gray-400 font-bold block">Start</label><input type="time" value={detailForm.start} onChange={e => setDetailForm({...detailForm, start: e.target.value})} className="w-full border p-2 rounded-xl text-sm" /></div>
              <div><label className="text-[10px] text-gray-400 font-bold block">End</label><input type="time" value={detailForm.end} onChange={e => setDetailForm({...detailForm, end: e.target.value})} className="w-full border p-2 rounded-xl text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div><label className="text-[10px] text-gray-400 font-bold block">Transport</label><select value={detailForm.transport} onChange={e => setDetailForm({...detailForm, transport: e.target.value})} className="w-full border p-2 rounded-xl text-sm"><option>地鐵</option><option>巴士</option><option>計程車</option><option>步行</option></select></div>
              <div><label className="text-[10px] text-gray-400 font-bold block">Budget</label><input type="text" value={detailForm.cost} onChange={e => setDetailForm({...detailForm, cost: e.target.value})} placeholder="例如: 1000" className="w-full border p-2 rounded-xl text-sm" /></div>
            </div>
            <label className="text-[10px] text-gray-400 font-bold block mb-1">SELECT DATE</label>
            <div className="max-h-32 overflow-y-auto border rounded-xl p-2 mb-5 text-sm bg-gray-50 flex flex-col gap-1">
              {days.map(day => (
                <label key={day.iso} className={`flex items-center p-2 border rounded-lg cursor-pointer ${detailForm.date === day.iso ? 'bg-indigo-50 border-indigo-300' : 'bg-white'}`}>
                  <input type="radio" name="ddate" value={day.iso} checked={detailForm.date === day.iso} onChange={e => setDetailForm({...detailForm, date: e.target.value})} className="mr-2" />
                  <span className="font-bold text-gray-700">{day.disp}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-between items-center">
              <button onClick={unsetDetail} className="text-red-500 text-sm font-bold px-3 py-2 hover:bg-red-50 rounded-xl transition">取消排定</button>
              <div className="flex gap-2">
                <button onClick={() => setModals({...modals, detail: false})} className="text-gray-500 bg-gray-100 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-200">取消</button>
                <button onClick={saveDetail} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700">確認</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === ☁️ 雲端與共享彈窗 === */}
            {modals.cloud && (
              <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-3xl w-full max-w-sm">
                  <h3 className="text-xl font-bold mb-4 flex items-center"><span className="mr-2">☁️️</span> 雲端與共享</h3>
                  <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-sm font-bold text-gray-600 mb-2">目前模式：{currentMode === 'private' ? '🔒 私人模式' : `👥 共享房間 (${currentShareId})`}</div>
                    <button onClick={handleShare} className="w-full bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold mb-2">建立新共享房間</button>
                    <div className="flex gap-2 mt-4">
                      <input type="text" id="joinRoomInput" placeholder="輸入房號" className="flex-grow border p-2 rounded-xl text-sm uppercase outline-none focus:border-indigo-400" />
                      <button onClick={() => joinShare((document.getElementById('joinRoomInput') as HTMLInputElement).value)} className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold">加入</button>
                    </div>
                  </div>
                  <button onClick={() => setModals({...modals, cloud: false})} className="w-full bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-200">關閉</button>
                </div>
              </div>
            )}

            {/* === ✏️ 更改名稱彈窗 === */}
            {modals.manual && (
              <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-3xl w-full max-w-sm">
                  <h3 className="text-lg font-bold mb-4 text-gray-800">✏️ 更改景點名稱</h3>
                  <input type="text" id="editNameInput" defaultValue={activeEditName || ''} className="w-full border border-gray-300 p-3 rounded-xl text-sm mb-4 outline-none focus:border-indigo-500" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setModals({...modals, manual: false})} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200">取消</button>
                    <button onClick={() => handleEditName((document.getElementById('editNameInput') as HTMLInputElement).value)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700">儲存變更</button>
                  </div>
                </div>
              </div>
            )}



    </div>
  );
}