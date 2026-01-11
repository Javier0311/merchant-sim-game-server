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