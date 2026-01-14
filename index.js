const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const frontendPath = path.join(__dirname, '../merchant-sim-game');

// 1. We check if the path exists (so it doesn't give an error if the name is wrong)
if (fs.existsSync(frontendPath)) {
    console.log(`📂 Serving Frontend from: ${frontendPath}`);
    app.use(express.static(frontendPath));
} else {
    console.error(`❌ ERROR: I can't find the frontend folder in: ${frontendPath}`);
    console.error("Make sure the frontend folder is called exactly 'merchant-sim-game' and is next to the server folder.");
}


// --- 1. DEFINITION OF NARRATIVE EVENTS ---
const POSSIBLE_EVENTS = [
    // EVENT 1: Aethelgard (Mine) is starving.
    // OPPORTUNITY: Buy Wheat (~30g) -> Sell in Aethelgard for (~150g).
    {
        id: "famine_aethelgard",
        title: "Famine in the Mines",
        message: "Aethelgard is out of reserves. They pay ANYTHING for food!",
        targetCity: "aethelgard", 
        affectedGoods: ["wheat"], 
        multiplier: 5.0 // BEFORE: 3.0 -> NOW: 5.0
    },
    
    // EVENT 2: Oakhaven needs tools desperately.
    // OPPORTUNITY: Iron is very expensive in the starting city.
    {
        id: "broken_plows",
        title: "Agricultural Crisis",
        message: "Oakhaven's farmers can't work. They need Iron NOW.",
        targetCity: "oakhaven",
        affectedGoods: ["iron"],
        multiplier: 4.0 
    },

    // EVENT 3: Massive construction in Ember Cay.
    // OPPORTUNITY: Wood and Stone prices rise a lot.
    {
        id: "construction_boom",
        title: "Construction Fever",
        message: "Ember Cay's nobles are building palaces. Wood and Stone are worth gold.",
        targetCity: "ember",
        affectedGoods: ["wood", "stone"],
        multiplier: 6.0 // Wood at Gem price! (~270g)
    },

    // EVENT 4: Massive Harvest (Oakhaven GIVES away wheat).
    // OPPORTUNITY: Buy stock almost for free (~5g) to store.
    {
        id: "super_harvest",
        title: "Legendary Harvest",
        message: "Wheat is rotting in Oakhaven's silos! They're giving it away.",
        targetCity: "oakhaven",
        affectedGoods: ["wheat"],
        multiplier: 0.2 // Very low price
    },

    // EVENT 5: Naval Blockade in Serpent Isles.
    // OPPORTUNITY: Wood is vital for repairing ships.
    {
        id: "naval_war",
        title: "Destroyed Fleet",
        message: "Serpent Isles has lost its fleet. They urgently need Wood.",
        targetCity: "serpent",
        affectedGoods: ["wood"],
        multiplier: 6.0 // This will make the trip worthwhile
    },

    // EVENT 6: Rich People's Party (Gems and Spices).
    // Since these items are already expensive (200g), a mult of 3.0 is enough to earn thousands.
    {
        id: "royal_wedding",
        title: "Royal Wedding in Whispering",
        message: "The elven royalty demands luxuries. Gems and Spices at astronomical prices.",
        targetCity: "whispering",
        affectedGoods: ["gems", "spices"],
        multiplier: 3.0 
    },

    {
        id: "normal",
        title: "Calm in the Kingdom",
        message: "Markets stabilize. Normal prices.",
        targetCity: null,
        affectedGoods: [],
        multiplier: 1.0
    }
];

// Estado Global
let citiesWithMarketState = []; 
let currentActiveEvent = null; 
let globalNews = { id: 0, text: "Welcome to the Guild. The market is stable." }; 

const ECONOMY_RULES = {
    "Agriculture": { produces: ["wheat"], demands: ["wood", "iron", "stone"] },
    "Forestry": { produces: ["wood"], demands: ["wheat", "iron"] },
    "Mining": { produces: ["iron", "stone"], demands: ["wheat", "wood", "spices"] },
    "Maritime": { produces: ["spices"], demands: ["stone", "gems", "wood"] },
    "Luxury": { produces: ["gems"], demands: ["spices", "iron", "wheat"] }
};

// --- 2. MARKET GENERATION ---
function refreshMarkets() {
    try {
        const citiesData = fs.readFileSync(path.join(__dirname, 'data', 'cities.json'), 'utf8');
        const goodsData = fs.readFileSync(path.join(__dirname, 'data', 'goods.json'), 'utf8');
        const cities = JSON.parse(citiesData);
        const goods = JSON.parse(goodsData);

        citiesWithMarketState = cities.map(city => {
            const rules = ECONOMY_RULES[city.economyType];
            if (!rules) return city;

            const calculatePrice = (basePrice, goodId, isSelling) => {
                let multiplier = isSelling ? 0.8 : 1.5; 
                
                if (currentActiveEvent && 
                    currentActiveEvent.targetCity === city.id && 
                    currentActiveEvent.affectedGoods.includes(goodId)) {
                    multiplier *= currentActiveEvent.multiplier;
                }

                const randomVar = (Math.random() * 0.2) + 0.9; 
                return Math.floor(basePrice * multiplier * randomVar);
            };

            const sellingList = rules.produces.map(prodId => {
                const good = goods.find(g => g.id === prodId);
                return {
                    id: prodId,
                    name: good.name,
                    price: calculatePrice(good.basePrice, prodId, true),
                    stock: Math.floor(Math.random() * 50) + 20
                };
            });

            const buyingList = rules.demands.map(demId => {
                const good = goods.find(g => g.id === demId);
                return {
                    id: demId,
                    name: good.name,
                    price: calculatePrice(good.basePrice, demId, false),
                    demand: Math.floor(Math.random() * 20) + 5
                };
            });

            return { ...city, market: { selling: sellingList, buying: buyingList } };
        });
        console.log("♻️ Markets updated.");
    } catch (error) { console.error("Market error:", error); }
}

refreshMarkets(); 

// --- 3. EVENT LOOP ---
const EVENT_DURATION = 180 * 1000; // 3 Minutes (in milliseconds)
let nextEventChangeTime = Date.now() + EVENT_DURATION; // When the next one will change

setInterval(() => {
    const now = Date.now();

    // 1. Does the current event still last?
    if (now < nextEventChangeTime) {
        // If time is still left, we do NOTHING. We maintain the event and prices.
        return; 
    }
    
    // We reset the counter for the next cycle (3 more minutes)
    nextEventChangeTime = now + EVENT_DURATION;

    // Probability logic (30% chance to return to normality, 70% chaos)
    const roll = Math.random();
    
    if (roll < 0.7) { 
        // Generate a crazy event
        const eventIndex = Math.floor(Math.random() * (POSSIBLE_EVENTS.length - 1));
        currentActiveEvent = POSSIBLE_EVENTS[eventIndex];
    } else {
        // Return to normality
        currentActiveEvent = null; 
    }

    // Generate the news text
    const newsText = currentActiveEvent 
        ? `📰 NEWS (${Math.floor(EVENT_DURATION/1000)}s): ${currentActiveEvent.message}` 
        : "🌤️ The market stabilizes. Normal prices.";
        
    globalNews = { id: Date.now(), text: newsText };
    
    console.log(`⚡ EVENT CHANGE: ${newsText}`);
    
    // Aplicar los nuevos precios
    refreshMarkets(); 

}, 1000);


// --- ROUTES ---

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/api/cities', (req, res) => res.json(citiesWithMarketState));
app.get('/api/goods', (req, res) => {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'goods.json'), 'utf-8');
    res.json(JSON.parse(data));
});

app.get('/api/player', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'data', 'player.json');
        let player = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        let hasChanges = false;
        const now = Date.now();
        const events = []; 

        const totalInventory = { wood: 0, iron: 0, wheat: 0, stone: 0, gems: 0, spices: 0 };
        
        player.merchants.forEach(m => {
            if (!m.inventory) m.inventory = { wood: 0, iron: 0, wheat: 0, stone: 0, gems: 0, spices: 0 };
            for (const [key, val] of Object.entries(m.inventory)) totalInventory[key] += val;

            if (m.status === 'traveling' && m.arrivalTime && now >= m.arrivalTime) {
                const originId = m.currentLocation;
                const destinationId = m.destination;
                const originCity = citiesWithMarketState.find(c => c.id === originId);
                const route = originCity ? originCity.connections.find(c => c.targetId === destinationId) : null;
                const routeRisk = route ? route.risk : 0.2; 
                
                let arrivalMessage = `✅ ${m.name} has arrived at ${m.destination}.`;

                const roll = Math.random(); 
                if (roll < routeRisk) { 
                    const items = Object.keys(m.inventory).filter(k => m.inventory[k] > 0);
                    if (items.length > 0) {
                        const itemToLose = items[Math.floor(Math.random() * items.length)];
                        const amountLost = Math.ceil(m.inventory[itemToLose] * 0.5); 
                        m.inventory[itemToLose] -= amountLost;
                        arrivalMessage = `⚔️ AMBUSH! ${m.name} lost ${amountLost} of ${itemToLose}.`;
                    }
                }
                
                events.push(arrivalMessage);
                m.status = 'idle';
                m.free = true;
                m.currentLocation = m.destination;
                m.destination = null;
                m.arrivalTime = null;
                hasChanges = true;
            }
        });

        player.inventory = totalInventory;
        if (hasChanges) fs.writeFileSync(filePath, JSON.stringify(player, null, 2));

        res.json({ ...player, events: events, globalNews: globalNews });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error player" });
    }
});

app.post('/api/hire', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'data', 'player.json');
        const player = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const merchantIndex = player.merchants.findIndex(m => m.hire === false);
        if (merchantIndex === -1) return res.status(400).json({ error: "Full" });
        player.gold -= 500;
        player.merchants[merchantIndex].hire = true;
        player.merchants[merchantIndex].inventory = { wood: 0, iron: 0, wheat: 0, stone: 0, gems: 0, spices: 0 };
        fs.writeFileSync(filePath, JSON.stringify(player, null, 2));
        res.json({ success: true, message: "Hired", player });
    } catch (error) { res.status(500).json({ error: "Error hiring" }); }
});

app.post('/api/dispatch', (req, res) => {
    try {
        const { merchantName, targetCityId } = req.body;
        const playerPath = path.join(__dirname, 'data', 'player.json');
        const citiesPath = path.join(__dirname, 'data', 'cities.json');
        const player = JSON.parse(fs.readFileSync(playerPath, 'utf8'));
        const cities = JSON.parse(fs.readFileSync(citiesPath, 'utf8'));
        const merchant = player.merchants.find(m => m.name === merchantName);
        const currentCity = cities.find(c => c.id === merchant.currentLocation);
        const route = currentCity.connections.find(c => c.targetId === targetCityId);
        
        merchant.free = false;
        merchant.status = "traveling";
        merchant.destination = targetCityId;
        merchant.arrivalTime = Date.now() + (route.distance * 1000);
        fs.writeFileSync(playerPath, JSON.stringify(player, null, 2));
        res.json({ success: true, message: "Traveling", player });
    } catch (error) { res.status(500).json({ error: "Error dispatch" }); }
});

app.post('/api/trade', (req, res) => {
    try {
        const { action, goodId, quantity, merchantName } = req.body;
        const playerPath = path.join(__dirname, 'data', 'player.json');
        const player = JSON.parse(fs.readFileSync(playerPath, 'utf8'));
        
        const merchant = player.merchants.find(m => m.name === merchantName);
        if (!merchant.inventory) merchant.inventory = { wood: 0, iron: 0, wheat: 0, stone: 0, gems: 0, spices: 0 };
        const city = citiesWithMarketState.find(c => c.id === merchant.currentLocation);

        // 1. CALCULAR CARGA ACTUAL (Suma de todo lo que lleva)
        const currentLoad = Object.values(merchant.inventory).reduce((sum, qty) => sum + qty, 0);

        if (action === 'buy') {
            const item = city.market.selling.find(g => g.id === goodId);
            const cost = item.price * quantity;

            // VALIDATION A: Do you have Gold?
            if (player.gold < cost) {
                return res.status(400).json({ error: "You don't have enough gold." });
            }

            // VALIDATION B: Do you have Space? (THIS WAS MISSING!)
            if (currentLoad + quantity > merchant.capacity) {
                return res.status(400).json({ error: `It doesn't fit! Capacity: ${currentLoad}/${merchant.capacity}` });
            }
            
            player.gold -= cost;
            merchant.inventory[goodId] = (merchant.inventory[goodId] || 0) + quantity;
            
        } else { 
            // Sell Logic (same as before)
            const item = city.market.buying.find(g => g.id === goodId);
            if (!merchant.inventory[goodId] || merchant.inventory[goodId] < quantity) {
                return res.status(400).json({ error: "You don't have stock in the cart." });
            }
            player.gold += item.price * quantity;
            merchant.inventory[goodId] -= quantity;
        }

        fs.writeFileSync(playerPath, JSON.stringify(player, null, 2));
        res.json({ success: true, message: "Deal done", player });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error server" });
    }
});

// --- INITIAL STATE CONSTANT ---
const DEFAULT_PLAYER_STATE = {
  name: "Captain Borin",
  gold: 1000, // Initial gold
  inventory: {
    wood: 0, iron: 0, wheat: 0, stone: 0, gems: 0, spices: 0
  },
  merchants: [
    {
      name: "Garrick Thorne",
      hire: false,
      free: true,
      capacity: 90,
      currentLocation: "oakhaven",
      status: "idle",
      destination: null,
      arrivalTime: null,
      inventory: { wood: 0, iron: 0, wheat: 0, stone: 0, gems: 0, spices: 0 }
    },
    {
      name: "Lyra Vane",
      hire: false,
      free: true,
      capacity: 100,
      currentLocation: "oakhaven",
      status: "idle",
      destination: null,
      arrivalTime: null,
      inventory: { wood: 0, iron: 0, wheat: 0, stone: 0, gems: 0, spices: 0 }
    },
    {
      name: "Tony Vander",
      hire: false,
      free: true,
      capacity: 120,
      currentLocation: "oakhaven",
      status: "idle",
      destination: null,
      arrivalTime: null,
      inventory: { wood: 0, iron: 0, wheat: 0, stone: 0, gems: 0, spices: 0 }
    }
  ]
};

// --- RESET GAME ---
app.post('/api/reset', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'data', 'player.json');
        // Overwrite the file with default data
        fs.writeFileSync(filePath, JSON.stringify(DEFAULT_PLAYER_STATE, null, 2));
        
        console.log("♻️ GAME RESET: player.json restored.");
        res.json({ success: true, message: "Game reset." });
    } catch (error) {
        console.error("Error resetting:", error);
        res.status(500).json({ error: "Could not reset." });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running in http://localhost:${PORT}`);
});
