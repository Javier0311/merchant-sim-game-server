const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('¡El servidor del Gremio de Mercaderes está ONLINE! 🏰');
});

app.listen(PORT, () => {
    console.log(`🚀 Server running in http://localhost:${PORT}`);
});

// Routes

// Get Cities

app.get('/api/cities', (req, res) => {
    try{
        const filePath = path.join(__dirname, 'data', 'cities.json');

        const data = fs.readFileSync(filePath, 'utf8');

        const cities = JSON.parse(data);
        res.json(cities);

    } catch (error) {
        res.status(500).json({ error: "Error reading cities.json" });
    }
});

// Get Goods

app.get('/api/goods', (req, res) => {
    try{
        const filePath = path.join(__dirname, 'data', 'goods.json');

        const data = fs.readFileSync(filePath, 'utf-8');

        const goods = JSON.parse(data);
        res.json(goods);

    } catch (error){
        res.status(500).json({ error: "Error reading goods.json"});
    }
});

// Get Player

app.get('/api/player', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'data', 'player.json');
        const data = fs.readFileSync(filePath, 'utf8');
        const player = JSON.parse(data);
        res.json(player);
    } catch (error) {
        res.status(500).json({ error: "Error leyendo player.json" });
    }
});

app.post('/api/hire', (req, res) => {

    try{
        const filePath = path.join(__dirname, 'data', 'player.json');

        const data = fs.readFileSync(filePath, 'utf8');
        const player = JSON.parse(data);

        const merchantIndex = player.merchants.findIndex(m => m.hire === false);

        if (merchantIndex === -1) {
            return res.status(400).json({ error: "¡Ya has contratado a todos los mercaderes disponibles!" });
        }

        const costo = 500;
        if (player.gold < costo) {
            return res.status(400).json({ error: "No tienes suficiente oro para contratar." });
        }

        player.gold -= costo;
        player.merchants[merchantIndex].hire = true;

        fs.writeFileSync(filePath, JSON.stringify(player, null, 2));

        res.json({ 
            success: true, 
            message: `¡Contratado! ${player.merchants[merchantIndex].name} se une a tu gremio.`,
            player: player,
            newMerchant: player.merchants[merchantIndex]
        });

    } catch (error) {
        console.error("Error hiring:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});