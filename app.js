// app.js — main UI logic
// Assumes supabase global client created in supabase-client.js
const markets = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc' },
  { id: 'ethereum', name: 'Ethereum', symbol: 'eth' },
  { id: 'litecoin', name: 'Litecoin', symbol: 'ltc' }
];

const cgBase = 'https://api.coingecko.com/api/v3';

let currentMarket = markets[0]; // bitcoin
let chart, chartData = [];
let selectedFiat = 'usd';
let coinGeckoRates = {}; // usd conversion / rates

// DOM refs
const marketsList = document.getElementById('markets-list');
const balancesDiv = document.getElementById('balances');
const priceTicker = document.getElementById('price-ticker');
const marketTitle = document.getElementById('market-title');
const currencySelect = document.getElementById('currency-select');
const connectBtn = document.getElementById('connect-btn');
const openOrdersDiv = document.getElementById('open-orders');
const recentTradesDiv = document.getElementById('recent-trades');
const orderForm = document.getElementById('order-form');

// fill markets
function renderMarkets(){
  marketsList.innerHTML = '';
  for (const m of markets){
    const li = document.createElement('li');
    li.textContent = `${m.name} (${m.symbol.toUpperCase()})`;
    li.onclick = () => { switchMarket(m) };
    marketsList.appendChild(li);
  }
}

// switch market
async function switchMarket(m){
  currentMarket = m;
  marketTitle.textContent = `${m.name} / ${selectedFiat.toUpperCase()}`;
  await loadChartData(24); // default 24h
  fetchCurrentPrice();
}

// fetch prices from CoinGecko (simple)
async function fetchCurrentPrice(){
  try {
    const res = await fetch(`${cgBase}/simple/price?ids=${currentMarket.id}&vs_currencies=${selectedFiat}`);
    const data = await res.json();
    const p = data[currentMarket.id][selectedFiat];
    priceTicker.textContent = `${formatCurrency(p, selectedFiat)}`;
    return p;
  } catch (e) {
    console.error('price fetch error', e);
  }
}

// load chart data for given hours (range param)
async function loadChartData(hours=24){
  try{
    // CoinGecko market_chart returns prices for given days; convert hours to 'days' param small rounding
    const days = Math.max(1, Math.ceil(hours / 24));
    const res = await fetch(`${cgBase}/coins/${currentMarket.id}/market_chart?vs_currency=${selectedFiat}&days=${days}`);
    const data = await res.json();
    // data.prices = [[timestamp, price], ...]
    chartData = data.prices.map(p => ({ x: new Date(p[0]), y: p[1] }));
    updateChart();
  } catch(err){
    console.error(err);
  }
}

function initChart(){
  const ctx = document.getElementById('priceChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: `${currentMarket.symbol.toUpperCase()} price`,
        data: chartData,
        tension: 0.2,
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        backgroundColor: 'rgba(96,165,250,0.06)',
        borderColor: 'rgba(96,165,250,0.9)'
      }]
    },
    options: {
      parsing: false,
      normalized: true,
      scales: {
        x: { type: 'time', time: { tooltipFormat: 'MMM d, HH:mm' }, ticks: { color: '#9aa4b2' } },
        y: { ticks: { color: '#9aa4b2' } }
      },
      plugins: {
        legend: { display: false }
      },
      maintainAspectRatio: false,
      responsive: true
    }
  });
}

function updateChart(){
  if (!chart) return;
  chart.data.datasets[0].data = chartData;
  chart.update();
}

// format currency
function formatCurrency(v, fiat='usd'){
  if (v === undefined || v === null) return '—';
  const locales = { usd: 'en-US', eur: 'de-DE', ngn: 'en-NG', gbp: 'en-GB' };
  const currencyCodes = { usd: 'USD', eur: 'EUR', ngn: 'NGN', gbp: 'GBP' };
  return new Intl.NumberFormat(locales[fiat] || 'en-US', { style: 'currency', currency: currencyCodes[fiat] || 'USD' }).format(Number(v));
}

// currency switcher
currencySelect.addEventListener('change', async (e) => {
  selectedFiat = e.target.value;
  marketTitle.textContent = `${currentMarket.name} / ${selectedFiat.toUpperCase()}`;
  await loadChartData(24);
  await fetchCurrentPrice();
  renderBalances(); // convert displayed balances
});

connectBtn.addEventListener('click', async () => {
  // Supabase Auth: sign in with magic link example
  const email = prompt('Sign in via magic link — enter your email:');
  if (!email) return;
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) alert('Error sending magic link: ' + error.message);
  else alert('Magic link sent! Check your email.');
});

// balances: fetch from supabase wallets for the logged-in user
async function renderBalances(){
  const user = supabase.auth.getUser ? (await supabase.auth.getUser()).data.user : (supabase.auth.user && supabase.auth.user());
  if (!user) {
    balancesDiv.innerHTML = `<div class="muted">Sign in to see balances.</div>`;
    return;
  }
  const { data, error } = await supabase.from('wallets').select('*').eq('user_id', user.id);
  if (error) {
    balancesDiv.textContent = 'Error loading balances';
    console.error(error);
    return;
  }
  if (!data || data.length === 0) return balancesDiv.innerHTML = '<div class="muted">No balances yet</div>';

  // For each wallet, show converted value
  // We'll fetch current crypto -> fiat price for each asset symbol
  let html = '<ul style="list-style:none;padding:0;margin:0">';
  for (const w of data){
    let converted = w.balance;
    if (w.symbol.toLowerCase() !== selectedFiat) {
      // attempt to get price from CoinGecko
      try {
        const res = await fetch(`${cgBase}/simple/price?ids=${w.asset}&vs_currencies=${selectedFiat}`);
        const d = await res.json();
        const price = d[w.asset] && d[w.asset][selectedFiat] ? d[w.asset][selectedFiat] : null;
        converted = price ? Number(w.balance) * price : null;
      } catch(e) { console.warn('convert err', e); }
    }
    html += `<li style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.02)"><div>${w.asset.toUpperCase()} (${w.symbol.toUpperCase()})</div><div>${w.balance} • ${converted ? formatCurrency(converted, selectedFiat) : '—'}</div></li>`;
  }
  html += '</ul>';
  balancesDiv.innerHTML = html;
}

// orders: simple insertion into supabase.orders
orderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = supabase.auth.getUser ? (await supabase.auth.getUser()).data.user : (supabase.auth.user && supabase.auth.user());
  if (!user) return alert('Sign in first.');

  const side = document.getElementById('side').value;
  const symbolSelect = document.getElementById('symbol');
  const asset = symbolSelect.value; // e.g., 'bitcoin'
  const symbol = symbolSelect.options[symbolSelect.selectedIndex].text.split('(')[1].replace(')','').toLowerCase();
  const price = Number(document.getElementById('price').value);
  const quantity = Number(document.getElementById('quantity').value);

  if (!price || !quantity) return alert('Enter valid price & quantity.');

  const { data, error } = await supabase.from('orders').insert([{
    user_id: user.id,
    side, asset, symbol, price, quantity
  }]);
  if (error) {
    alert('Order failed: ' + error.message);
  } else {
    alert('Order placed.');
    fetchOpenOrders();
  }
});

// cancel all (demo)
document.getElementById('cancel-orders').addEventListener('click', async () => {
  const user = supabase.auth.getUser ? (await supabase.auth.getUser()).data.user : (supabase.auth.user && supabase.auth.user());
  if (!user) return alert('Sign in first.');
  const { error } = await supabase.from('orders').delete().match({ user_id: user.id });
  if (error) alert('Cancel error: ' + error.message); else fetchOpenOrders();
});

// fetch & render open orders
async function fetchOpenOrders(){
  const user = supabase.auth.getUser ? (await supabase.auth.getUser()).data.user : (supabase.auth.user && supabase.auth.user());
  if (!user) {
    openOrdersDiv.innerHTML = '<div class="muted">Sign in to view</div>';
    return;
  }
  const { data, error } = await supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', {ascending:false});
  if (error) { openOrdersDiv.innerHTML = 'Error'; console.error(error); return; }
  if (!data || data.length === 0) return openOrdersDiv.innerHTML = '<div class="muted">No open orders</div>';
  openOrdersDiv.innerHTML = data.map(o => `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.02)">${o.side.toUpperCase()} ${o.quantity} ${o.symbol.toUpperCase()} @ ${formatCurrency(o.price, selectedFiat)}</div>`).join('');
}

// fetch recent trades (demo)
async function fetchRecentTrades(){
  const { data, error } = await supabase.from('trades').select('*').order('executed_at', { ascending:false }).limit(10);
  if (error) { recentTradesDiv.innerHTML = 'Error'; return; }
  if (!data || data.length === 0) recentTradesDiv.innerHTML = '<div class="muted">No trades</div>';
  else recentTradesDiv.innerHTML = data.map(t => `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.02)">${t.quantity} ${t.symbol.toUpperCase()} • ${formatCurrency(t.price, selectedFiat)} • ${new Date(t.executed_at).toLocaleString()}</div>`).join('');
}

// realtime listeners for orders/trades/wallets
function setupRealtime(){
  supabase.channel('public:orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
      fetchOpenOrders();
    }).subscribe();

  supabase.channel('public:wallets')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, payload => {
      renderBalances();
    }).subscribe();

  supabase.channel('public:trades')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, payload => {
      fetchRecentTrades();
    }).subscribe();
}

async function init(){
  renderMarkets();
  initChart();
  await switchMarket(currentMarket);
  renderBalances();
  fetchOpenOrders();
  fetchRecentTrades();

  // chart refresh every 12 seconds (demo)
  setInterval(async () => {
    await fetchCurrentPrice();
    // append small point to chart (simple)
    const now = new Date();
    const p = await fetchCurrentPrice();
    if (p) {
      chartData.push({ x: now, y: p });
      if (chartData.length > 500) chartData.shift();
      updateChart();
    }
  }, 12000);

  // range controls
  document.querySelectorAll('.chart-controls button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = Number(btn.dataset.range);
      await loadChartData(r);
    });
  });

  // Supabase auth state change
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      connectBtn.textContent = 'Signed in';
      renderBalances();
      fetchOpenOrders();
    } else {
      connectBtn.textContent = 'Connect Wallet / Sign in';
    }
  });

  // set up realtime
  setupRealtime();
}

init();
